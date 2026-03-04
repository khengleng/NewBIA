/**
 * Centralized Permission System - Frontend
 * 
 * Mirrors backend permissions for consistent UI rendering
 * and client-side permission checks
 */

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
    | 'syndicate'
    | 'case'
    | 'onboarding';

/**
 * Centralized Permission Definitions
 * Must match backend permissions exactly
 */
const ADMIN_EQUIVALENT_ROLES: UserRole[] = ['FINOPS', 'CX', 'AUDITOR', 'COMPLIANCE'];

function withAdminEquivalentRoles(source: Record<string, string[]>): Record<string, string[]> {
    const next: Record<string, string[]> = {};

    for (const [permission, roles] of Object.entries(source)) {
        const expanded = [...roles];
        if (roles.includes('ADMIN')) {
            for (const role of ADMIN_EQUIVALENT_ROLES) {
                if (!expanded.includes(role)) expanded.push(role);
            }
        }
        next[permission] = expanded;
    }

    return next;
}

export const PERMISSIONS: Record<string, string[]> = withAdminEquivalentRoles({
    // SME Permissions
    'sme.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR'],
    'sme.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME:owner'],
    'sme.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'sme.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SME:owner'],
    'sme.delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'sme.export': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'sme.certify': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],

    // Investor Permissions
    'investor.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'SME', 'INVESTOR'],
    'investor.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'SME', 'INVESTOR:owner'],
    'investor.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'investor.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR:owner'],
    'investor.delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'investor.export': ['SUPER_ADMIN', 'ADMIN'],

    // Deal Permissions
    'deal.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'deal.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME:owner'],
    'deal.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR'],
    'deal.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR:owner'],
    'deal.delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'deal.approve': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],

    // Document Permissions
    'document.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'document.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME:owner'],
    'document.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SME:owner'],
    'document.update': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SME:owner'],
    'document.delete': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SME:owner'],
    'document.download': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME:owner'],

    // User Permissions
    'user.list': ['SUPER_ADMIN', 'ADMIN'],
    'user.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR:owner', 'INVESTOR:owner', 'SME:owner'],
    'user.create': ['SUPER_ADMIN', 'ADMIN'],
    'user.update': ['SUPER_ADMIN', 'ADMIN'],
    'user.delete': ['SUPER_ADMIN'],

    // Report Permissions
    'report.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'report.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'report.export': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'report.financial': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],
    'report.analytics': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],

    // Settings Permissions
    'settings.read': ['SUPER_ADMIN', 'ADMIN'],
    'settings.update': ['SUPER_ADMIN', 'ADMIN'],
    'settings.system': ['SUPER_ADMIN'],

    // Billing/Admin Operations Permissions
    'admin.read': ['SUPER_ADMIN', 'ADMIN'],
    'billing.read': ['SUPER_ADMIN', 'ADMIN'],
    'billing.manage': ['SUPER_ADMIN', 'ADMIN'],
    'invoice.read': ['SUPER_ADMIN', 'ADMIN'],
    'invoice.manage': ['SUPER_ADMIN', 'ADMIN'],
    'subscription.read': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'subscription.manage': ['SUPER_ADMIN', 'ADMIN'],
    'support_ticket.list': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'support_ticket.read': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'support_ticket.create': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'ADVISOR', 'INVESTOR', 'SME'],
    'support_ticket.update': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'escalation.run': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'case.list': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'case.read': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'case.create': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'case.update': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'case.assign': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'case.escalate': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'onboarding_template.list': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'onboarding_template.read': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'onboarding_template.create': ['SUPER_ADMIN', 'ADMIN'],
    'onboarding_template.update': ['SUPER_ADMIN', 'ADMIN'],
    'onboarding_template.publish': ['SUPER_ADMIN', 'ADMIN'],
    'onboarding_task.list': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'onboarding_task.read': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'onboarding_task.create': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'onboarding_task.update': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'onboarding_task.remind': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    'role_request.create': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'role_request.list': ['SUPER_ADMIN', 'ADMIN'],
    'role_request.review': ['SUPER_ADMIN', 'ADMIN'],
    'role_grant.list': ['SUPER_ADMIN', 'ADMIN'],
    'role_grant.create': ['SUPER_ADMIN', 'ADMIN'],
    'role_grant.revoke': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_ops.read': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_capacity.read': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_capacity.update': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_assignment.list': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_assignment.create': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_assignment.update': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_conflict.list': ['SUPER_ADMIN', 'ADMIN'],
    'advisor_conflict.review': ['SUPER_ADMIN', 'ADMIN'],
    'investor_ops.read': ['SUPER_ADMIN', 'ADMIN'],
    'investor_ops.list': ['SUPER_ADMIN', 'ADMIN'],
    'investor_ops.review': ['SUPER_ADMIN', 'ADMIN'],
    'investor_ops.update': ['SUPER_ADMIN', 'ADMIN'],
    'data_governance.read': ['SUPER_ADMIN', 'ADMIN'],
    'retention_rule.list': ['SUPER_ADMIN', 'ADMIN'],
    'retention_rule.update': ['SUPER_ADMIN', 'ADMIN'],
    'legal_hold.list': ['SUPER_ADMIN', 'ADMIN'],
    'legal_hold.create': ['SUPER_ADMIN', 'ADMIN'],
    'legal_hold.release': ['SUPER_ADMIN', 'ADMIN'],
    'reconciliation.read': ['SUPER_ADMIN', 'ADMIN'],
    'reconciliation.run': ['SUPER_ADMIN', 'ADMIN'],
    'reconciliation.exception.list': ['SUPER_ADMIN', 'ADMIN'],
    'reconciliation.exception.update': ['SUPER_ADMIN', 'ADMIN'],

    // Matchmaking Permissions
    'matchmaking.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
    'matchmaking.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
    'matchmaking.express_interest': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'INVESTOR', 'SME'],
    'matchmaking.create_match': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR'],

    // Syndicate Permissions
    'syndicate.list': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'syndicate.read': ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'],
    'syndicate.create': ['SUPER_ADMIN', 'ADMIN', 'INVESTOR'],
    'syndicate.update': ['SUPER_ADMIN', 'ADMIN', 'INVESTOR:owner'],
    'syndicate.join': ['INVESTOR'],
    'syndicate.approve': ['SUPER_ADMIN', 'ADMIN', 'INVESTOR:owner'],
});

