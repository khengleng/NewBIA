/**
 * Centralized Permission System
 * 
 * Best Practice RBAC implementation with:
 * - Centralized permission definitions
 * - Role hierarchy with inheritance
 * - Resource-level permissions
 * - Owner-based access control
 * - Audit logging support
 */
import { normalizeRole } from './roles';

// Role types
export type UserRole =
    | 'SUPER_ADMIN'
    | 'ADMIN'
    | 'FINOPS'
    | 'CX'
    | 'AUDITOR'
    | 'COMPLIANCE'
    | 'ADVISOR'
    | 'SUPPORT'
    | 'INVESTOR'
    | 'SME';

// Permission action types
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'list' | 'export' | 'certify' | 'approve';

// Resource types
export type Resource =
    | 'sme'
    | 'investor'
    | 'advisor'
    | 'deal'
    | 'document'
    | 'user'
    | 'tenant'
    | 'workflow'
    | 'certification'
    | 'report'
    | 'settings'
    | 'audit_log'
    | 'matchmaking'
    | 'advisory_service'
    | 'syndicate'
    | 'secondary_trading'
    | 'notification'
    | 'analytics'
    | 'payment'
    | 'dataroom'
    | 'due_diligence'
    | 'community'
    | 'dispute'
    | 'case'
    | 'onboarding'
    | 'admin';

// Special permission modifiers
const OWNER_SUFFIX = ':owner';

/**
 * Role Hierarchy - Higher roles inherit permissions from lower roles
 */
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
    SUPER_ADMIN: ['ADMIN', 'FINOPS', 'CX', 'AUDITOR', 'COMPLIANCE', 'ADVISOR', 'SUPPORT'], // Inherits all operator roles
    ADMIN: ['ADVISOR', 'SUPPORT'],                  // Inherits advisory and support baseline
    FINOPS: [],                                     // Least-privilege: explicit permissions only
    CX: [],                                         // Least-privilege: explicit permissions only
    AUDITOR: [],                                    // Least-privilege: explicit permissions only
    COMPLIANCE: [],                                 // Least-privilege: explicit permissions only
    ADVISOR: [],                                    // Base advisory role
    SUPPORT: [],                                    // Read-only role
    INVESTOR: [],                                   // Resource owner role
    SME: [],                                        // Resource owner role
};

/**
 * Centralized Permission Definitions
 * 
 * Format: 'resource.action': [roles that have this permission]
 * Use ':owner' suffix for owner-only access
 */
