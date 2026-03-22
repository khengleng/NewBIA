import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/jwt-auth';
import redis from '../redis';
import { prisma } from '../database';
import { generateSecureToken } from '../utils/security';
import { issueTokensAndSetCookies } from '../utils/auth-utils';

const router = Router();

function getTradingFrontendBaseUrl(): string {
  const configured = String(process.env.TRADING_FRONTEND_URL || '').trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return 'https://trade.cambobia.com';
}

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
