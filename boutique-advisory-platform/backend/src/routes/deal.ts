import { Router, Request, Response } from 'express';
import { prisma } from '../database';
import { validateBody, createDealSchema, updateDealSchema } from '../middleware/validation';
import { authorize, AuthenticatedRequest } from '../middleware/authorize';
import { sendNotification } from '../services/notification.service';
import { logAuditEvent } from '../utils/security';

const router = Router();
const dealStatusTransitions: Record<string, string[]> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['NEGOTIATION', 'DUE_DILIGENCE', 'CANCELLED'],
  NEGOTIATION: ['DUE_DILIGENCE', 'FUNDED', 'CANCELLED'],
  DUE_DILIGENCE: ['NEGOTIATION', 'FUNDED', 'CANCELLED'],
  FUNDED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: []
};
const immutableDealTermsAfterPublish = ['amount', 'equity', 'successFee', 'terms', 'smeId'] as const;

function canTransitionDealStatus(current: string, next: string): boolean {
  return (dealStatusTransitions[current] || []).includes(next);
}

function canUserSetDealStatus(role: string | undefined, current: string, next: string): boolean {
  if (!role) return false;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true;
  if (role === 'ADVISOR') return ['NEGOTIATION', 'DUE_DILIGENCE', 'FUNDED', 'CLOSED', 'CANCELLED'].includes(next);
  if (role === 'SME') {
    if (current === 'DRAFT' && (next === 'PUBLISHED' || next === 'CANCELLED')) return true;
    if ((current === 'PUBLISHED' || current === 'NEGOTIATION' || current === 'DUE_DILIGENCE') && next === 'CANCELLED') return true;
  }
  return false;
}