export const PERMISSIONS: Record<string, string[]> = {
    // ==================== SME Permissions ====================
    'sme.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'sme.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME:owner'],
    'sme.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'sme.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SME:owner'],
    'sme.delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'sme.export': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'sme.certify': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],

    // ==================== Investor Permissions ====================
    'investor.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'SME', 'INVESTOR'],
    'investor.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'SME', 'INVESTOR:owner'],
    'investor.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'investor.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR:owner'],
    'investor.delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'investor.verify': ['SUPER_ADMIN', 'ADMIN'],
    'investor.export': ['SUPER_ADMIN', 'ADMIN'],

    // ==================== Advisor Permissions ====================
    'advisor.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT'],
    'advisor.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner', 'SUPPORT'],
    'advisor.create': ['SUPER_ADMIN', 'ADMIN'],
    'advisor.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner'],
    'advisor.delete': ['SUPER_ADMIN', 'ADMIN'],

    // ==================== Deal Permissions ====================
    'deal.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'deal.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME:owner'],
    'deal.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR'],
    'deal.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR:owner', 'SME:owner'],
    'deal.delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'deal.approve': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],

    // ==================== Document Permissions ====================
    'document.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'document.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME:owner'],
    'document.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SME:owner'],
    'document.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SME:owner'],
    'document.delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SME:owner'],
    'document.download': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME:owner'],

    // ==================== User Permissions ====================
    'user.list': ['SUPER_ADMIN', 'ADMIN'],
    'user.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner', 'INVESTOR:owner', 'SME:owner'],
    'user.create': ['SUPER_ADMIN', 'ADMIN'],
    'user.update': ['SUPER_ADMIN', 'ADMIN'],
    'user.delete': ['SUPER_ADMIN'],
    'user.suspend': ['SUPER_ADMIN', 'ADMIN'],

    // ==================== Tenant Permissions ====================
    'tenant.list': ['SUPER_ADMIN'],
    'tenant.read': ['SUPER_ADMIN', 'ADMIN'],
    'tenant.create': ['SUPER_ADMIN'],
    'tenant.update': ['SUPER_ADMIN'],
    'tenant.delete': ['SUPER_ADMIN'],

    // ==================== Workflow Permissions ====================
    'workflow.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT'],
    'workflow.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'SME:owner', 'INVESTOR:owner'],
    'workflow.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'workflow.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'workflow.approve': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],

    // ==================== Certification Permissions ====================
    'certification.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT'],
    'certification.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'SME:owner'],
    'certification.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'certification.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'certification.approve': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],

    // ==================== Report Permissions ====================
    'report.list': ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX', 'ADVISOR', 'INVESTOR', 'SME'],
    'report.read': ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX', 'ADVISOR', 'INVESTOR', 'SME'],
    'report.create': ['SUPER_ADMIN', 'ADMIN', 'FINOPS'],
    'report.export': ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX', 'ADVISOR', 'INVESTOR', 'SME'],
    'report.financial': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'report.analytics': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],

    // ==================== Settings Permissions ====================
    'settings.read': ['SUPER_ADMIN', 'ADMIN'],
    'settings.update': ['SUPER_ADMIN', 'ADMIN'],
    'settings.system': ['SUPER_ADMIN'],

    // ==================== Audit Log Permissions ====================
    'audit_log.list': ['SUPER_ADMIN', 'ADMIN'],
    'audit_log.read': ['SUPER_ADMIN', 'ADMIN'],
    'audit_log.export': ['SUPER_ADMIN'],

    // ==================== Matchmaking Permissions ====================
    'matchmaking.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
    'matchmaking.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
    'matchmaking.express_interest': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
    'matchmaking.create_match': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],

    // ==================== Advisory Service Permissions ====================
    'advisory_service.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'advisory_service.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'advisory_service.create': ['SUPER_ADMIN', 'ADVISOR'],
    'advisory_service.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner'],
    'advisory_service.delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner'],
    'advisory_service.manage': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],

    // ==================== Syndicate Permissions ====================
    'syndicate.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'syndicate.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'syndicate.create': ['SUPER_ADMIN', 'ADMIN', 'INVESTOR'],
    'syndicate.update': ['SUPER_ADMIN', 'ADMIN', 'INVESTOR'],
    'syndicate.join': ['SUPER_ADMIN', 'ADMIN', 'INVESTOR'],
    'syndicate.manage': ['SUPER_ADMIN', 'ADMIN', 'INVESTOR'],

    // ==================== Secondary Trading Permissions ====================
    'secondary_trading.list': ['SUPPORT', 'INVESTOR', 'SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX', 'AUDITOR', 'COMPLIANCE'],
    'secondary_trading.read': ['SUPPORT', 'INVESTOR', 'SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX', 'AUDITOR', 'COMPLIANCE'],
    'secondary_trading.create_listing': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE'],
    'secondary_trading.update_listing': ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX', 'AUDITOR', 'COMPLIANCE', 'SUPPORT'],
    'secondary_trading.buy': ['INVESTOR'],
    'secondary_trading.execute': ['SUPER_ADMIN'],

    // ==================== Notification Permissions ====================
    'notification.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'notification.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'notification.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner', 'INVESTOR:owner', 'SME:owner'],
    'notification.delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner', 'INVESTOR:owner', 'SME:owner'],
    'notification.broadcast': ['SUPER_ADMIN', 'ADMIN'],

    // ==================== Analytics Permissions ====================
    'analytics.read': ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX', 'AUDITOR', 'ADVISOR'],
    'analytics.financial': ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'AUDITOR'],
    'analytics.system': ['SUPER_ADMIN'],

    // ==================== Dashboard/Calendar Permissions ====================
    'dashboard.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
    'calendar.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
    'calendar.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
    'calendar.delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],

    // ==================== Payment Permissions ====================
    'payment.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner', 'INVESTOR:owner', 'SME:owner'],
    'payment.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner', 'INVESTOR:owner', 'SME:owner'],
    'payment.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
    'payment.refund': ['SUPER_ADMIN', 'ADMIN'],
    'billing.read': ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'AUDITOR'],
    'billing.manage': ['SUPER_ADMIN', 'ADMIN', 'FINOPS'],
    'invoice.read': ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'AUDITOR'],
    'invoice.manage': ['SUPER_ADMIN', 'ADMIN', 'FINOPS'],
    'subscription.read': ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'SUPPORT', 'CX'],
    'subscription.manage': ['SUPER_ADMIN', 'ADMIN'],
    'wallet.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner', 'INVESTOR:owner', 'SME:owner'],
    'wallet.manage': ['SUPER_ADMIN', 'ADMIN', 'FINOPS'],
    'support_ticket.list': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],
    'support_ticket.read': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],
    'support_ticket.create': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ADVISOR', 'INVESTOR', 'SME'],
    'support_ticket.update': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],
    'escalation.run': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],

    // ==================== Dataroom Permissions ====================
    'dataroom.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'dataroom.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'dataroom.upload': ['SUPER_ADMIN', 'ADMIN', 'SME:owner', 'ADVISOR'],
    'dataroom.delete': ['SUPER_ADMIN', 'ADMIN', 'SME:owner'],
    'dataroom.manage': ['SUPER_ADMIN', 'ADMIN', 'SME:owner'],

    // ==================== Due Diligence Permissions ====================
    'due_diligence.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'due_diligence.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'due_diligence.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'due_diligence.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner'],
    'due_diligence.manage': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],

    // ==================== Community Permissions ====================
    'community.post_list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'community.post_read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'community.post_create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
    'community.post_update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner', 'INVESTOR:owner', 'SME:owner'],
    'community.post_delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner', 'INVESTOR:owner', 'SME:owner'],
    'community.comment_create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
    'community.comment_update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner', 'INVESTOR:owner', 'SME:owner'],
    'community.comment_delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner', 'INVESTOR:owner', 'SME:owner'],
    'community.manage': ['SUPER_ADMIN', 'ADMIN'],

    // ==================== AI Permissions ====================
    'ai.chat': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],

    // ==================== Dispute Permissions ====================
    'dispute.list': ['SUPER_ADMIN', 'ADMIN', 'INVESTOR:owner', 'SME:owner'],
    'dispute.read': ['SUPER_ADMIN', 'ADMIN', 'INVESTOR:owner', 'SME:owner'],
    'dispute.update': ['SUPER_ADMIN', 'ADMIN'],
    'dispute.delete': ['SUPER_ADMIN'],

    // ==================== Unified Case Management Permissions ====================
    'case.list': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX', 'COMPLIANCE'],
    'case.read': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX', 'COMPLIANCE'],
    'case.create': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],
    'case.update': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX', 'COMPLIANCE'],
    'case.assign': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],
    'case.escalate': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX', 'COMPLIANCE'],

    // ==================== Onboarding Orchestration Permissions ====================
    'onboarding_template.list': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],
    'onboarding_template.read': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],
    'onboarding_template.create': ['SUPER_ADMIN', 'ADMIN'],
    'onboarding_template.update': ['SUPER_ADMIN', 'ADMIN'],
    'onboarding_template.publish': ['SUPER_ADMIN', 'ADMIN'],
    'onboarding_task.list': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],
    'onboarding_task.read': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],
    'onboarding_task.create': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],
    'onboarding_task.update': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],
    'onboarding_task.remind': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'CX'],

    // ==================== Role Lifecycle Controls ====================
    'role_request.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'role_request.list': ['SUPER_ADMIN', 'ADMIN'],
    'role_request.review': ['SUPER_ADMIN', 'ADMIN'],
    'role_grant.list': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'AUDITOR'],
    'role_grant.create': ['SUPER_ADMIN', 'ADMIN'],
    'role_grant.revoke': ['SUPER_ADMIN', 'ADMIN'],

    // ==================== Advisor Operations Hub Permissions ====================
    'advisor_ops.read': ['SUPER_ADMIN', 'ADMIN', 'CX'],
    'advisor_capacity.read': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_capacity.update': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_assignment.list': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_assignment.create': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_assignment.update': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_conflict.list': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_conflict.review': ['SUPER_ADMIN', 'ADMIN'],
    'investor_ops.read': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'CX'],
    'investor_ops.list': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'CX'],
    'investor_ops.review': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE'],
    'investor_ops.update': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE'],
    'data_governance.read': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'AUDITOR'],
    'retention_rule.list': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'AUDITOR'],
    'retention_rule.update': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE'],
    'legal_hold.list': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'AUDITOR'],
    'legal_hold.create': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE'],
    'legal_hold.release': ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE'],
    'reconciliation.read': ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'AUDITOR'],
    'reconciliation.run': ['SUPER_ADMIN', 'ADMIN', 'FINOPS'],
    'reconciliation.exception.list': ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'AUDITOR'],
    'reconciliation.exception.update': ['SUPER_ADMIN', 'ADMIN', 'FINOPS'],

    // ==================== Admin Permissions ====================
    'admin.read': ['SUPER_ADMIN', 'ADMIN'],
    'admin.dashboard_view': ['SUPER_ADMIN', 'ADMIN'],
    'admin.user_manage': ['SUPER_ADMIN', 'ADMIN'],
    'admin.tenant_manage': ['SUPER_ADMIN'],
    'admin.system_config': ['SUPER_ADMIN'],
};

