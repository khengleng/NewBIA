import { Response, Request, CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../database';
import { generateSecureToken, hashToken } from './security';

export const COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours default, usually overridden
};

export interface AuthCookieNames {
    accessToken: string;
    refreshToken: string;
    token: string;
}

function readHostFromRequest(req?: Request | null): string {
    if (!req) return '';

    const forwardedHost = req.headers['x-forwarded-host'];
    const hostHeader = req.headers['host'];

    const explode = (value: string | string[] | undefined): string[] => {
        const items = Array.isArray(value) ? value : [value];
        return items
            .flatMap((entry) => String(entry || '').split(','))
            .map((entry) => entry.trim().toLowerCase().replace(/:\d+$/, ''))
            .filter(Boolean);
    };

    const hostCandidates = [
        ...explode(forwardedHost),
        ...explode(hostHeader),
        ...explode(req.hostname)
    ];

    const explicitPlatformHost = hostCandidates.find((candidate) =>
        candidate === 'trade.cambobia.com'
        || candidate === 'cambobia.com'
        || candidate === 'www.cambobia.com'
        || candidate.endsWith('.cambobia.com')
    );

    return explicitPlatformHost || hostCandidates[0] || '';
}

function isTradingHostname(hostname: string): boolean {
    if (!hostname) return false;
    const host = String(hostname || '').toLowerCase().trim();
    return host === 'trade.cambobia.com'
        || host.endsWith('.trade.cambobia.com')
        || host.includes('trade.cambobia.com')
        || host.includes('trading.railway')
        || host.includes('trade-')
        || host.startsWith('trade.');
}

function resolveTradingCookieScope(req?: Request | null): boolean {
    const requestHost = readHostFromRequest(req);
    if (isTradingHostname(requestHost)) return true;

    const configuredTradingUrl = String(process.env.TRADING_FRONTEND_URL || '').trim();
    if (configuredTradingUrl) {
        try {
            const configuredHost = new URL(configuredTradingUrl).hostname.toLowerCase();
            if (requestHost && configuredHost === requestHost) return true;
        } catch {
            // Ignore invalid URL and continue with SERVICE_MODE fallback.
        }
    }

    const serviceMode = String(process.env.SERVICE_MODE || 'core').toLowerCase();
    return serviceMode === 'trading';
}

export function getAuthCookieNames(req?: Request): AuthCookieNames {
    const isTrading = resolveTradingCookieScope(req);
    const names = isTrading ? {
            accessToken: 'tr_accessToken',
            refreshToken: 'tr_refreshToken',
            token: 'tr_token',
        } : {
            accessToken: 'accessToken',
            refreshToken: 'refreshToken',
            token: 'token',
        };
    
    // Low-noise logging for auth debugging
    if (req && (req.path === '/api/auth/me' || req.path === '/api/auth/login')) {
        console.log(`[AUTH] Cookie resolution for ${req.path} (Host: ${req.headers.host}): ${names.accessToken}`);
    }

    return names;
}

function getCookieDomainCandidates(_req: Request): string[] {
    const domains = new Set<string>();
    const envDomain = String(process.env.COOKIE_DOMAIN || '').trim().toLowerCase();

    if (envDomain) {
        domains.add(envDomain);
        domains.add(envDomain.startsWith('.') ? envDomain.slice(1) : envDomain);
        domains.add(envDomain.startsWith('.') ? envDomain : `.${envDomain}`);
    }
    // Keep domain cleanup narrow to avoid oversized Set-Cookie headers on login/logout.
    // Host-derived variants can explode header count and trigger upstream "Header overflow"
    // when auth is routed through the frontend proxy.
    return Array.from(domains).filter(Boolean);
}

export function clearAuthCookies(res: Response, req: Request): void {
    const clearPaths = ['/', '/api'];
    // Always clear both legacy and service-specific cookie names.
    const cookieNames = [
        'token',
        'accessToken',
        'refreshToken',
        'tr_token',
        'tr_accessToken',
        'tr_refreshToken',
    ];
    const domainCandidates = getCookieDomainCandidates(req);

    for (const name of cookieNames) {
        for (const path of clearPaths) {
            res.clearCookie(name, { ...COOKIE_OPTIONS, path, maxAge: 0 });
            for (const domain of domainCandidates) {
                res.clearCookie(name, { ...COOKIE_OPTIONS, path, domain, maxAge: 0 });
            }
        }
    }
}

/**
 * Helper to issue Access & Refresh tokens and set cookies
 */
export async function issueTokensAndSetCookies(res: Response, user: any, req: Request) {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not configured');

    // 1. Access Token (Short-lived: 15m)
    const accessToken = jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
    );

    // 2. Refresh Token (Long-lived: 7d)
    const refreshToken = generateSecureToken(64);
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const clientUserAgentHeader = req.headers['x-client-user-agent'];
    const fallbackUserAgentHeader = req.headers['user-agent'];
    const clientPlatformHeader = req.headers['x-client-platform'];
    const chUaPlatformHeader = req.headers['sec-ch-ua-platform'];

    const readHeaderValue = (value: string | string[] | undefined): string => {
        const raw = Array.isArray(value) ? value[0] : value;
        return typeof raw === 'string' ? raw.trim() : '';
    };

    const resolvedUserAgent = readHeaderValue(clientUserAgentHeader)
        || readHeaderValue(fallbackUserAgentHeader)
        || 'unknown';

    const resolvedPlatform = readHeaderValue(clientPlatformHeader)
        || readHeaderValue(chUaPlatformHeader);

    const normalizedPlatform = resolvedPlatform.replace(/^"+|"+$/g, '');
    const storedUserAgent = normalizedPlatform
        ? `[platform:${normalizedPlatform}] ${resolvedUserAgent}`
        : resolvedUserAgent;

    // Store hash in DB
    await prisma.refreshToken.create({
        data: {
            token: refreshTokenHash,
            userId: user.id,
            expiresAt,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: storedUserAgent
        }
    });

    // Clear any legacy/duplicate auth cookies first so old identities cannot linger.
    clearAuthCookies(res, req);

    const cookieNames = getAuthCookieNames(req);

    // Use host-only cookies unless an explicit cookie domain is configured.
    // This prevents cambobia.com and trade.cambobia.com sessions from bleeding across platforms.
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

    // 3. Set Cookies
    // Access Token
    res.cookie(cookieNames.accessToken, accessToken, {
        ...COOKIE_OPTIONS,
        domain: cookieDomain,
        maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Refresh Token
    res.cookie(cookieNames.refreshToken, refreshToken, {
        ...COOKIE_OPTIONS,
        domain: cookieDomain,
        path: '/', // Ensure proxy compatibility
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Set 'token' cookie for backward compatibility
    res.cookie(cookieNames.token, accessToken, {
        ...COOKIE_OPTIONS,
        domain: cookieDomain,
        maxAge: 15 * 60 * 1000
    });

    return { accessToken, refreshToken };
}
