import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthenticatedRequest, authorize, getAuditLogs } from '../middleware/authorize';
import { prisma } from '../database';
import { canModifyAcrossTenant, isAllowedStatusTransition } from '../utils/admin-guards';
import { checkPermissionDetailed, getPermissionsForRole, PERMISSIONS, UserRole } from '../lib/permissions';
import { clearFailedAttempts, sanitizeEmail } from '../utils/security';
import { normalizeRole } from '../lib/roles';

const router = Router();

const RBAC_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX', 'AUDITOR', 'COMPLIANCE', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'];

function isSuperAdminRole(role: string | null | undefined): boolean {
    return normalizeRole(role) === 'SUPER_ADMIN';
}

// ==================== User Management ====================

// List users
router.get('/users', authorize('admin.user_manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const status = req.query.status as string;
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

        const where: any = {
            status: { not: 'DELETED' }
        };

        if (!isSuperAdmin) {
            where.tenantId = tenantId;
        }

        if (status) {
            where.status = status;
        }

        const users = await prisma.user.findMany({
            where,
            include: {
                sme: { select: { id: true, name: true, status: true } },
                investor: { select: { id: true, name: true, kycStatus: true } },
                advisor: { select: { id: true, name: true, status: true } },
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user status
router.put('/users/:userId/status', authorize('admin.user_manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { userId } = req.params;
        const { status } = req.body; // ACTIVE, INACTIVE, SUSPENDED
        const tenantId = req.user?.tenantId || 'default';
        const requesterId = req.user?.id;
        const actorRole = normalizeRole(req.user?.role);
        const allowedStatuses = new Set(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED']);

        if (!status || !allowedStatuses.has(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!canModifyAcrossTenant(req.user?.role, tenantId, targetUser.tenantId)) {
            return res.status(403).json({ error: 'Cannot modify user from another tenant' });
        }

        // Privilege boundary: only SUPER_ADMIN can modify SUPER_ADMIN accounts.
        if (isSuperAdminRole(targetUser.role) && actorRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Only SUPER_ADMIN can modify SUPER_ADMIN accounts' });
        }

        if (!isAllowedStatusTransition(targetUser.status as any, status)) {
            return res.status(400).json({
                error: 'Cannot reactivate a deleted user. Create a new account or use a dedicated restore workflow.'
            });
        }

        if (requesterId && requesterId === userId && status === 'DELETED') {
            return res.status(400).json({ error: 'You cannot delete your own account from this endpoint' });
        }

        let user;
        if (status === 'DELETED') {
            const archivedEmail = targetUser.email.toLowerCase().includes('deleted_')
                ? targetUser.email
                : `deleted_${Date.now()}_${targetUser.id}_${targetUser.email}`;

            user = await prisma.$transaction(async (tx) => {
                const updatedUser = await tx.user.update({
                    where: { id: userId },
                    data: {
                        status: 'DELETED' as any,
                        email: archivedEmail
                    }
                });

                await tx.sME.updateMany({
                    where: { userId },
                    data: { status: 'DELETED' as any }
                });
                await tx.investor.updateMany({
                    where: { userId },
                    data: { status: 'DELETED' as any }
                });
                await tx.advisor.updateMany({
                    where: { userId },
                    data: { status: 'DELETED' as any }
                });

                return updatedUser;
            });
        } else {
            user = await prisma.user.update({
                where: { id: userId },
                data: { status }
            });
        }

        return res.json({ message: `User status updated to ${status}`, user });
    } catch (error) {
        console.error('Error updating user status:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user role
router.put('/users/:userId/role', authorize('admin.user_manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        const tenantId = req.user?.tenantId || 'default';
        const actorRole = normalizeRole(req.user?.role);
        const targetRole = normalizeRole(role);

        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!canModifyAcrossTenant(req.user?.role, tenantId, targetUser.tenantId)) {
            return res.status(403).json({ error: 'Cannot modify user from another tenant' });
        }

        // Privilege boundary: only SUPER_ADMIN can modify SUPER_ADMIN accounts.
        if (isSuperAdminRole(targetUser.role) && actorRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Only SUPER_ADMIN can modify SUPER_ADMIN accounts' });
        }

        // Privilege boundary: only SUPER_ADMIN can assign SUPER_ADMIN role.
        if (targetRole === 'SUPER_ADMIN' && actorRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Only SUPER_ADMIN can assign SUPER_ADMIN role' });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { role: targetRole as any }
        });

        return res.json({ message: `User role updated to ${role}`, user });
    } catch (error) {
        console.error('Error updating user role:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new user (Admin only)
router.post('/users', authorize('admin.user_manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { email, password, firstName, lastName, role } = req.body;
        const actorRole = normalizeRole(req.user?.role);
        const normalizedRole = normalizeRole(role);

        if (!email || !password || !firstName || !lastName || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Privilege boundary: only SUPER_ADMIN can create SUPER_ADMIN users.
        if (normalizedRole === 'SUPER_ADMIN' && actorRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Only SUPER_ADMIN can create SUPER_ADMIN users' });
        }

        const tenantId = req.user?.tenantId || 'default';
        const sanitizedEmail = sanitizeEmail(email);
        if (!sanitizedEmail) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check if user exists in this tenant
        const existingUser = await prisma.user.findFirst({
            where: {
                email: {
                    equals: sanitizedEmail,
                    mode: 'insensitive'
                },
                tenantId
            }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists in this tenant' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = await prisma.user.create({
            data: {
                email: sanitizedEmail,
                password: hashedPassword,
                firstName,
                lastName,
                role: normalizedRole as any,
                tenantId,
                status: 'ACTIVE',
                language: 'EN',
                // Admin-created accounts are trusted onboarding actions.
                // Mark verified so users can sign in immediately without email loop blockers.
                isEmailVerified: true,
                verificationToken: null,
                verificationTokenExpiry: null
            }
        });

        // Ensure newly created users are not blocked by stale email lockout counters.
        await clearFailedAttempts(sanitizedEmail);

        // Remove password from response
        const { password: _, ...userWithoutPassword } = newUser;

        return res.status(201).json({
            message: 'User created successfully',
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== RBAC Diagnostics ====================

router.get('/rbac/overview', authorize('admin.read'), async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const matrix = RBAC_ROLES.map((role) => ({
            role,
            permissions: getPermissionsForRole(role)
        }));

        return res.json({
            roles: RBAC_ROLES,
            permissionKeys: Object.keys(PERMISSIONS),
            matrix
        });
    } catch (error) {
        console.error('Error fetching RBAC overview:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/rbac/check', authorize('admin.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { role, permission, isOwner = false } = req.body || {};
        if (!RBAC_ROLES.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        if (!permission || typeof permission !== 'string') {
            return res.status(400).json({ error: 'Permission is required' });
        }

        const result = checkPermissionDetailed({
            userId: 'diagnostic-user',
            userRole: role,
            resourceOwnerId: isOwner ? 'diagnostic-user' : undefined
        }, permission);

        return res.json({
            role,
            permission,
            isOwner: Boolean(isOwner),
            allowed: result.allowed,
            reason: result.reason
        });
    } catch (error) {
        console.error('Error checking RBAC permission:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/rbac/denials', authorize('admin.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const limit = Math.min(Number(req.query.limit || 50), 200);
        const userId = req.query.userId as string | undefined;
        const permission = req.query.permission as string | undefined;
        const deniedOnly = getAuditLogs({
            result: 'denied',
            userId,
            permission
        });

        return res.json({ denials: deniedOnly.slice(-limit).reverse() });
    } catch (error) {
        console.error('Error fetching RBAC denials:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== Platform Overview ====================

router.get('/stats', authorize('admin.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

        const userWhere = isSuperAdmin
            ? { status: { not: 'DELETED' as any } }
            : { tenantId, status: { not: 'DELETED' as any } };
        const smeWhere = isSuperAdmin
            ? { status: { not: 'DELETED' as any } }
            : { tenantId, status: { not: 'DELETED' as any } };
        const investorWhere = isSuperAdmin
            ? { status: { not: 'DELETED' as any } }
            : { tenantId, status: { not: 'DELETED' as any } };
        const advisorWhere = isSuperAdmin
            ? { status: { not: 'DELETED' as any } }
            : { tenantId, status: { not: 'DELETED' as any } };
        const dealWhere = isSuperAdmin
            ? { status: { not: 'CLOSED' as any } }
            : { tenantId, status: { not: 'CLOSED' as any } };
        const dealAggregateWhere = isSuperAdmin ? {} : { tenantId };
        const secondaryTradeWhere = isSuperAdmin ? {} : { listing: { tenantId } };
        const syndicateTradeWhere = isSuperAdmin ? {} : { listing: { seller: { tenantId } } };

        const [
            userCount,
            smeCount,
            investorCount,
            advisorCount,
            dealCount,
            totalDealAmount,
            secondaryTradeStats,
            syndicateTradeStats
        ] = await Promise.all([
            prisma.user.count({ where: userWhere }),
            prisma.sME.count({ where: smeWhere }),
            prisma.investor.count({ where: investorWhere }),
            prisma.advisor.count({ where: advisorWhere }),
            prisma.deal.count({ where: dealWhere }),
            prisma.deal.aggregate({ where: dealAggregateWhere, _sum: { amount: true } }),
            prisma.secondaryTrade.aggregate({
                where: secondaryTradeWhere,
                _sum: { totalAmount: true, fee: true }
            }),
            prisma.syndicateTokenTrade.aggregate({
                where: syndicateTradeWhere,
                _sum: { totalAmount: true, fee: true }
            })
        ]);

        const dealVolume = totalDealAmount._sum.amount || 0;
        const secondaryVolume = (secondaryTradeStats._sum.totalAmount || 0) + (syndicateTradeStats._sum.totalAmount || 0);
        const totalFees = (secondaryTradeStats._sum.fee || 0) + (syndicateTradeStats._sum.fee || 0);

        return res.json({
            stats: {
                users: userCount,
                smes: smeCount,
                investors: investorCount,
                advisors: advisorCount,
                deals: dealCount,
                totalVolume: dealVolume + secondaryVolume,
                totalFees
            }
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== Business Operations Overview ====================

router.get('/business-ops/overview', authorize('admin.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const scope = isSuperAdmin ? {} : { tenantId };

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const staleCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

        const [
            monthlyRevenueAggregate,
            pendingPayments,
            refundedPayments,
            onboardingActive,
            onboardingStale,
            kycPending,
            kycRejected,
            complianceOpenDisputes,
            activeDeals,
            dueDiligenceInProgress,
            activeUsers,
            newUsersLast7d,
            messagesLast24h,
            supportOpenDisputes,
            highSeverityEvents
        ] = await Promise.all([
            prisma.payment.aggregate({
                where: {
                    ...scope,
                    status: 'COMPLETED',
                    createdAt: { gte: monthStart }
                },
                _sum: { amount: true }
            }),
            prisma.payment.count({
                where: {
                    ...scope,
                    status: { in: ['PENDING', 'PROCESSING'] }
                }
            }),
            prisma.payment.count({
                where: {
                    ...scope,
                    status: 'REFUNDED'
                }
            }),
            prisma.workflow.count({
                where: {
                    ...scope,
                    type: { in: ['SME_ONBOARDING', 'INVESTOR_ONBOARDING'] },
                    status: { in: ['PENDING', 'IN_PROGRESS'] }
                }
            }),
            prisma.workflow.count({
                where: {
                    ...scope,
                    type: { in: ['SME_ONBOARDING', 'INVESTOR_ONBOARDING'] },
                    status: { in: ['PENDING', 'IN_PROGRESS'] },
                    createdAt: { lte: staleCutoff }
                }
            }),
            prisma.investor.count({
                where: {
                    ...scope,
                    kycStatus: { in: ['PENDING', 'UNDER_REVIEW'] }
                }
            }),
            prisma.investor.count({
                where: {
                    ...scope,
                    kycStatus: 'REJECTED'
                }
            }),
            prisma.dispute.count({
                where: {
                    ...scope,
                    status: { in: ['OPEN', 'IN_PROGRESS'] }
                }
            }),
            prisma.deal.count({
                where: {
                    ...scope,
                    status: { in: ['PUBLISHED', 'NEGOTIATION', 'DUE_DILIGENCE', 'FUNDED'] }
                }
            }),
            prisma.dueDiligence.count({
                where: isSuperAdmin
                    ? { status: 'IN_PROGRESS' }
                    : {
                        status: 'IN_PROGRESS',
                        sme: { tenantId }
                    }
            }),
            prisma.user.count({
                where: {
                    ...scope,
                    status: 'ACTIVE'
                }
            }),
            prisma.user.count({
                where: {
                    ...scope,
                    createdAt: { gte: last7d },
                    status: { not: 'DELETED' as any }
                }
            }),
            prisma.message.count({
                where: {
                    conversation: isSuperAdmin ? {} : { tenantId },
                    createdAt: { gte: last24h }
                }
            }),
            prisma.dispute.count({
                where: {
                    ...scope,
                    status: 'OPEN'
                }
            }),
            prisma.activityLog.count({
                where: {
                    ...scope,
                    timestamp: { gte: last7d },
                    action: {
                        in: ['LOGIN_FAILED', 'SESSION_REVOKED', 'PASSWORD_RESET', 'ACCOUNT_LOCKED']
                    }
                }
            })
        ]);

        const monthlyRevenue = monthlyRevenueAggregate._sum.amount || 0;

        return res.json({
            generatedAt: now.toISOString(),
            overview: [
                {
                    key: 'billing',
                    title: 'Revenue & Billing',
                    metrics: {
                        monthlyRevenue,
                        pendingPayments,
                        refundedPayments
                    },
                    focus: pendingPayments > 0 ? 'Review pending/processing payments and retry failures.' : 'Billing queue is clear.'
                },
                {
                    key: 'onboarding',
                    title: 'Client Onboarding Pipeline',
                    metrics: {
                        activeOnboarding: onboardingActive,
                        staleOnboarding: onboardingStale,
                        newUsersLast7d
                    },
                    focus: onboardingStale > 0 ? 'Escalate onboarding items older than 48 hours.' : 'Onboarding SLA is currently healthy.'
                },
                {
                    key: 'compliance',
                    title: 'Compliance & Risk',
                    metrics: {
                        kycPending,
                        kycRejected,
                        openDisputes: complianceOpenDisputes
                    },
                    focus: kycPending > 0 ? 'Prioritize KYC queue to reduce onboarding bottlenecks.' : 'KYC queue is clear.'
                },
                {
                    key: 'dealops',
                    title: 'Deal Operations',
                    metrics: {
                        activeDeals,
                        dueDiligenceInProgress
                    },
                    focus: dueDiligenceInProgress > 0 ? 'Review due diligence workload and assign owners.' : 'No diligence backlog detected.'
                },
                {
                    key: 'support',
                    title: 'Support & Customer Success',
                    metrics: {
                        openSupportCases: supportOpenDisputes,
                        messagesLast24h
                    },
                    focus: supportOpenDisputes > 0 ? 'Resolve open support/dispute cases before SLA breach.' : 'Support case queue is healthy.'
                },
                {
                    key: 'security',
                    title: 'Trust & Security',
                    metrics: {
                        activeUsers,
                        highSeverityEvents
                    },
                    focus: highSeverityEvents > 0 ? 'Investigate recent high-severity auth/session events.' : 'No high-severity events in last 7 days.'
                }
            ]
        });
    } catch (error) {
        console.error('Error fetching business operations overview:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== Tenant Settings (Branding) ====================

// Get tenant settings
router.get('/tenant/settings', authorize('settings.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        return res.json({ settings: tenant.settings });
    } catch (error) {
        console.error('Error fetching tenant settings:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Update tenant settings
router.put('/tenant/settings', authorize('settings.update'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const { branding } = req.body;

        if (!branding) {
            return res.status(400).json({ error: 'Branding settings are required' });
        }

        // Get existing settings to merge
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });

        const currentSettings = (tenant?.settings as any) || {};
        const updatedSettings = {
            ...currentSettings,
            branding: {
                ...currentSettings.branding,
                ...branding
            }
        };

        const updatedTenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: { settings: updatedSettings }
        });

        return res.json({
            message: 'Branding settings updated successfully',
            settings: updatedTenant.settings
        });
    } catch (error) {
        console.error('Error updating tenant settings:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