/**
 * Permission context for checking access
 */
export interface PermissionContext {
    userId: string;
    userRole: UserRole | string;
    tenantId?: string;
    resourceOwnerId?: string;
    resourceId?: string;
}

/**
 * Check if a user has a specific permission
 * 
 * @param ctx - Permission context with user info
 * @param permission - Permission string (e.g., 'sme.create')
 * @returns boolean indicating if user has permission
 */
export function hasPermission(ctx: PermissionContext, permission: string): boolean {
    const { userId, userRole, resourceOwnerId } = ctx;
    const normalizedUserRole = normalizeRole(userRole) as UserRole;
    if (!normalizedUserRole) {
        return false;
    }

    // Get allowed roles for this permission
    const allowedRoles = PERMISSIONS[permission];

    if (!allowedRoles) {
        console.warn(`Unknown permission: ${permission}`);
        return false;
    }

    // Check if user's role (or inherited roles) have direct permission
    if (allowedRoles.includes(normalizedUserRole)) {
        return true;
    }

    // Check inherited roles
    const inheritedRoles = getInheritedRoles(normalizedUserRole);
    for (const inheritedRole of inheritedRoles) {
        if (allowedRoles.includes(inheritedRole)) {
            return true;
        }
    }

    // Check owner-based permission
    if (resourceOwnerId && resourceOwnerId === userId) {
        const ownerPermission = `${normalizedUserRole}${OWNER_SUFFIX}`;
        if (allowedRoles.includes(ownerPermission)) {
            return true;
        }
    }

    return false;
}

