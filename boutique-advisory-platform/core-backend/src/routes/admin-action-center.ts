import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';

const router = Router();

const FINAL_DISPUTE_STATUSES = new Set(['RESOLVED', 'REJECTED']);

// GET /api/admin/action-center/stats
router.get('/stats', authorize('admin.dashboard_view'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';

        const [kycPending, disputesOpen, disputesInProgress] = await Promise.all([
            // KYC Requests: PENDING Investors
            prisma.investor.count({
                where: {
                    tenantId,
                    kycStatus: 'PENDING'
                }
            }),
            // Open Disputes
            (prisma as any).dispute.count({
                where: {
                    tenantId,
                    status: 'OPEN'
                }
            }),
            // In Progress Disputes (Manual Mediation)
            (prisma as any).dispute.count({
                where: {
                    tenantId,
                    status: 'IN_PROGRESS'
                }
            })
        ]);

        return res.json({
            kycRequests: kycPending,
            dealDisputes: disputesOpen + disputesInProgress,
            disputeDetails: {
                open: disputesOpen,
                inProgress: disputesInProgress
            }
        });
    } catch (error) {
        console.error('Error fetching admin action center stats:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/admin/action-center/kyc-requests
router.get('/kyc-requests', authorize('admin.user_manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';

        const requests = await prisma.investor.findMany({
            where: {
                tenantId,
                kycStatus: 'PENDING'
            },
            include: {
                user: {
                    select: {
                        email: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            take: 20
        });

        return res.json(requests);
    } catch (error) {
        console.error('Error fetching KYC requests:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/admin/action-center/disputes
router.get('/disputes', authorize('admin.user_manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const status = (req.query.status as string | undefined)?.toUpperCase();
        const where: any = {
            tenantId,
            status: {
                in: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']
            }
        };

        if (status && ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].includes(status)) {
            where.status = status;
        }

        const disputes = await (prisma as any).dispute.findMany({
            where,
            include: {
                initiator: {
                    select: { firstName: true, lastName: true, email: true }
                },
                resolver: {
                    select: { firstName: true, lastName: true, email: true }
                },
                deal: {
                    select: { title: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        return res.json(disputes);
    } catch (error) {
        console.error('Error fetching disputes:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Approve KYC
import { sendNotification } from '../services/notification.service';

router.post('/kyc/:id/approve', authorize('admin.user_manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const investorId = req.params.id;
        const investor = await prisma.investor.update({
            where: { id: investorId },
            data: { kycStatus: 'VERIFIED' },
            include: { user: true }
        });

        await sendNotification(
            investor.userId,
            'KYC Verified',
            'Your investor profile has been verified. You can now access deal details.',
            'SUCCESS',
            '/investor/dashboard'
        );

        return res.json({ message: 'KYC Approved', investor });
    } catch (error) {
        console.error('Error approving KYC:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Reject KYC
router.post('/kyc/:id/reject', authorize('admin.user_manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const investorId = req.params.id;
        const { reason } = req.body;

        const investor = await prisma.investor.update({
            where: { id: investorId },
            data: { kycStatus: 'REJECTED' },
            include: { user: true }
        });

        await sendNotification(
            investor.userId,
            'KYC Rejected',
            `Your verification was rejected: ${reason || 'Incomplete information'}. Please update your profile.`,
            'alert' as any, // Using 'alert' or 'SYSTEM' based on enum availability, fallback to cast if needed
            '/settings/profile'
        );

        return res.json({ message: 'KYC Rejected', investor });
    } catch (error) {
        console.error('Error rejecting KYC:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Resolve Dispute
router.post('/disputes/:id/resolve', authorize('admin.user_manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const disputeId = req.params.id;
        const { resolution } = req.body;
        const resolverId = req.user?.id;

        if (!resolution) {
            return res.status(400).json({ error: 'Resolution description is required' });
        }

        const existingDispute = await (prisma as any).dispute.findUnique({
            where: { id: disputeId },
            select: { id: true, tenantId: true, status: true }
        });
        if (!existingDispute) {
            return res.status(404).json({ error: 'Dispute not found' });
        }
        if (existingDispute.tenantId !== (req.user?.tenantId || 'default')) {
            return res.status(403).json({ error: 'Cannot resolve dispute from another tenant' });
        }
        if (FINAL_DISPUTE_STATUSES.has(existingDispute.status)) {
            return res.status(400).json({ error: `Cannot resolve dispute in ${existingDispute.status} status` });
        }

        const dispute = await (prisma as any).dispute.update({
            where: { id: disputeId },
            data: {
                status: 'RESOLVED',
                resolution,
                resolverId,
                updatedAt: new Date()
            },
            include: {
                initiator: true,
                deal: true
            }
        });

        // Notify initiator
        await sendNotification(
            dispute.initiatorId,
            'Dispute Resolved',
            `Your dispute regarding deal "${dispute.deal.title}" has been resolved: ${resolution}`,
            'SUCCESS',
            `/deals/${dispute.dealId}`
        );

        return res.json({ message: 'Dispute resolved successfully', dispute });
    } catch (error) {
        console.error('Error resolving dispute:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Start Mediation (Mark as IN_PROGRESS)
router.post('/disputes/:id/start-mediation', authorize('admin.user_manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const disputeId = req.params.id;
        const resolverId = req.user?.id;

        const existingDispute = await (prisma as any).dispute.findUnique({
            where: { id: disputeId },
            select: { id: true, tenantId: true, status: true }
        });
        if (!existingDispute) {
            return res.status(404).json({ error: 'Dispute not found' });
        }
        if (existingDispute.tenantId !== (req.user?.tenantId || 'default')) {
            return res.status(403).json({ error: 'Cannot update dispute from another tenant' });
        }
        if (FINAL_DISPUTE_STATUSES.has(existingDispute.status)) {
            return res.status(400).json({ error: `Cannot start mediation for ${existingDispute.status} dispute` });
        }

        const dispute = await (prisma as any).dispute.update({
            where: { id: disputeId },
            data: { status: 'IN_PROGRESS', resolverId },
            include: { initiator: true, deal: true }
        });

        // Notify initiator
        await sendNotification(
            dispute.initiatorId,
            'Mediation Started',
            `An administrator has started reviewing your dispute regarding "${dispute.deal.title}".`,
            'INFO',
            `/investor/portfolio`
        );

        return res.json({ message: 'Mediation started', dispute });
    } catch (error) {
        console.error('Error starting mediation:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Reject Dispute
router.post('/disputes/:id/reject', authorize('admin.user_manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const disputeId = req.params.id;
        const { reason } = req.body;
        const resolverId = req.user?.id;

        if (!reason || String(reason).trim().length < 10) {
            return res.status(400).json({ error: 'Rejection reason must be at least 10 characters' });
        }

        const existingDispute = await (prisma as any).dispute.findUnique({
            where: { id: disputeId },
            select: { id: true, tenantId: true, status: true }
        });
        if (!existingDispute) {
            return res.status(404).json({ error: 'Dispute not found' });
        }
        if (existingDispute.tenantId !== (req.user?.tenantId || 'default')) {
            return res.status(403).json({ error: 'Cannot update dispute from another tenant' });
        }
        if (FINAL_DISPUTE_STATUSES.has(existingDispute.status)) {
            return res.status(400).json({ error: `Cannot reject dispute in ${existingDispute.status} status` });
        }

        const dispute = await (prisma as any).dispute.update({
            where: { id: disputeId },
            data: {
                status: 'REJECTED',
                resolution: String(reason).trim(),
                resolverId,
                updatedAt: new Date()
            },
            include: { initiator: true, deal: true }
        });

        await sendNotification(
            dispute.initiatorId,
            'Dispute Rejected',
            `Your dispute regarding deal "${dispute.deal.title}" was rejected: ${String(reason).trim()}`,
            'WARNING',
            `/deals/${dispute.dealId}`
        );

        return res.json({ message: 'Dispute rejected', dispute });
    } catch (error) {
        console.error('Error rejecting dispute:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Re-open closed dispute to in-progress for additional review
router.post('/disputes/:id/reopen', authorize('admin.user_manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const disputeId = req.params.id;
        const resolverId = req.user?.id;
        const existingDispute = await (prisma as any).dispute.findUnique({
            where: { id: disputeId },
            select: { id: true, tenantId: true, status: true }
        });

        if (!existingDispute) {
            return res.status(404).json({ error: 'Dispute not found' });
        }
        if (existingDispute.tenantId !== (req.user?.tenantId || 'default')) {
            return res.status(403).json({ error: 'Cannot update dispute from another tenant' });
        }
        if (!FINAL_DISPUTE_STATUSES.has(existingDispute.status)) {
            return res.status(400).json({ error: 'Only resolved or rejected disputes can be reopened' });
        }

        const dispute = await (prisma as any).dispute.update({
            where: { id: disputeId },
            data: {
                status: 'IN_PROGRESS',
                resolverId
            },
            include: { initiator: true, deal: true }
        });

        await sendNotification(
            dispute.initiatorId,
            'Dispute Reopened',
            `Your dispute for "${dispute.deal.title}" has been reopened for additional review.`,
            'INFO',
            `/investor/portfolio`
        );

        return res.json({ message: 'Dispute reopened', dispute });
    } catch (error) {
        console.error('Error reopening dispute:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
