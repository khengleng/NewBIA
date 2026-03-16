/**
 * Enhanced Authorization Middleware
 * 
 * Uses the centralized permission system for consistent access control
 */

import { Request, Response, NextFunction } from 'express';
import {
    hasPermission,
    checkPermissionDetailed,
    PermissionContext,
    UserRole
} from '../lib/permissions';
import { prisma } from '../database';

// Extended request interface
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        tenantId: string;
        email: string;
        role: UserRole | string;
        did?: string;
    };
    tenantId?: string;
    permissionContext?: PermissionContext;
}

/**
 * Audit log entry for permission checks
 */
interface AuditLogEntry {
    timestamp: Date;
    userId: string;
    userRole: string;
    permission: string;
    resourceId?: string;
    resourceOwnerId?: string;
    result: 'allowed' | 'denied';
    reason: string;
    ipAddress?: string;
    userAgent?: string;
}

// In-memory audit log (replace with database in production)
const auditLog: AuditLogEntry[] = [];
let skipTempGrantLookupUntil = 0;

/**
 * Log permission check for audit
 */
function logPermissionCheck(entry: AuditLogEntry): void {
    auditLog.push(entry);

    // Keep only last 1000 entries in memory
    if (auditLog.length > 1000) {
        auditLog.shift();
    }

    // Log denied attempts for security monitoring
    if (entry.result === 'denied') {
        console.warn(`[PERMISSION DENIED] User ${entry.userId} (${entry.userRole}) attempted ${entry.permission}`, {
            resourceId: entry.resourceId,
            timestamp: entry.timestamp,
        });
    }
}

/**
 * Get audit logs (for admin access)
 */
export function getAuditLogs(): AuditLogEntry[] {
    return [...auditLog];
}

/**
 * Clear in-memory audit logs (used by tests)
 */
export function clearAuditLogs(): void {
    auditLog.length = 0;
}

/**
 * Enhanced authorize middleware using centralized permissions
 * 
 * @param permission - Permission string (e.g., 'wallet.read')
 * @param options - Additional options for permission check
 */
export function authorize(
    permission: string,
    options: {
        /** Custom function to get owner ID */
        getOwnerId?: (req: AuthenticatedRequest) => string | undefined | Promise<string | undefined>;
        /** Log all permission checks (not just denials) */
        logAllChecks?: boolean;
    } = {}
) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        // Ensure user is authenticated
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        const { id: userId, role: userRole, tenantId } = req.user;

        // Determine resource owner ID
        let resourceOwnerId: string | undefined;

        if (options.getOwnerId) {
            resourceOwnerId = await options.getOwnerId(req);
        }

        // Build permission context
        const ctx: PermissionContext = {
            userId,
            userRole: userRole as UserRole,
            tenantId,
            resourceOwnerId,
        };

        // Perform detailed permission check
        const checkResult = checkPermissionDetailed(ctx, permission);

        // Create audit log entry
        const auditEntry: AuditLogEntry = {
            timestamp: new Date(),
            userId,
            userRole: String(userRole),
            permission,
            resourceOwnerId,
            result: checkResult.allowed ? 'allowed' : 'denied',
            reason: checkResult.reason,
            ipAddress: req.ip || (req.connection as any)?.remoteAddress,
            userAgent: req.get('User-Agent'),
        };

        // Log permission check
        if (options.logAllChecks || !checkResult.allowed) {
            logPermissionCheck(auditEntry);
        }

        if (!checkResult.allowed) {
            // Fallback: check active temporary role grants
            const now = Date.now();
            if (now >= skipTempGrantLookupUntil) {
                try {
                    const grants = await prisma.temporaryRoleGrant.findMany({
                        where: {
                            tenantId,
                            userId,
                            status: 'ACTIVE',
                            expiresAt: { gt: new Date() }
                        }
                    });

                    for (const grant of grants) {
                        const grantResult = checkPermissionDetailed(
                            { ...ctx, userRole: grant.role as UserRole },
                            permission
                        );
                        if (grantResult.allowed) {
                            next();
                            return;
                        }
                    }
                } catch (error) {
                    skipTempGrantLookupUntil = Date.now() + 30000;
                    console.error('[AUTH] Temporary grant lookup failed:', error);
                }
            }

            return res.status(403).json({
                error: 'Insufficient permissions',
                code: 'PERMISSION_DENIED',
                required: permission,
                reason: checkResult.reason,
            });
        }

        next();
    };
}

export function authorizeAny(permissions: string[]) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const ctx: PermissionContext = {
            userId: req.user.id,
            userRole: req.user.role as UserRole,
            tenantId: req.user.tenantId,
        };

        for (const permission of permissions) {
            if (hasPermission(ctx, permission)) {
                return next();
            }
        }

        // Fallback for temporary grants
        const now = Date.now();
        if (now >= skipTempGrantLookupUntil) {
            try {
                const grants = await prisma.temporaryRoleGrant.findMany({
                    where: {
                        tenantId: req.user.tenantId,
                        userId: req.user.id,
                        status: 'ACTIVE',
                        expiresAt: { gt: new Date() }
                    }
                });

                for (const grant of grants) {
                    const tempCtx = { ...ctx, userRole: grant.role as UserRole };
                    for (const permission of permissions) {
                        if (hasPermission(tempCtx, permission)) {
                            return next();
                        }
                    }
                }
            } catch (error) {
                skipTempGrantLookupUntil = Date.now() + 30000;
            }
        }

        return res.status(403).json({
            error: 'Insufficient permissions',
            code: 'PERMISSION_DENIED',
            required: permissions,
        });
    }
}

export default {
    authorize,
    authorizeAny,
    getAuditLogs,
    clearAuditLogs,
};
