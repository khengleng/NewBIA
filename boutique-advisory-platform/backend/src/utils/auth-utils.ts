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

    // 3. Set Cookies
    // Access Token
    res.cookie('accessToken', accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Refresh Token
    res.cookie('refreshToken', refreshToken, {
        ...COOKIE_OPTIONS,
        path: '/', // Changed from /api to / to ensure proxy compatibility
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });


    // Set 'token' cookie for backward compatibility with existing middleware/FE
    res.cookie('token', accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000
    });
}