/**
 * Check if a role has a specific permission
 */
export function hasPermission(
    userRole: UserRole | string | undefined,
    permission: string,
    isOwner: boolean = false,
): boolean {
    if (!userRole) return false;

    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) return false;

    // Direct role check
    if (allowedRoles.includes(userRole)) {
        return true;
    }

    // Owner-based check
    if (isOwner && allowedRoles.includes(`${userRole}:owner`)) {
        return true;
    }

    return false;
}

/**
 * Check if role can perform action on resource
 */
export function canPerformAction(
    userRole: UserRole | string | undefined,
    resource: Resource,
    action: PermissionAction,
    isOwner: boolean = false,
): boolean {
    return hasPermission(userRole, `${resource}.${action}`, isOwner);
}

/**
 * User interface for permission checks
 */
export interface User {
    id: string;
    role: UserRole | string;
    email?: string;
    tenantId?: string;
}

/**
 * Permission check helper object
 */
export interface PermissionHelpers {
    // General checks
    hasPermission: (permission: string, isOwner?: boolean) => boolean;
    canPerform: (resource: Resource, action: PermissionAction, isOwner?: boolean) => boolean;

    // Role checks
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isAdvisor: boolean;
    isSupport: boolean;
    isInvestor: boolean;
    isSME: boolean;

    // SME permissions
    canListSMEs: boolean;
    canCreateSME: boolean;
    canEditSME: (isOwner?: boolean) => boolean;
    canDeleteSME: boolean;
    canCertifySME: boolean;

    // Investor permissions
    canListInvestors: boolean;
    canCreateInvestor: boolean;
    canEditInvestor: (isOwner?: boolean) => boolean;
    canDeleteInvestor: boolean;

    // Deal permissions
    canListDeals: boolean;
    canCreateDeal: boolean;
    canEditDeal: (isOwner?: boolean) => boolean;
    canDeleteDeal: boolean;
    canApproveDeal: boolean;

    // Document permissions
    canUploadDocument: (isOwner?: boolean) => boolean;
    canDownloadDocument: (isOwner?: boolean) => boolean;
    canDeleteDocument: (isOwner?: boolean) => boolean;

    // Report permissions
    canViewReports: boolean;
    canExportReports: boolean;
    canViewFinancialReports: boolean;

    // Settings permissions
    canViewSettings: boolean;
    canEditSettings: boolean;
    canAccessSystemSettings: boolean;

    // Matchmaking permissions
    canUseMatchmaking: boolean;
    canExpressInterest: boolean;
    canCreateMatch: boolean;
}

/**
 * Create permission helpers for a user
 */
export function createPermissionHelpers(user: User | null): PermissionHelpers {
    const role = user?.role as UserRole | undefined;

    const check = (permission: string, isOwner: boolean = false) =>
        hasPermission(role, permission, isOwner);

    const canPerform = (resource: Resource, action: PermissionAction, isOwner: boolean = false) =>
        canPerformAction(role, resource, action, isOwner);

    return {
        // General checks
        hasPermission: check,
        canPerform,

        // Role checks
        isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN' || (role ? ADMIN_EQUIVALENT_ROLES.includes(role) : false),
        isSuperAdmin: role === 'SUPER_ADMIN',
        isAdvisor: role === 'ADVISOR',
        isSupport: role === 'SUPPORT',
        isInvestor: role === 'INVESTOR',
        isSME: role === 'SME',

        // SME permissions
        canListSMEs: check('sme.list'),
        canCreateSME: check('sme.create'),
        canEditSME: (isOwner = false) => check('sme.update', isOwner),
        canDeleteSME: check('sme.delete'),
        canCertifySME: check('sme.certify'),

        // Investor permissions
        canListInvestors: check('investor.list'),
        canCreateInvestor: check('investor.create'),
        canEditInvestor: (isOwner = false) => check('investor.update', isOwner),
        canDeleteInvestor: check('investor.delete'),

        // Deal permissions
        canListDeals: check('deal.list'),
        canCreateDeal: check('deal.create'),
        canEditDeal: (isOwner = false) => check('deal.update', isOwner),
        canDeleteDeal: check('deal.delete'),
        canApproveDeal: check('deal.approve'),

        // Document permissions
        canUploadDocument: (isOwner = false) => check('document.create', isOwner),
        canDownloadDocument: (isOwner = false) => check('document.download', isOwner),
        canDeleteDocument: (isOwner = false) => check('document.delete', isOwner),

        // Report permissions
        canViewReports: check('report.list'),
        canExportReports: check('report.export'),
        canViewFinancialReports: check('report.financial'),

        // Settings permissions
        canViewSettings: check('settings.read'),
        canEditSettings: check('settings.update'),
        canAccessSystemSettings: check('settings.system'),

        // Matchmaking permissions
        canUseMatchmaking: check('matchmaking.list'),
        canExpressInterest: check('matchmaking.express_interest'),
        canCreateMatch: check('matchmaking.create_match'),
    };
}

export default {
    PERMISSIONS,
    hasPermission,
    canPerformAction,
    createPermissionHelpers,
};