// Get all deals
router.get('/', authorize('deal.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const tenantId = req.user?.tenantId;

    let query: any = {
      where: {
        tenantId: tenantId,
        sme: {
          status: { not: 'DELETED' }
        }
      },
      include: {
        sme: true,
        investors: {
          include: {
            investor: true
          }
        }
      }
    };

    if (userRole === 'SME') {
      const sme = await prisma.sME.findUnique({ where: { userId: userId } });
      if (sme) {
        query.where.smeId = sme.id;
      } else {
        return res.json([]);
      }
    } else if (userRole === 'INVESTOR') {
      // Check if this investor also owns an SME
      const mySme = await prisma.sME.findUnique({ where: { userId: userId } });

      if (mySme) {
        // Investor sees PUBLISHED deals + their own DRAFT/etc deals
        query.where = {
          ...query.where,
          OR: [
            { status: 'PUBLISHED' },
            { smeId: mySme.id }
          ]
        };
      } else {
        // Standard investor only sees PUBLISHED
        query.where.status = 'PUBLISHED';
      }
    }

    const deals = await prisma.deal.findMany(query);
    return res.json(deals);
  } catch (error) {
    console.error('Get deals error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get deal by ID
router.get('/:id', authorize('deal.read', {
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
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const tenantId = req.user?.tenantId || 'default';

    const deal = await prisma.deal.findFirst({
      where: { id, tenantId },
      include: {
        sme: {
          include: { user: true }
        },
        investors: {
          include: {
            investor: true
          }
        },
        documents: true
      }
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // P1: Tenant Isolation - Ensure deal belongs to the user's tenant
    if (deal.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied: Deal does not belong to your tenant' });
    }

    // Ownership check for SME role
    if (userRole === 'SME' && deal.sme.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: You can only view your own deals' });
    }

    return res.json(deal);
  } catch (error) {
    console.error('Get deal error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new deal - with input validation
router.post('/', authorize('deal.create'), validateBody(createDealSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { smeId, title, description, amount, equity, successFee, terms, isDocumentLocked } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const tenantId = req.user?.tenantId; // P2: Tenant ID for deal creation

    // Verify SME exists
    const sme = await prisma.sME.findUnique({ where: { id: smeId } });
    if (!sme) {
      return res.status(404).json({ error: 'SME not found' });
    }

    // P2: Tenant Isolation - Ensure SME belongs to the user's tenant
    if (sme.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Access denied: SME does not belong to your tenant' });
    }

    // Ownership check for SME role
    if (userRole === 'SME' && sme.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: You can only create deals for your own SME profile' });
    }
    if (sme.status !== 'CERTIFIED') {
      return res.status(409).json({ error: 'SME must be CERTIFIED before creating a deal' });
    }

    const deal = await prisma.deal.create({
      data: {
        smeId,
        title,
        description,
        amount,
        equity: equity ?? null,
        successFee: successFee ?? null,
        terms,
        isDocumentLocked: isDocumentLocked || false,
        status: 'DRAFT',
        tenantId: sme.tenantId // P2: Ensure deal is created with the correct tenantId from the SME
      },
      include: {
        sme: {
          include: {
            user: true
          }
        }
      }
    });

    return res.status(201).json(deal);
  } catch (error) {
    console.error('Create deal error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update deal - with input validation
router.put('/:id', authorize('deal.update', {
  getOwnerId: async (req) => {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: { sme: { select: { userId: true } } }
    });
    return deal?.sme?.userId;
  }
}), validateBody(updateDealSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const updateData = req.body; // Use updateData for the body

    const tenantId = req.user?.tenantId || 'default';

    // Check if deal exists - with tenant scoping
    const existingDeal = await prisma.deal.findFirst({
      where: { id, tenantId },
      include: { sme: true }
    });
    if (!existingDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Ownership check for SME role
    if (userRole === 'SME' && existingDeal.sme.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: You can only update your own deals' });
    }
    if (existingDeal.status !== 'DRAFT') {
      for (const field of immutableDealTermsAfterPublish) {
        if (Object.prototype.hasOwnProperty.call(updateData, field) && (updateData as any)[field] !== (existingDeal as any)[field]) {
          return res.status(409).json({
            error: `Field "${field}" is immutable after deal publication. Create a deal amendment instead.`
          });
        }
      }
    }

    if (updateData.status && updateData.status !== existingDeal.status) {
      const currentStatus = String(existingDeal.status);
      const nextStatus = String(updateData.status);
      if (!canTransitionDealStatus(currentStatus, nextStatus)) {
        return res.status(409).json({
          error: `Invalid deal status transition: ${currentStatus} -> ${nextStatus}`
        });
      }
      if (!canUserSetDealStatus(userRole, currentStatus, nextStatus)) {
        return res.status(403).json({
          error: `Role ${userRole} is not allowed to move deal status to ${nextStatus}`
        });
      }
      if (nextStatus === 'PUBLISHED' && existingDeal.sme.status !== 'CERTIFIED') {
        return res.status(409).json({
          error: 'Cannot publish deal while SME is not CERTIFIED'
        });
      }
    }

    const deal = await prisma.deal.update({
      where: { id, tenantId }, // Explicitly include tenantId in where clause
      data: updateData,
      include: {
        sme: true
      }
    });

    // --- NOTIFICATIONS ---
    if (updateData.status && updateData.status !== existingDeal.status) {
      const status = updateData.status;
      const smeUserId = deal.sme.userId;
      await logAuditEvent({
        userId: req.user?.id || 'unknown',
        tenantId,
        action: 'DEAL_STATUS_TRANSITION',
        resource: 'deal',
        resourceId: deal.id,
        details: {
          fromStatus: existingDeal.status,
          toStatus: status
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        success: true
      });

      // 1. Notify SME Owner
      if (status === 'PUBLISHED') {
        await sendNotification(
          smeUserId,
          'Deal Published',
          `Your deal "${deal.title}" is now live and visible to investors!`,
          'DEAL_UPDATE',
          `/deals/${deal.id}`
        );

        // 2. Notify ALL Investors (Broadcast)
        // In a real app, filter by sector/preferences
        const investors = await prisma.user.findMany({
          where: { role: 'INVESTOR', status: 'ACTIVE', tenantId: tenantId }, // Scoped by tenantId
          select: { id: true }
        });

        for (const investor of investors) {
          await sendNotification(
            investor.id,
            'New Deal Opportunity',
            `New deal in ${deal.sme.sector}: ${deal.title}`,
            'DEAL_UPDATE',
            `/deals/${deal.id}`
          );
        }

      } else if (status === 'FUNDED') {
        await sendNotification(
          smeUserId,
          'Deal Funded!',
          `Congratulations! Your deal "${deal.title}" has been successfully funded.`,
          'DEAL_UPDATE',
          `/deals/${deal.id}`
        );
      } else if (status === 'CLOSED') {
        await sendNotification(
          smeUserId,
          'Deal Closed',
          `Your deal "${deal.title}" is now closed.`,
          'DEAL_UPDATE',
          `/deals/${deal.id}`
        );
      }
    }
    // ---------------------

    return res.json(deal);
  } catch (error) {
    console.error('Update deal error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
