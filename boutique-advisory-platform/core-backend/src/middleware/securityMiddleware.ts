/**
 * Security Middleware
 * Enhanced security controls for the Boutique Advisory Platform
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logAuditEvent } from '../utils/security';
import redis from '../redis';

// ============================================
// REQUEST ID MIDDLEWARE
// ============================================

/**
 * Add unique request ID for tracing and debugging
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
};

// ============================================
// SECURITY HEADERS MIDDLEWARE
// ============================================

/**
 * Add additional security headers beyond what Helmet provides
 */
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Prevent caching of sensitive data
    if (req.path.includes('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
    }

    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

    next();
};

// ============================================
// IP SECURITY MIDDLEWARE
// ============================================

// Blocked IPs and Suspicious Activity are now managed in Redis
const BLOCKED_IPS_KEY = 'bia:security:blocked_ips';
const SUSPICIOUS_IPS_KEY = 'bia:security:suspicious_ips';
const ROLE_RATE_LIMIT_PREFIX = 'bia:security:rate_limit:';

/**
 * Block malicious IPs (Async version with Redis)
 */
export const ipSecurityMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const clientIp = getClientIp(req);

        // Skip check if Redis is not ready
        if (!redis || redis.status !== 'ready') {
            return next();
        }

        // Check if IP is blocked in Redis
        const isBlocked = await redis.sismember(BLOCKED_IPS_KEY, clientIp);

        if (isBlocked) {
            logAuditEvent({
                userId: 'system',
                action: 'BLOCKED_IP_ACCESS',
                resource: req.path,
                ipAddress: clientIp,
                success: false,
                errorMessage: 'IP is blocked'
            });
            res.status(403).json({ error: 'Access denied' });
            return;
        }
    } catch (error) {
        console.error('IP Security Middleware Error:', error);
        // Fail-open for availability
    }

    next();
};

/**
 * Get real client IP considering proxies
 */
export function getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        const ips = (typeof forwardedFor === 'string' ? forwardedFor : forwardedFor[0]).split(',');
        return ips[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Block an IP address (Redis)
 */
export async function blockIp(ip: string): Promise<void> {
    await redis.sadd(BLOCKED_IPS_KEY, ip);
    await logAuditEvent({
        userId: 'system',
        action: 'IP_BLOCKED',
        resource: 'security',
        details: { ip },
        ipAddress: ip,
        success: true
    });
}

/**
 * Unblock an IP address (Redis)
 */
export async function unblockIp(ip: string): Promise<void> {
    await redis.srem(BLOCKED_IPS_KEY, ip);
}

// ============================================
// SENSITIVE DATA PROTECTION
// ============================================

/**
 * Mask sensitive data in request body for logging
 */
export function maskSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sensitiveFields = [
        'password', 'currentPassword', 'newPassword', 'confirmPassword',
        'token', 'accessToken', 'refreshToken', 'apiKey', 'secret',
        'creditCard', 'cardNumber', 'cvv', 'cvc', 'ssn', 'nationalId',
        'totpCode', 'backupCode', 'otp'
    ];

    const masked = { ...data };

    for (const field of sensitiveFields) {
        if (masked[field]) {
            masked[field] = '***REDACTED***';
        }
    }

    return masked;
}

// ============================================
// CONTENT VALIDATION MIDDLEWARE
// ============================================

/**
 * Validate content type for POST/PUT requests
 */
export const contentTypeValidation = (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];

        // Skip for multipart (file uploads)
        if (contentType?.includes('multipart/form-data')) {
            return next();
        }

        // Require JSON for API endpoints
        if (req.path.startsWith('/api/') && !contentType?.includes('application/json')) {
            return res.status(415).json({
                error: 'Unsupported Media Type',
                message: 'Content-Type must be application/json'
            });
        }
    }

    next();
};

// ============================================
// SQL INJECTION PREVENTION
// ============================================

