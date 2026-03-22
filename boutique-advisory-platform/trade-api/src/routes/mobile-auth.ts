import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/jwt-auth';
import redis from '../redis';
import { prisma } from '../database';
import { generateSecureToken } from '../utils/security';
import { issueTokensAndSetCookies } from '../utils/auth-utils';
import axios from 'axios';

const router = Router();
const IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL || 'http://identity-service:3007';
const DEFAULT_PAYMENT_MODE = 'P2P_C2B_C2C';

function getTradingFrontendBaseUrl(): string {
  const configured = String(process.env.TRADING_FRONTEND_URL || '').trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return 'https://trade.cambobia.com';
}

function normalizeRole(role: string | null | undefined): string {
  return String(role ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function mapRoleToMobileRole(role: string): string | null {
  const normalized = normalizeRole(role);
  if (normalized === 'SME_OWNER') return 'SME_OWNER';
  if (normalized === 'SME') return 'SME_OWNER';
  if (normalized === 'INVESTOR' || normalized === 'TRADER') return 'INVESTOR';
  if (normalized === 'ADVISOR') return 'ADVISOR';
  if (normalized === 'PLATFORM_OPERATOR') return 'PLATFORM_OPERATOR';
  if (normalized === 'ADMIN') return 'ADMIN';
  if (normalized === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  return null;
}

function extractRoleStrings(user?: Record<string, any> | null): string[] {
  if (!user) return [];
  const rawRoles = user.roles;
  if (Array.isArray(rawRoles)) {
    return rawRoles.map((role) => String(role));
  }
  if (typeof rawRoles === 'string') {
    return rawRoles.split(/[,;|]/).map((role) => role.trim()).filter(Boolean);
  }

  const roleValue = user.role;
  if (typeof roleValue === 'string' && roleValue.trim()) {
    return roleValue.split(/[,;|]/).map((role) => role.trim()).filter(Boolean);
  }

  const primaryRole = user.primaryRole;
  if (typeof primaryRole === 'string' && primaryRole.trim()) {
    return [primaryRole.trim()];
  }

  return [];
}

function buildMobileAccess(roleInputs: string[], primaryRole?: string) {
  const mappedRoles = roleInputs
    .map((role) => mapRoleToMobileRole(role))
    .filter((role): role is string => Boolean(role));

  const roles = Array.from(new Set(mappedRoles));

  const permissionsByRole: Record<string, string[]> = {
    SME_OWNER: [
      'wallet.read',
      'wallet.update',
      'wallet.write',
      'payment.create',
      'deal.list',
      'messages.read',
      'messages.write',
    ],
    INVESTOR: [
      'wallet.read',
      'wallet.update',
      'wallet.write',
      'payment.create',
      'deal.list',
      'secondary_trading.list',
      'messages.read',
      'messages.write',
    ],
    ADVISOR: [
      'wallet.read',
      'wallet.update',
      'wallet.write',
      'payment.create',
      'deal.list',
      'messages.read',
      'messages.write',
    ],
    PLATFORM_OPERATOR: [
      'wallet.read',
      'wallet.update',
      'wallet.write',
      'payment.create',
      'deal.list',
      'secondary_trading.list',
      'messages.read',
      'messages.write',
    ],
    ADMIN: [
      'wallet.read',
      'wallet.update',
      'wallet.write',
      'payment.create',
      'deal.list',
      'secondary_trading.list',
      'messages.read',
      'messages.write',
    ],
    SUPER_ADMIN: [
      'wallet.read',
      'wallet.update',
      'wallet.write',
      'payment.create',
      'deal.list',
      'secondary_trading.list',
      'messages.read',
      'messages.write',
    ],
  };

  const permissions = Array.from(
    new Set(
      roles.flatMap((role) => permissionsByRole[role] || [])
    )
  );

  const platforms = {
    core: roles.some((role) => ['SME_OWNER', 'ADVISOR', 'PLATFORM_OPERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)),
    trading: roles.some((role) => ['INVESTOR', 'PLATFORM_OPERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role)),
  };

  return {
    roles,
    permissions,
    platforms,
    primaryRole: primaryRole || roles[0],
  };
}

function buildAccessFromUser(user?: Record<string, any> | null) {
  const roleInputs = extractRoleStrings(user);
  const primaryRole = user?.primaryRole || user?.role;
  return buildMobileAccess(roleInputs, primaryRole ? mapRoleToMobileRole(String(primaryRole)) || undefined : undefined);
}

async function fetchIdentityMe(accessToken: string): Promise<Record<string, any> | null> {
  if (!accessToken) return null;
  try {
    const response = await axios.get(`${IDENTITY_SERVICE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      validateStatus: () => true,
    });
    if (response.status >= 400) return null;
    return response.data?.user || null;
  } catch (error: any) {
    console.error('Mobile auth me fetch error:', error.message);
    return null;
  }
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

  const user = response.data?.user || null;
  const access = buildAccessFromUser(user);

  return res.status(response.status).json({
    ...(response.data || {}),
    platform: 'twallet',
    accessToken,
    refreshToken,
    token,
    roles: access.roles,
    permissions: access.permissions,
    platforms: access.platforms,
    primaryRole: access.primaryRole,
    paymentMode: DEFAULT_PAYMENT_MODE,
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

  const user = await fetchIdentityMe(accessToken || '');
  const access = buildAccessFromUser(user);

  return res.status(response.status).json({
    ...(response.data || {}),
    accessToken,
    refreshToken,
    token,
    user,
    roles: access.roles,
    permissions: access.permissions,
    platforms: access.platforms,
    primaryRole: access.primaryRole,
    paymentMode: DEFAULT_PAYMENT_MODE,
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
