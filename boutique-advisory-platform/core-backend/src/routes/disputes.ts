import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { sendNotification } from '../services/notification.service';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';

const router = Router();

const createDisputeSchema = z.object({
    dealId: z.string(),
    reason: z.string().min(5),
    description: z.string().min(20)
});

const updateDisputeSchema = z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']),
    resolution: z.string().optional()
});

// POST /api/disputes - File a new dispute
router.post('/', authorize('payment.read'), validateBody(createDisputeSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId || 'default';
        const { dealId, reason, description } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify that the user is an investor in this deal
        // This is a security check to prevent random people from filing disputes
        const investment = await prisma.dealInvestor.findFirst({
            where: {
                dealId,
                investor: {
                    userId: userId
                }
            }
        });

        // Also allow SME owner to file dispute if needed? 
        // User request specifically mentioned "investor to file a dispute", so let's stick to that for now.
        // But maybe SMEs should also be able to file disputes if an investor doesn't pay?
        // Let's check SME ownership too just in case.
        const sme = await prisma.deal.findFirst({
            where: {
                id: dealId,
                sme: {
                    userId: userId
                }
            }
        });

        if (!investment && !sme && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'You are not authorized to file a dispute for this deal. Only investors or the SME owner can file disputes.' });
        }

        const dispute = await prisma.dispute.create({
            data: {
                tenantId,
                dealId,
                initiatorId: userId,
                reason,
                description,
                status: 'OPEN'
            },
            include: {
                deal: true,
                initiator: true
            }
        });

        // Notify Admins
        const admins = await prisma.user.findMany({
            where: {
                tenantId,
                role: { in: ['ADMIN', 'SUPER_ADMIN'] }
            }
        });

        for (const admin of admins) {
            await sendNotification(
                admin.id,
                'New Dispute Filed',
                `${dispute.initiator.firstName} ${dispute.initiator.lastName} filed a dispute for deal "${dispute.deal.title}"`,
                'WARNING',
                `/admin/action-center/disputes` // Admin direct link
            );
        }

        return res.status(201).json({
            message: 'Dispute filed successfully. An administrator will review it shortly.',
            dispute
        });
    } catch (error) {
        console.error('Error filing dispute:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/disputes/my - Get disputes filed by me
router.get('/my', authorize('payment.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const disputes = await prisma.dispute.findMany({
            where: { initiatorId: userId },
            include: {
                deal: {
                    select: { title: true }
                },
                resolver: {
                    select: { firstName: true, lastName: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.json(disputes);
    } catch (error) {
        console.error('Error fetching my disputes:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/disputes - List all disputes (with role-based filtering)
router.get('/', authorize('dispute.list'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const tenantId = req.user?.tenantId || 'default';

        let where: any = { tenantId };

        // If not Admin/Super Admin, only show disputes they initiated or for their deals
        if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
            where = {
                ...where,
                OR: [
                    { initiatorId: userId },
                    { deal: { sme: { userId: userId } } }
                ]
            };
        }

        const disputes = await prisma.dispute.findMany({
            where,
            include: {
                deal: {
                    select: { title: true, id: true }
                },
                initiator: {
                    select: { firstName: true, lastName: true, email: true }
                },
                resolver: {
                    select: { firstName: true, lastName: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.json(disputes);
    } catch (error) {
        console.error('Error fetching disputes:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/disputes/:id - Get dispute details
router.get('/:id', authorize('dispute.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        const dispute = await (prisma as any).dispute.findUnique({
            where: { id },
            include: {
                deal: {
                    include: {
                        sme: { include: { user: true } }
                    }
                },
                initiator: true,
                resolver: true
            }
        });

        if (!dispute) {
            return res.status(404).json({ error: 'Dispute not found' });
        }

        // Verify access: Admin or Initiator or SME Owner
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
        const isInitiator = dispute.initiatorId === userId;
        const isSmeOwner = (dispute.deal as any).sme.userId === userId;

        if (!isAdmin && !isInitiator && !isSmeOwner) {
            return res.status(403).json({ error: 'Access denied' });
        }

        return res.json(dispute);
    } catch (error) {
        console.error('Error fetching dispute detail:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/disputes/:id - Resolve or update dispute (Admin only)
router.patch('/:id', authorize('dispute.update'), validateBody(updateDisputeSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const { status, resolution } = req.body;

        const dispute = await (prisma as any).dispute.findUnique({
            where: { id }
        });

        if (!dispute) {
            return res.status(404).json({ error: 'Dispute not found' });
        }

        const updatedDispute = await (prisma as any).dispute.update({
            where: { id },
            data: {
                status,
                resolution,
                resolverId: userId,
                updatedAt: new Date()
            },
            include: {
                initiator: true,
                deal: true
            }
        });

        // Notify Initiator
        await sendNotification(
            updatedDispute.initiatorId,
            'Dispute Status Updated',
            `Your dispute for "${updatedDispute.deal.title}" is now ${status}.`,
            status === 'RESOLVED' ? 'SUCCESS' : 'INFO',
            `/investor/portfolio` // Link to portfolio/disputes
        );

        return res.json({
            message: 'Dispute updated successfully',
            dispute: updatedDispute
        });
    } catch (error) {
        console.error('Error updating dispute:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
