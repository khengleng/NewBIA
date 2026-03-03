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
        role: UserRole;
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

    // Keep only last 10000 entries in memory
    if (auditLog.length > 10000) {
        auditLog.shift();
    }

    // Log denied attempts for security monitoring
    if (entry.result === 'denied') {
        console.warn(`[PERMISSION DENIED] User ${entry.userId} (${entry.userRole}) attempted ${entry.permission}`, {
            resourceId: entry.resourceId,
            timestamp: entry.timestamp,
            ip: entry.ipAddress,
        });
    }
}

/**
 * Get audit logs (for admin access)
 */
export function getAuditLogs(filters?: {
    userId?: string;
    permission?: string;
    result?: 'allowed' | 'denied';
    since?: Date;
}): AuditLogEntry[] {
    let logs = [...auditLog];

    if (filters?.userId) {
        logs = logs.filter(l => l.userId === filters.userId);
    }
    if (filters?.permission) {
        logs = logs.filter(l => l.permission.includes(filters.permission as string));
    }
    if (filters?.result) {
        logs = logs.filter(l => l.result === filters.result);
    }
    if (filters?.since) {
        logs = logs.filter(l => l.timestamp >= (filters.since as Date));
    }

    return logs;
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
 * @param permission - Permission string (e.g., 'sme.create', 'deal.update')
 * @param options - Additional options for permission check
 */
export function authorize(
    permission: string,
    options: {
        /** Extract resource owner ID from request params */
        ownerIdParam?: string;
        /** Extract resource owner ID from request body */
        ownerIdBody?: string;
        /** Custom function to get owner ID (can be async) */
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
        } else if (options.ownerIdParam && req.params[options.ownerIdParam]) {
            resourceOwnerId = req.params[options.ownerIdParam];
        } else if (options.ownerIdBody && req.body?.[options.ownerIdBody]) {
            resourceOwnerId = req.body[options.ownerIdBody];
        }

        // Get resource ID for logging
        const resourceId = req.params.id || req.body?.id;

        // Build permission context
        const ctx: PermissionContext = {
            userId,
            userRole,
            tenantId,
            resourceOwnerId,
            resourceId,
        };

        // Store context for later use in request handlers
        req.permissionContext = ctx;

        // Perform detailed permission check
        const checkResult = checkPermissionDetailed(ctx, permission);

        // Create audit log entry
        const auditEntry: AuditLogEntry = {
            timestamp: new Date(),
            userId,
            userRole,
            permission,
            resourceId,
            resourceOwnerId,
            result: checkResult.allowed ? 'allowed' : 'denied',
            reason: checkResult.reason,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('User-Agent'),
        };

        // Log permission check
        if (options.logAllChecks || !checkResult.allowed) {
            logPermissionCheck(auditEntry);
        }

        if (!checkResult.allowed) {
            // Fallback: check active temporary role grants (expiresAt enforced at query time).
            let grantMatch: Array<{ id: string; role: string; expiresAt: Date }> = [];
            const now = Date.now();
            const canLookupTempGrants = process.env.NODE_ENV !== 'test' && now >= skipTempGrantLookupUntil;
            if (canLookupTempGrants) {
                try {
                    grantMatch = await prisma.temporaryRoleGrant.findMany({
                        where: {
                            tenantId,
                            userId,
                            status: 'ACTIVE',
                            expiresAt: { gt: new Date() }
                        },
                        select: { id: true, role: true, expiresAt: true }
                    });
                } catch (error) {
                    // Fail closed and back off repeated DB lookups for denied paths.
                    skipTempGrantLookupUntil = Date.now() + 30_000;
                    console.warn('[AUTHZ] Temporary role grant lookup failed; denying by default', {
                        userId,
                        permission,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        backoffMs: 30_000
                    });
                }
            }

            let granted = false;
            let grantedRole: UserRole | undefined;
            for (const grant of grantMatch) {
                const grantedResult = checkPermissionDetailed(
                    { ...ctx, userRole: grant.role as UserRole },
                    permission
                );
                if (grantedResult.allowed) {
                    granted = true;
                    grantedRole = grant.role as UserRole;
                    break;
                }
            }

            if (!granted) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    code: 'PERMISSION_DENIED',
                    required: permission,
                    reason: checkResult.reason,
                });
            }

            if (options.logAllChecks) {
                logPermissionCheck({
                    ...auditEntry,
                    result: 'allowed',
                    reason: `temporary_grant:${grantedRole || 'unknown'}`
                });
            }
        }

        next();
        return;
    };
}

/**
 * Middleware to check multiple permissions (any match)
 */
export function authorizeAny(permissions: string[]) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        const ctx: PermissionContext = {
            userId: req.user.id,
            userRole: req.user.role,
            tenantId: req.user.tenantId,
        };

        // Check if any permission is granted
        for (const permission of permissions) {
            if (hasPermission(ctx, permission)) {
                req.permissionContext = ctx;
                return next();
            }
        }

        return res.status(403).json({
            error: 'Insufficient permissions',
            code: 'PERMISSION_DENIED',
            required: permissions,
        });
    };
}

/**
 * Middleware to check multiple permissions (all must match)
 */
export function authorizeAll(permissions: string[]) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        const ctx: PermissionContext = {
            userId: req.user.id,
            userRole: req.user.role,
            tenantId: req.user.tenantId,
        };

        // Check if all permissions are granted
        const missingPermissions: string[] = [];
        for (const permission of permissions) {
            if (!hasPermission(ctx, permission)) {
                missingPermissions.push(permission);
            }
        }

        if (missingPermissions.length > 0) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                code: 'PERMISSION_DENIED',
                missing: missingPermissions,
            });
        }

        req.permissionContext = ctx;
        next();
        return;
    };
}

/**
 * Check if user is the owner of a resource
 */
export function requireOwnership(ownerIdField: string = 'userId') {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        // Get owner ID from request body
        const ownerId = req.body?.[ownerIdField];

        // Super admins and admins can bypass ownership check
        if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
            return next();
        }

        // Check ownership
        if (ownerId && ownerId !== req.user.id) {
            return res.status(403).json({
                error: 'You can only modify your own resources',
                code: 'OWNERSHIP_REQUIRED',
            });
        }

        next();
        return;
    };
}

/**
 * Role check middleware (for backward compatibility)
 */
export function requireRole(allowedRoles: UserRole[]) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient role',
                code: 'ROLE_DENIED',
                required: allowedRoles,
                current: req.user.role,
            });
        }

        next();
        return;
    };
}

export default {
    authorize,
    authorizeAny,
    authorizeAll,
    requireOwnership,
    requireRole,
    getAuditLogs,
};
