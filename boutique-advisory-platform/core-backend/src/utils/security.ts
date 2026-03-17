/**
 * Security Utilities
 * Centralized security functions for the Boutique Advisory Platform
 */

import crypto from 'crypto';
import { prisma } from '../database';

// ============================================
// PASSWORD SECURITY
// ============================================

/**
 * Generate a cryptographically secure random password
 * Used for initial setup when no password is provided
 */
export function generateSecurePassword(length: number = 16): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        password += charset[randomBytes[i] % charset.length];
    }
    return password;
}

/**
 * Validate password strength
 * Returns null if valid, error message if invalid
 */
export function validatePasswordStrength(password: string): string | null {
    if (password.length < 12) {
        return 'Password must be at least 12 characters long';
    }
    if (!/[a-z]/.test(password)) {
        return 'Password must contain at least one lowercase letter';
    }
    if (!/[A-Z]/.test(password)) {
        return 'Password must contain at least one uppercase letter';
    }
    if (!/[0-9]/.test(password)) {
        return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return 'Password must contain at least one special character';
    }
    return null;
}

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate a secure token for password reset, email verification, etc.
 */
export function generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a time-limited token with expiry
 */
export function generateTimedToken(): { token: string; expiresAt: Date } {
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
    return { token, expiresAt };
}

/**
 * Hash a token for storage (don't store raw tokens)
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// ============================================
// CSRF PROTECTION
// ============================================

const csrfTokens = new Map<string, { token: string; expiresAt: Date }>();

/**
 * Generate a CSRF token for a session
 */
export function generateCsrfToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    csrfTokens.set(sessionId, { token, expiresAt });

    // Clean up expired tokens periodically
    cleanupExpiredCsrfTokens();

    return token;
}

/**
 * Validate a CSRF token
 */
export function validateCsrfToken(sessionId: string, token: string): boolean {
    const stored = csrfTokens.get(sessionId);
    if (!stored) return false;
    if (stored.expiresAt < new Date()) {
        csrfTokens.delete(sessionId);
        return false;
    }
    return crypto.timingSafeEqual(
        Buffer.from(stored.token),
        Buffer.from(token)
    );
}

function cleanupExpiredCsrfTokens(): void {
    const now = new Date();
    for (const [sessionId, data] of csrfTokens.entries()) {
        if (data.expiresAt < now) {
            csrfTokens.delete(sessionId);
        }
    }
}

// ============================================
// AUDIT LOGGING
// ============================================

export interface AuditLogEntry {
    userId: string;
    tenantId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
}

/**
 * Log a security-relevant action
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
    const logEntry = {
        timestamp: new Date().toISOString(),
        ...entry,
        // Sanitize sensitive data from details
        details: entry.details ? sanitizeAuditDetails(entry.details) : undefined
    };

    // Log to console in structured format
    console.log(JSON.stringify({
        type: 'AUDIT_LOG',
        ...logEntry
    }));

    // SECURITY: Persist to Database for auditing and anomaly detection
    try {
        const resolvedUserId = (entry.userId === 'unknown' || entry.userId === 'anonymous' || entry.userId === 'system' || !entry.userId)
            ? undefined
            : entry.userId;

        let tenantId = entry.tenantId || (entry.details?.tenantId as string | undefined);

        if (!tenantId && resolvedUserId) {
            const user = await prisma.user.findUnique({
                where: { id: resolvedUserId },
                select: { tenantId: true }
            });
            tenantId = user?.tenantId;
        }

        if (!tenantId) {
            console.warn('AUDIT_LOG_SKIPPED: tenantId missing', {
                action: entry.action,
                userId: resolvedUserId
            });
            return;
        }

        await prisma.activityLog.create({
            data: {
                tenantId,
                userId: resolvedUserId,
                action: entry.action,
                entityId: entry.resourceId || 'system',
                entityType: entry.resource,
                metadata: {
                    ip: entry.ipAddress,
                    userAgent: entry.userAgent,
                    success: entry.success,
                    error: entry.errorMessage,
                    ...logEntry.details
                }
            }
        });
    } catch (dbError) {
        console.error('CRITICAL: Failed to persist audit log to database:', dbError);
    }
}

/**
 * Remove sensitive data from audit log details
 */
function sanitizeAuditDetails(details: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn', 'cvv'];
    const sanitized = { ...details };

    for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeAuditDetails(sanitized[key]);
        }
    }

    return sanitized;
}

// ============================================
// INPUT SANITIZATION
// ============================================

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string | null {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const trimmed = email.trim().toLowerCase();

    if (!emailRegex.test(trimmed)) {
        return null;
    }

    return trimmed;
}

// ============================================
// RATE LIMITING HELPERS
// ============================================

import redis from '../redis';

/**
 * Check if an identifier (IP, email) is locked out (shared via Redis)
 */
export async function isLockedOut(identifier: string): Promise<boolean> {
    try {
        const key = `bia:lockout:${identifier}`;
        const recordStr = await redis.get(key);
        if (!recordStr) return false;

        const record = JSON.parse(recordStr);

        if (record.lockedUntil && new Date(record.lockedUntil) > new Date()) {
            return true;
        }

        if (record.lockedUntil && new Date(record.lockedUntil) <= new Date()) {
            await redis.del(key);
        }
    } catch (error) {
        console.error('Lockout Check Error:', error);
    }

    return false;
}

/**
 * Record a failed authentication attempt (shared via Redis)
 */
export async function recordFailedAttempt(identifier: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') return;

    try {
        const key = `bia:lockout:${identifier}`;
        const recordStr = await redis.get(key);
        const record = recordStr ? JSON.parse(recordStr) : { count: 0 };

        record.count++;

        // Lock out after 5 failed attempts
        if (record.count >= 5) {
            record.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minute lockout
        }

        // Store with 30m TTL to cleanup automatically
        await redis.set(key, JSON.stringify(record), 'EX', 1800);
    } catch (error) {
        console.error('Record Failed Attempt Error:', error);
    }
}

/**
 * Clear failed attempts after successful login
 */
export async function clearFailedAttempts(identifier: string): Promise<void> {
    const key = `bia:lockout:${identifier}`;
    await redis.del(key);
}

// ============================================
// SECURE HEADERS
// ============================================

/**
 * Get security headers for responses
 */
export function getSecurityHeaders(): Record<string, string> {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    };
}

// ============================================
// DATA ENCRYPTION
// ============================================

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY is required in production');
}

function getEncryptionKey(): string {
    if (ENCRYPTION_KEY) return ENCRYPTION_KEY;
    // Test-only fallback to preserve local/unit-test ergonomics.
    return 'test_encryption_key_for_local_tests_only';
}

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encryptData(text: string): string {
    const iv = crypto.randomBytes(16);
    const salt = 'bia-platform-salt';
    const key = crypto.scryptSync(getEncryptionKey(), salt, 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decryptData(encryptedText: string): string {
    try {
        const parts = encryptedText.split(':');
        // Handle unencrypted legacy secrets gracefully? No, assume migration or fail safe.
        if (parts.length !== 3) throw new Error('Invalid encryption format');

        const [ivHex, authTagHex, encrypted] = parts;

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const salt = 'bia-platform-salt';
        const key = crypto.scryptSync(getEncryptionKey(), salt, 32);

        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Decryption failed');
    }
}
