import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authorize';
import { isAdminLikeRole, isTradingOperatorRole, normalizeRole } from '../lib/roles';
import { prisma, prismaReplica } from '../database';
import redis from '../redis';
import { blockIp, unblockIp } from '../middleware/securityMiddleware';

const router = Router();

const BLOCKED_IPS_KEY = 'bia:security:blocked_ips';
const IPV4_PATTERN = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6_PATTERN = /^[0-9a-f:]+$/i;

const requireTradingOperator = (req: AuthenticatedRequest, res: Response): boolean => {
  const role = normalizeRole(req.user?.role);
  if (!isTradingOperatorRole(role)) {
    res.status(403).json({ error: 'Operator role required' });
    return false;
  }
  return true;
};

const requireAdminLike = (req: AuthenticatedRequest, res: Response): boolean => {
  const role = normalizeRole(req.user?.role);
  if (!isAdminLikeRole(role)) {
    res.status(403).json({ error: 'Admin-like role required' });
    return false;
  }
  return true;
};

const isValidIp = (ip: string): boolean => {
  const value = String(ip || '').trim();
  if (!value) return false;
  if (IPV4_PATTERN.test(value)) return true;
  if (value.includes(':') && IPV6_PATTERN.test(value)) return true;
  return false;
};

router.get('/overview', async (req: AuthenticatedRequest, res: Response) => {
  if (!requireTradingOperator(req, res)) return;

  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context missing' });
  }

  try {
    const blockedIps = redis && redis.status === 'ready'
      ? await redis.smembers(BLOCKED_IPS_KEY)
      : [];

    const now = new Date();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const operatorRoles = ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX', 'AUDITOR', 'COMPLIANCE', 'SUPPORT'] as const;

    const [operatorAccounts, operatorMfaEnabled, activeSessionCount, suspiciousLoginAttempts24h, recentSessionRows] = await Promise.all([
      prismaReplica.user.count({
        where: { tenantId, role: { in: operatorRoles as any } }
      }),
      prismaReplica.user.count({
        where: { tenantId, role: { in: operatorRoles as any }, twoFactorEnabled: true }
      }),
      prismaReplica.refreshToken.count({
        where: { revoked: false, expiresAt: { gt: now }, user: { tenantId } }
      }),
      prismaReplica.activityLog.count({
        where: {
          tenantId,
          action: { in: ['LOGIN_FAILED', 'BLOCKED_IP_ACCESS', 'SQL_INJECTION_ATTEMPT', 'XSS_ATTEMPT'] },
          timestamp: { gte: since24h }
        }
      }),
      prismaReplica.refreshToken.findMany({
        where: { user: { tenantId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { email: true, role: true } } }
      })
    ]);

    const recentEvents = recentSessionRows.map((row) => ({
      timestamp: row.createdAt,
      action: row.revoked ? 'SESSION_REVOKED' : 'SESSION_CREATED',
      detail: `${row.user?.email || 'Unknown'} (${row.user?.role || 'N/A'})`,
      ipAddress: row.ipAddress || null,
      result: row.revoked ? 'DENIED' : 'ALLOWED'
    }));

    return res.json({
      policy: {
        enforceAdminMfa: process.env.ENFORCE_ADMIN_2FA === 'true',
        loginAttemptLimit: Number(process.env.ACCOUNT_LOCKOUT_ATTEMPTS || 5),
        lockoutWindowMinutes: Number(process.env.ACCOUNT_LOCKOUT_DURATION_MINUTES || 30),
        sessionTtlDays: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7),
        passwordMinLength: Number(process.env.PASSWORD_MIN_LENGTH || 8),
        platformBoundaryMode: process.env.PLATFORM_SERVICE_MODE || 'single',
      },
      metrics: {
        operatorAccounts,
        operatorMfaEnabled,
        operatorMfaCoverage: operatorAccounts > 0
          ? Number(((operatorMfaEnabled / operatorAccounts) * 100).toFixed(2))
          : 0,
        activeSessionCount,
        suspiciousLoginAttempts24h,
        blockedIpCount: blockedIps.length,
      },
      blockedIps,
      recentEvents,
    });
  } catch (error: any) {
    console.error('Admin security overview error:', error);
    return res.status(500).json({ error: 'Failed to load security overview' });
  }
});

router.post('/ip-blocklist', async (req: AuthenticatedRequest, res: Response) => {
  if (!requireTradingOperator(req, res)) return;
  if (!requireAdminLike(req, res)) return;

  const ipAddress = String(req.body?.ipAddress || '').trim();
  if (!isValidIp(ipAddress)) {
    return res.status(400).json({ error: 'Valid IPv4/IPv6 address is required' });
  }

  try {
    await blockIp(ipAddress);
    return res.json({ message: 'IP blocked', ipAddress });
  } catch (error: any) {
    console.error('Block IP error:', error);
    return res.status(500).json({ error: 'Failed to block IP' });
  }
});

router.delete('/ip-blocklist/:ipAddress', async (req: AuthenticatedRequest, res: Response) => {
  if (!requireTradingOperator(req, res)) return;
  if (!requireAdminLike(req, res)) return;

  const ipAddress = String(req.params.ipAddress || '').trim();
  if (!isValidIp(ipAddress)) {
    return res.status(400).json({ error: 'Valid IPv4/IPv6 address is required' });
  }

  try {
    await unblockIp(ipAddress);
    return res.json({ message: 'IP unblocked', ipAddress });
  } catch (error: any) {
    console.error('Unblock IP error:', error);
    return res.status(500).json({ error: 'Failed to unblock IP' });
  }
});

router.post('/revoke-sessions', async (req: AuthenticatedRequest, res: Response) => {
  if (!requireTradingOperator(req, res)) return;
  if (!requireAdminLike(req, res)) return;

  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context missing' });
  }

  const includeCurrent = Boolean(req.body?.includeCurrent);
  const currentUserId = req.user?.id;

  try {
    const result = await prisma.refreshToken.updateMany({
      where: {
        user: { tenantId },
        revoked: false,
        ...(includeCurrent ? {} : { NOT: { userId: currentUserId } }),
      },
      data: {
        revoked: true,
      },
    });

    return res.json({
      message: 'Sessions revoked',
      revokedCount: result.count,
      includeCurrent,
    });
  } catch (error: any) {
    console.error('Revoke sessions error:', error);
    return res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

export default router;
