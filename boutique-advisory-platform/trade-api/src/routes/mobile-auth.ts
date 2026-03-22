import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/jwt-auth';
import redis from '../redis';
import { prisma } from '../database';
import { generateSecureToken } from '../utils/security';
import { issueTokensAndSetCookies } from '../utils/auth-utils';
import axios from 'axios';

const router = Router();
const IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL || 'http://identity-service:3007';

function getTradingFrontendBaseUrl(): string {
  const configured = String(process.env.TRADING_FRONTEND_URL || '').trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return 'https://trade.cambobia.com';
}

function getSetCookieHeader(headers: Record<string, any>): string[] {
  const raw = headers?.['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [String(raw)];
}

function extractCookieValue(setCookies: string[], name: string): string {
  const match = setCookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return '';
  const value = match.split(';')[0]?.split('=')[1];
  return value ? String(value) : '';
}

async function forwardToIdentity(path: string, req: Request, res: Response, includeRefreshCookie = false) {
  try {
    const refreshToken = String((req.body as any)?.refreshToken || '').trim();
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (includeRefreshCookie && refreshToken) {
      headers.Cookie = `tr_refreshToken=${refreshToken}; refreshToken=${refreshToken}`;
    }

    const response = await axios({
      method: 'POST',
      url: `${IDENTITY_SERVICE_URL}${path}`,
      data: req.body || {},
      headers,
      validateStatus: () => true,
    });

    const setCookies = getSetCookieHeader(response.headers as Record<string, any>);
    if (setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }

    return { response, setCookies };
  } catch (error: any) {
    console.error(`Mobile auth proxy error (${path}):`, error.message);
    res.status(502).json({ error: 'Identity service unavailable' });
    return null;
  }
}

router.post('/login', async (req: Request, res: Response) => {
  const upstream = await forwardToIdentity('/api/auth/login', req, res);
  if (!upstream) return;

  const { response, setCookies } = upstream;
  if (response.status >= 400) {
    return res.status(response.status).json(response.data);
  }

  const accessToken =
    (response.data && response.data.accessToken) ||
    extractCookieValue(setCookies, 'tr_accessToken') ||
    extractCookieValue(setCookies, 'accessToken');
  const refreshToken =
    (response.data && response.data.refreshToken) ||
    extractCookieValue(setCookies, 'tr_refreshToken') ||
    extractCookieValue(setCookies, 'refreshToken');
  const token =
    (response.data && response.data.token) ||
    extractCookieValue(setCookies, 'tr_token') ||
    extractCookieValue(setCookies, 'token') ||
    accessToken;

  return res.status(response.status).json({
    ...(response.data || {}),
    platform: 'twallet',
    accessToken,
    refreshToken,
    token,
  });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const upstream = await forwardToIdentity('/api/auth/refresh', req, res, true);
  if (!upstream) return;

  const { response, setCookies } = upstream;
  if (response.status >= 400) {
    return res.status(response.status).json(response.data);
  }

  const accessToken =
    extractCookieValue(setCookies, 'tr_accessToken') ||
    extractCookieValue(setCookies, 'accessToken') ||
    response.data?.accessToken;
  const refreshToken =
    extractCookieValue(setCookies, 'tr_refreshToken') ||
    extractCookieValue(setCookies, 'refreshToken') ||
    response.data?.refreshToken;
  const token =
    extractCookieValue(setCookies, 'tr_token') ||
    extractCookieValue(setCookies, 'token') ||
    response.data?.token ||
    accessToken;

  return res.status(response.status).json({
    ...(response.data || {}),
    accessToken,
    refreshToken,
    token,
  });
});

router.post('/logout', async (req: Request, res: Response) => {
  const upstream = await forwardToIdentity('/api/auth/logout', req, res, true);
  if (!upstream) return;

  const { response } = upstream;
  return res.status(response.status).json(response.data);
});

router.get('/sso-link', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!redis || redis.status !== 'ready') {
      return res.status(503).json({ error: 'SSO temporarily unavailable. Please try again shortly.' });
    }

    const code = generateSecureToken(32);
    const payload = JSON.stringify({
      userId: req.user.id,
      createdAt: Date.now()
    });
    await redis.set(`mobile:sso:${code}`, payload, 'EX', 120);

    const next = typeof req.query?.next === 'string' ? req.query.next : '';
    const redirectTarget = next && next.startsWith('/') ? next : '/dashboard';
    const redirectUrl = `${getTradingFrontendBaseUrl()}/api-proxy/api/mobile/auth/sso/exchange?code=${encodeURIComponent(code)}&next=${encodeURIComponent(redirectTarget)}`;

    return res.json({ redirectUrl, expiresIn: 120 });
  } catch (error) {
    console.error('Mobile SSO link error:', error);
    return res.status(500).json({ error: 'Failed to initiate SSO' });
  }
});

router.get('/sso/exchange', async (req: Request, res: Response) => {
  try {
    if (!redis || redis.status !== 'ready') {
      return res.status(503).send('SSO temporarily unavailable');
    }
    const code = typeof req.query?.code === 'string' ? req.query.code : '';
    if (!code) return res.status(400).send('SSO code is required');

    const raw = await redis.get(`mobile:sso:${code}`);
    if (!raw) return res.status(401).send('Invalid or expired SSO code');
    await redis.del(`mobile:sso:${code}`);

    const payload = JSON.parse(raw);
    const userId = String(payload?.userId || '');
    if (!userId) return res.status(400).send('Invalid SSO payload');

    const user = await prisma.user.findFirst({
      where: { id: userId, status: { not: 'DELETED' } }
    });
    if (!user) return res.status(401).send('User not found');

    await issueTokensAndSetCookies(res, user, req);

    const next = typeof req.query?.next === 'string' ? req.query.next : '';
    const redirectTarget = next && next.startsWith('/') ? next : '/dashboard';
    return res.redirect(302, redirectTarget);
  } catch (error) {
    console.error('Mobile SSO exchange error:', error);
    return res.status(500).send('Failed to complete SSO');
  }
});

export default router;
