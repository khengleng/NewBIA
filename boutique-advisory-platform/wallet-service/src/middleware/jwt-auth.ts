
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../database';
import { getTenantId } from '../utils/tenant-utils';

// Extend Express Request interface locally to avoid conflicts if not globally set yet
export interface AuthenticatedRequest extends Request {
    user?: any;
}

import { hashToken } from '../utils/security';
import { getAuthCookieNames, issueTokensAndSetCookies } from '../utils/auth-utils';

interface JwtPayload {
    userId: string;
    tenantId?: string;
    isPreAuth?: boolean;
}

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const cookieNames = getAuthCookieNames(req);
    let token = req.cookies?.[cookieNames.accessToken] || req.headers.authorization?.split(' ')[1];

    // Fallback for trading: If we are on the trading platform but don't have a tr_ cookie,
    // try the core cookie name. This allows seamless transitions if cookies share a domain/proxy.
    if (!token && cookieNames.accessToken === 'tr_accessToken') {
        token = req.cookies?.['accessToken'];
    }

    if (!token) {
        // No access token, try refresh token logic immediately
        const hasTrRefresh = Boolean(req.cookies?.['tr_refreshToken']);
        const hasCoreRefresh = Boolean(req.cookies?.['refreshToken']);
        const hasTrAccess = Boolean(req.cookies?.['tr_accessToken']);
        const hasCoreAccess = Boolean(req.cookies?.['accessToken']);
        
        console.log(`[AUTH] No token found. Cookies: tr_access=${hasTrAccess}, core_access=${hasCoreAccess}, tr_refresh=${hasTrRefresh}, core_refresh=${hasCoreRefresh}`);
        return handleRefresh(req, res, next);
    }

    try {
        if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET missing');

        const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;

        if (decoded.isPreAuth) {
            res.status(401).json({ error: 'Two-factor authentication required', code: '2FA_REQUIRED' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

        if (!user || user.status === 'DELETED') {
            res.status(401).json({ error: 'User not found or account deleted' });
            return;
        }

        if (!decoded.tenantId || decoded.tenantId !== user.tenantId) {
            if (process.env.AUTH_DEBUG === 'true') {
                res.status(401).json({ 
                    error: 'Invalid token tenant context',
                    details: `Token tenant: ${decoded.tenantId}, User tenant: ${user.tenantId}`
                });
            } else {
                res.status(401).json({ error: 'Invalid token tenant context' });
            }
            return;
        }

        const requestTenantId = getTenantId(req);
        const coreTenantId = process.env.CORE_TENANT_ID || 'default';
        const tradingTenantId = process.env.TRADING_TENANT_ID || 'trade';
        
        // Detect if we are in the trading context based on the cookie naming convention, 
        // which is derived from the current request hostname.
        const isTradingContext = getAuthCookieNames(req).accessToken.startsWith('tr_');

        const isAuthorizedCrossTenant = isTradingContext && 
            user.tenantId === coreTenantId && 
            (requestTenantId === tradingTenantId || requestTenantId === coreTenantId);

        const serviceMode = (process.env.SERVICE_MODE || 'core').toLowerCase();

        if (requestTenantId !== user.tenantId && !isAuthorizedCrossTenant) {
            console.warn('[AUTH] Tenant access denied', {
                path: req.originalUrl || req.url,
                requestTenantId,
                userTenantId: user.tenantId,
                userRole: user.role,
                isTradingContext,
                isAuthorizedCrossTenant,
                forwardedHost: req.headers['x-forwarded-host'],
                host: req.headers['host'],
                hostname: req.hostname,
                serviceMode,
            });
            if (process.env.AUTH_DEBUG === 'true') {
                res.status(403).json({ error: 'Tenant access denied. Path: ' + (req.originalUrl || req.url) });
            } else {
                res.status(403).json({ error: 'Tenant access denied' });
            }
            return;
        }

        req.user = user;
        next();
    } catch (error: any) {
        // If token expired, try to refresh
        if (error.name === 'TokenExpiredError') {
            return handleRefresh(req, res, next);
        }

        console.error('[AUTH] Token verification failed:', error.message);
        if (process.env.AUTH_DEBUG === 'true') {
            res.status(401).json({ 
                error: 'Invalid token',
                details: error.message 
            });
        } else {
            res.status(401).json({ error: 'Invalid token' });
        }
    }
};

/**
 * Helper to handle silent refresh within middleware
 */
async function handleRefresh(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const cookieNames = getAuthCookieNames(req);
    let refreshToken = req.cookies?.[cookieNames.refreshToken];

    if (!refreshToken && cookieNames.refreshToken === 'tr_refreshToken') {
        refreshToken = req.cookies?.['refreshToken'];
    }

    if (!refreshToken) {
        if (process.env.AUTH_DEBUG === 'true') {
            res.status(401).json({ error: 'Session expired. No refresh token found.' });
        } else {
            res.status(401).json({ error: 'Session expired. Please log in again.' });
        }
        return;
    }

    try {
        const tokenHash = hashToken(refreshToken);
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: tokenHash },
            include: { user: true }
        });

        if (!storedToken) {
            if (process.env.AUTH_DEBUG === 'true') {
                res.status(401).json({ error: 'Invalid session. Refresh token not found in database.' });
            } else {
                res.status(401).json({ error: 'Invalid session. Please log in again.' });
            }
            return;
        }

        if (storedToken.expiresAt < new Date()) {
            await prisma.refreshToken.delete({ where: { id: storedToken.id } });
            if (process.env.AUTH_DEBUG === 'true') {
                res.status(401).json({ error: 'Session expired. Refresh token expired at ' + storedToken.expiresAt.toISOString() });
            } else {
                res.status(401).json({ error: 'Session expired. Please log in again.' });
            }
            return;
        }

        if (storedToken.revoked) {
            if (process.env.AUTH_DEBUG === 'true') {
                res.status(401).json({ error: 'Session revoked. Please login again.' });
            } else {
                res.status(401).json({ error: 'Session revoked. Please log in again.' });
            }
            return;
        }

        const requestTenantId = getTenantId(req);
        const coreTenantId = process.env.CORE_TENANT_ID || 'default';
        const tradingTenantId = process.env.TRADING_TENANT_ID || 'trade';
        
        const isTradingContext = getAuthCookieNames(req).accessToken.startsWith('tr_');

        const isAuthorizedCrossTenant = isTradingContext && 
            storedToken.user.tenantId === coreTenantId && 
            (requestTenantId === tradingTenantId || requestTenantId === coreTenantId);

        const serviceMode = (process.env.SERVICE_MODE || 'core').toLowerCase();

        if (requestTenantId !== storedToken.user.tenantId && !isAuthorizedCrossTenant) {
            console.warn('[AUTH] Tenant access denied during refresh', {
                path: req.originalUrl || req.url,
                requestTenantId,
                userTenantId: storedToken.user.tenantId,
                forwardedHost: req.headers['x-forwarded-host'],
                host: req.headers['host'],
                hostname: req.hostname,
                serviceMode,
            });
            res.status(403).json({ error: 'Tenant access denied' });
            return;
        }

        // Rotate token
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        await issueTokensAndSetCookies(res, storedToken.user, req);

        // Attach user and continue
        req.user = storedToken.user;
        next();
    } catch (err: any) {
        console.error('Auto-refresh error:', err);
        if (process.env.AUTH_DEBUG === 'true') {
            res.status(401).json({ 
                error: 'Authentication failed during refresh',
                details: err.message 
            });
        } else {
            res.status(401).json({ error: 'Authentication failed during refresh' });
        }
    }
}

export const authorizeRoles = (...allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }

        next();
    };
};