/**
 * Get all roles that a user inherits from
 */
export function getInheritedRoles(role: UserRole): UserRole[] {
    const inherited: UserRole[] = [];
    const directInheritance = ROLE_HIERARCHY[role] || [];

    for (const inheritedRole of directInheritance) {
        inherited.push(inheritedRole);
        // Recursively get inherited roles
        inherited.push(...getInheritedRoles(inheritedRole));
    }

    return [...new Set(inherited)]; // Remove duplicates
}

/**
 * Check if a role can perform an action on a resource
 * Convenience function for common checks
 */
export function canPerformAction(
    userRole: UserRole | string,
    resource: Resource,
    action: PermissionAction,
    isOwner: boolean = false,
    userId?: string
): boolean {
    const permission = `${resource}.${action}`;
    return hasPermission({
        userId: userId || '',
        userRole,
        resourceOwnerId: isOwner ? userId : undefined,
    }, permission);
}

/**
 * Get all permissions for a specific role
 */
export function getPermissionsForRole(role: UserRole): string[] {
    const normalizedRole = normalizeRole(role) as UserRole;
    if (!normalizedRole) return [];

    const permissions: string[] = [];

    for (const [permission, allowedRoles] of Object.entries(PERMISSIONS)) {
        // Direct permission
        if (allowedRoles.includes(normalizedRole)) {
            permissions.push(permission);
            continue;
        }

        // Inherited permission
        const inherited = getInheritedRoles(normalizedRole);
        if (inherited.some(r => allowedRoles.includes(r))) {
            permissions.push(permission);
            continue;
        }

        // Owner permission
        if (allowedRoles.includes(`${normalizedRole}${OWNER_SUFFIX}`)) {
            permissions.push(`${permission} (owner only)`);
        }
    }

    return permissions;
}