const sqlInjectionPatterns = [
    /(\-\-)|(\%23)/i, // Removed # as it can be part of normal text
    /((\%3D)|(=))[^\n]*((\%23)|(\-\-)|(\%3B)|(;))/i, // Require specific comment/terminator after assignment
    /\bOR\b\s+((\%27)|(\'))?\d+((\%3D)|(=))\d+/i, // Better OR bypass pattern
    /((\%27)|(\'))union/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /UNION(\s+)ALL(\s+)SELECT/i,
    /SELECT.*FROM.*WHERE/i,
    /INSERT(\s+)INTO/i,
    /DELETE(\s+)FROM/i,
    /DROP(\s+)TABLE/i,
];

/**
 * Check for SQL injection patterns in input
 */
export function detectSqlInjection(input: string): boolean {
    for (const pattern of sqlInjectionPatterns) {
        if (pattern.test(input)) {
            return true;
        }
    }
    return false;
}

/**
 * SQL injection prevention middleware
 */
export const sqlInjectionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const checkValue = (value: any, path: string): boolean => {
        if (typeof value === 'string' && detectSqlInjection(value)) {
            logAuditEvent({
                userId: (req as any).user?.id || 'anonymous',
                action: 'SQL_INJECTION_ATTEMPT',
                resource: req.path,
                details: { field: path },
                ipAddress: getClientIp(req),
                success: false,
                errorMessage: 'Potential SQL injection detected'
            });
            return true;
        }
        if (typeof value === 'object' && value !== null) {
            for (const [key, val] of Object.entries(value)) {
                if (checkValue(val, `${path}.${key}`)) return true;
            }
        }
        return false;
    };

    if (checkValue(req.body, 'body') ||
        checkValue(req.query, 'query') ||
        checkValue(req.params, 'params')) {
        res.status(400).json({ error: 'Invalid input detected' });
        return;
    }

    next();
};

// ============================================
// XSS PREVENTION
// ============================================

const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<link/i,
    /<meta/i,
];

/**
 * Check for XSS patterns in input
 */
export function detectXss(input: string): boolean {
    for (const pattern of xssPatterns) {
        if (pattern.test(input)) {
            return true;
        }
    }
    return false;
}

/**
 * XSS prevention middleware
 */
export const xssMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const checkValue = (value: any, path: string): boolean => {
        if (typeof value === 'string' && detectXss(value)) {
            logAuditEvent({
                userId: (req as any).user?.id || 'anonymous',
                action: 'XSS_ATTEMPT',
                resource: req.path,
                details: { field: path },
                ipAddress: getClientIp(req),
                success: false,
                errorMessage: 'Potential XSS detected'
            });
            return true;
        }
        if (typeof value === 'object' && value !== null) {
            for (const [key, val] of Object.entries(value)) {
                if (checkValue(val, `${path}.${key}`)) return true;
            }
        }
        return false;
    };

    if (checkValue(req.body, 'body')) {
        res.status(400).json({ error: 'Invalid input detected' });
        return;
    }

    next();
};

// ============================================
// ROLE-BASED RATE LIMITING
// ============================================

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

const roleRateLimits: Record<string, RateLimitConfig> = {
    'ADMIN': { windowMs: 60000, maxRequests: 1000 },
    'ADVISOR': { windowMs: 60000, maxRequests: 500 },
    'INVESTOR': { windowMs: 60000, maxRequests: 300 },
    'SME': { windowMs: 60000, maxRequests: 200 },
    'anonymous': { windowMs: 60000, maxRequests: 60 },
};

const roleRequestCounts = new Map<string, { count: number; resetTime: Date }>();

/**
 * Role-based rate limiting middleware (Redis-backed)
 */
export const roleBasedRateLimiting = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const user = (req as any).user;
        const role = user?.role || 'anonymous';
        const userId = user?.id || getClientIp(req);
        const key = `${ROLE_RATE_LIMIT_PREFIX}${role}:${userId}`;

        const config = roleRateLimits[role] || roleRateLimits['anonymous'];
        const now = Date.now();

        // Skip Redis ops if not connected
        if (!redis || redis.status !== 'ready') {
            return next();
        }

        // Use Redis for atomic increment and TTL
        const currentCount = await redis.incr(key);


        // If it's a new key, set expiry
        if (currentCount === 1) {
            await redis.pexpire(key, config.windowMs);
        }

        const ttl = await redis.pttl(key);
        const resetTime = new Date(now + Math.max(0, ttl));

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', config.maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - currentCount));
        res.setHeader('X-RateLimit-Reset', resetTime.toISOString());

        if (currentCount > config.maxRequests) {
            logAuditEvent({
                userId: userId,
                action: 'RATE_LIMIT_EXCEEDED',
                resource: req.path,
                details: { role, count: currentCount, limit: config.maxRequests },
                ipAddress: getClientIp(req),
                success: false
            });

            res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter: Math.ceil(ttl / 1000)
            });
            return;
        }
    } catch (error) {
        console.error('Role Rate Limiting Middleware Error:', error);
        // Fail-open if Redis is down
    }

    next();
};

export default {
    requestIdMiddleware,
    securityHeadersMiddleware,
    ipSecurityMiddleware,
    contentTypeValidation,
    sqlInjectionMiddleware,
    xssMiddleware,
    roleBasedRateLimiting,
    getClientIp,
    blockIp,
    unblockIp,
    maskSensitiveData,
    detectSqlInjection,
    detectXss
};
