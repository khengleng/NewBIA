import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';

const router = Router();

// Get pipeline deals
router.get('/deals', authorize('deal.list'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant context required' });
        }

        const where: any = { tenantId };

        if (userRole === 'SME') {
            const sme = await prisma.sME.findUnique({ where: { userId } });
            if (!sme) {
                return res.json({ stages: [], pipeline: {}, summary: { totalDeals: 0, totalValue: 0, highPriority: 0, avgProgress: 0 } });
            }
            where.smeId = sme.id;
        } else if (userRole === 'INVESTOR') {
            // Investors only see published/funded/closed pipeline entries.
            where.status = { in: ['PUBLISHED', 'NEGOTIATION', 'FUNDED', 'CLOSED'] };
        }

        const deals = await prisma.deal.findMany({
            where,
            include: {
                sme: true,
                investors: {
                    include: {
                        investor: true
                    }
                }
            }
        });

        const stages = [
            { id: '1', name: 'DRAFT', order: 1, color: '#94a3b8' },
            { id: '2', name: 'PUBLISHED', order: 2, color: '#3b82f6' },
            { id: '3', name: 'NEGOTIATION', order: 3, color: '#f59e0b' },
            { id: '4', name: 'FUNDED', order: 4, color: '#10b981' },
            { id: '5', name: 'CLOSED', order: 5, color: '#6366f1' }
        ];

        const pipeline: { [key: string]: any[] } = {};
        stages.forEach(stage => {
            pipeline[stage.name] = deals
                .filter((deal: any) => deal.status === stage.name)
                .map((deal: any) => ({
                    id: deal.id,
                    title: deal.title,
                    smeId: deal.smeId,
                    smeName: deal.sme.name,
                    investorId: deal.investors[0]?.investorId || '',
                    investorName: deal.investors[0]?.investor.name || 'No Investor',
                    amount: deal.amount,
                    stage: deal.status,
                    stageOrder: stage.order,
                    priority: 'MEDIUM', // Mock priority
                    daysInStage: Math.floor(Math.random() * 30), // Mock data
                    expectedClose: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    progress: deal.status === 'CLOSED' ? 100 : deal.status === 'FUNDED' ? 90 : 30,
                    lastActivity: deal.updatedAt.toISOString()
                }));
        });

        const summary = {
            totalDeals: deals.length,
            totalValue: deals.reduce((sum: number, d: any) => sum + d.amount, 0),
            highPriority: deals.filter((d: any) => d.amount > 1000000).length,
            avgProgress: 45
        };

        return res.json({ stages, pipeline, summary });
    } catch (error) {
        console.error('Error fetching pipeline deals:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Update deal stage
router.put('/deals/:id/stage', authorize('deal.update', {
    getOwnerId: async (req) => {
        const deal = await prisma.deal.findUnique({
            where: { id: req.params.id },
            include: { sme: { select: { userId: true } } }
        });
        return deal?.sme?.userId;
    }
}), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { newStage } = req.body;
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant context required' });
        }

        const allowedStages = ['DRAFT', 'PUBLISHED', 'NEGOTIATION', 'FUNDED', 'CLOSED'];
        if (!allowedStages.includes(newStage)) {
            return res.status(400).json({ error: 'Invalid stage' });
        }

        const existingDeal = await prisma.deal.findFirst({
            where: { id, tenantId },
            include: { sme: true }
        });
        if (!existingDeal) {
            return res.status(404).json({ error: 'Deal not found' });
        }

        const updatedDeal = await prisma.deal.update({
            where: { id, tenantId },
            data: { status: newStage as any }
        });

        return res.json(updatedDeal);
    } catch (error) {
        console.error('Error updating deal stage:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
