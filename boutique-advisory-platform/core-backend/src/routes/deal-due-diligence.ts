
import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';

const router = Router();

enum DueDiligenceStatus {
    PENDING = 'PENDING',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    WAIVED = 'WAIVED'
}

const createItemSchema = z.object({
    task: z.string().min(3),
    description: z.string().optional(),
    assignedTo: z.string().optional(),
    order: z.number().int().optional()
});

const updateItemSchema = z.object({
    status: z.nativeEnum(DueDiligenceStatus).optional(),
    assignedTo: z.string().optional(),
    description: z.string().optional()
});

// GET /api/due-diligence/:dealId
router.get('/:dealId', authorize('deal.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dealId } = req.params;
        const tenantId = req.user?.tenantId || 'default';

        const items = await (prisma as any).dueDiligenceItem.findMany({
            where: { dealId, tenantId },
            orderBy: { order: 'asc' }
        });

        // Calculate progress
        const total = items.length;
        const completed = items.filter((i: any) => i.status === 'COMPLETED' || i.status === 'WAIVED').length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        return res.json({
            items,
            progress,
            total,
            completed
        });
    } catch (error) {
        console.error('Error fetching due diligence items:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/due-diligence/:dealId/items
router.post('/:dealId/items', authorize('deal.update'), validateBody(createItemSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dealId } = req.params;
        const { task, description, assignedTo, order } = req.body;
        const tenantId = req.user?.tenantId || 'default';

        // SMEs should not create due diligence items effectively, only Investors/Advisors
        if (req.user?.role === 'SME') {
            return res.status(403).json({ error: 'SMEs cannot add due diligence checklist items.' });
        }

        const item = await (prisma as any).dueDiligenceItem.create({
            data: {
                tenantId,
                dealId,
                task,
                description,
                assignedTo,
                order: order || 0,
                status: 'PENDING'
            }
        });

        return res.status(201).json(item);
    } catch (error) {
        console.error('Error creating due diligence item:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/due-diligence/:dealId/items/:itemId
router.patch('/:dealId/items/:itemId', authorize('deal.update'), validateBody(updateItemSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { itemId } = req.params;
        const { status, assignedTo, description } = req.body;

        const updateData: any = {};
        if (status) updateData.status = status;
        if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
        if (description !== undefined) updateData.description = description;

        if (status === 'COMPLETED') {
            updateData.completedAt = new Date();
            updateData.completedBy = req.user?.id;
        }

        const item = await (prisma as any).dueDiligenceItem.update({
            where: { id: itemId },
            data: updateData
        });

        return res.json(item);
    } catch (error) {
        console.error('Error updating due diligence item:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/due-diligence/:dealId/complete
router.post('/:dealId/complete', authorize('deal.update'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dealId } = req.params;
        const tenantId = req.user?.tenantId || 'default';

        // Verify all items are completed or waived
        const pendingItems = await (prisma as any).dueDiligenceItem.findFirst({
            where: {
                dealId,
                status: { in: ['PENDING', 'IN_PROGRESS'] }
            }
        });

        if (pendingItems) {
            return res.status(400).json({ error: 'All due diligence items must be completed or waived.' });
        }

        // Move deal to NEGOTIATION
        const deal = await prisma.deal.update({
            where: { id: dealId },
            data: {
                status: 'NEGOTIATION' as any // Type assertion for mismatched enums if any
            }
        });

        return res.json({ success: true, deal });
    } catch (error) {
        console.error('Error completing due diligence:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