/**
 * Permission check result with details
 */
export interface PermissionCheckResult {
    allowed: boolean;
    permission: string;
    reason: 'direct' | 'inherited' | 'owner' | 'denied';
    checkedAt: Date;
}

/**
 * Detailed permission check with logging support
 */
export function checkPermissionDetailed(
    ctx: PermissionContext,
    permission: string
): PermissionCheckResult {
    const { userId, userRole, resourceOwnerId } = ctx;
    const normalizedUserRole = normalizeRole(userRole) as UserRole;
    if (!normalizedUserRole) {
        return {
            allowed: false,
            permission,
            reason: 'denied',
            checkedAt: new Date(),
        };
    }
    const allowedRoles = PERMISSIONS[permission] || [];

    // Direct role check
    if (allowedRoles.includes(normalizedUserRole)) {
        return {
            allowed: true,
            permission,
            reason: 'direct',
            checkedAt: new Date(),
        };
    }

    // Inherited role check
    const inheritedRoles = getInheritedRoles(normalizedUserRole);
    for (const inheritedRole of inheritedRoles) {
        if (allowedRoles.includes(inheritedRole)) {
            return {
                allowed: true,
                permission,
                reason: 'inherited',
                checkedAt: new Date(),
            };
        }
    }

    // Owner check
    if (resourceOwnerId && resourceOwnerId === userId) {
        const ownerPermission = `${normalizedUserRole}${OWNER_SUFFIX}`;
        if (allowedRoles.includes(ownerPermission)) {
            return {
                allowed: true,
                permission,
                reason: 'owner',
                checkedAt: new Date(),
            };
        }
    }

    return {
        allowed: false,
        permission,
        reason: 'denied',
        checkedAt: new Date(),
    };
}

/**
 * Export permission groups for UI
 */
export const PERMISSION_GROUPS = {
    SME_MANAGEMENT: ['sme.list', 'sme.read', 'sme.create', 'sme.update', 'sme.delete', 'sme.certify'],
    INVESTOR_MANAGEMENT: ['investor.list', 'investor.read', 'investor.create', 'investor.update', 'investor.delete'],
    DEAL_MANAGEMENT: ['deal.list', 'deal.read', 'deal.create', 'deal.update', 'deal.delete', 'deal.approve'],
    DOCUMENT_MANAGEMENT: ['document.list', 'document.read', 'document.create', 'document.delete', 'document.download'],
    USER_MANAGEMENT: ['user.list', 'user.read', 'user.create', 'user.update', 'user.delete'],
    SYSTEM_SETTINGS: ['settings.read', 'settings.update', 'settings.system'],
    REPORTS: ['report.list', 'report.read', 'report.export', 'report.financial', 'report.analytics'],
    MATCHMAKING: ['matchmaking.list', 'matchmaking.read', 'matchmaking.express_interest', 'matchmaking.create_match'],
};

export default {
    PERMISSIONS,
    ROLE_HIERARCHY,
    PERMISSION_GROUPS,
    hasPermission,
    canPerformAction,
    getPermissionsForRole,
    checkPermissionDetailed,
    getInheritedRoles,
};
