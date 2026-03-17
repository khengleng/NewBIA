import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';

const router = Router();

function getTenantScope(req: AuthenticatedRequest) {
  const tenantId = req.user?.tenantId || 'default';
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  return { tenantId, isSuperAdmin };
}

router.get('/overview', authorize('admin.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = getTenantScope(req);
    const activeStatuses = ['PUBLISHED', 'NEGOTIATION', 'DUE_DILIGENCE', 'FUNDED'] as const;
    const staleCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const dealWhere: any = isSuperAdmin ? {} : { tenantId };
    const activeDealWhere: any = { ...dealWhere, status: { in: activeStatuses } };

    const [
      activeDeals,
      stalledDeals,
      blockedDisputes,
      pendingWorkflows,
      dueDiligenceDeals,
      lowDocDeals
    ] = await Promise.all([
      prisma.deal.findMany({
        where: activeDealWhere,
        select: { id: true, createdAt: true }
      }),
      prisma.deal.count({
        where: {
          ...activeDealWhere,
          updatedAt: { lt: staleCutoff }
        }
      }),
      prisma.dispute.count({
        where: {
          ...(isSuperAdmin ? {} : { tenantId }),
          status: { in: ['OPEN', 'IN_PROGRESS'] }
        }
      }),
      prisma.workflow.count({
        where: {
          ...(isSuperAdmin ? {} : { tenantId }),
          dealId: { not: null },
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        }
      }),
      prisma.deal.count({
        where: {
          ...dealWhere,
          status: 'DUE_DILIGENCE'
        }
      }),
      prisma.deal.findMany({
        where: {
          ...dealWhere,
          status: { in: ['PUBLISHED', 'NEGOTIATION', 'DUE_DILIGENCE'] }
        },
        select: {
          id: true,
          documents: { select: { id: true } }
        }
      })
    ]);

    const avgDealAgeDays = activeDeals.length === 0
      ? 0
      : Number((
        activeDeals.reduce((acc, deal) => {
          const ageDays = (Date.now() - new Date(deal.createdAt).getTime()) / (24 * 60 * 60 * 1000);
          return acc + ageDays;
        }, 0) / activeDeals.length
      ).toFixed(1));

    const lowDocumentCount = lowDocDeals.filter((deal) => deal.documents.length < 2).length;

    return res.json({
      overview: {
        activeDeals: activeDeals.length,
        stalledDeals,
        blockedByDisputes: blockedDisputes,
        pendingWorkflows,
        dueDiligenceDeals,
        lowDocumentDeals: lowDocumentCount,
        avgDealAgeDays
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Deal ops overview error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/attention', authorize('admin.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = getTenantScope(req);
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const staleCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const dealScope: any = isSuperAdmin ? {} : { tenantId };

    const [stalled, disputeBlocked, workflowBlocked, lowDocs] = await Promise.all([
      prisma.deal.findMany({
        where: {
          ...dealScope,
          status: { in: ['PUBLISHED', 'NEGOTIATION', 'DUE_DILIGENCE'] },
          updatedAt: { lt: staleCutoff }
        },
        include: { sme: { select: { name: true } } },
        orderBy: { updatedAt: 'asc' },
        take: limit
      }),
      prisma.dispute.findMany({
        where: {
          ...(isSuperAdmin ? {} : { tenantId }),
          status: { in: ['OPEN', 'IN_PROGRESS'] }
        },
        include: {
          deal: { include: { sme: { select: { name: true } } } }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      }),
      prisma.workflow.findMany({
        where: {
          ...(isSuperAdmin ? {} : { tenantId }),
          dealId: { not: null },
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        },
        include: {
          deal: { include: { sme: { select: { name: true } } } }
        },
        orderBy: { createdAt: 'asc' },
        take: limit
      }),
      prisma.deal.findMany({
        where: {
          ...dealScope,
          status: { in: ['PUBLISHED', 'NEGOTIATION', 'DUE_DILIGENCE'] }
        },
        include: {
          documents: { select: { id: true } },
          sme: { select: { name: true } }
        },
        take: limit
      })
    ]);

    const rows = new Map<string, any>();

    for (const deal of stalled) {
      rows.set(deal.id, {
        dealId: deal.id,
        title: deal.title,
        status: deal.status,
        smeName: deal.sme.name,
        updatedAt: deal.updatedAt,
        blockers: ['STALLED_ACTIVITY']
      });
    }

    for (const dispute of disputeBlocked) {
      const deal = dispute.deal;
      const prev = rows.get(deal.id);
      const blockers = prev?.blockers || [];
      if (!blockers.includes('OPEN_DISPUTE')) blockers.push('OPEN_DISPUTE');
      rows.set(deal.id, {
        dealId: deal.id,
        title: deal.title,
        status: deal.status,
        smeName: deal.sme.name,
        updatedAt: deal.updatedAt,
        blockers
      });
    }

    for (const workflow of workflowBlocked) {
      if (!workflow.deal) continue;
      const deal = workflow.deal;
      const prev = rows.get(deal.id);
      const blockers = prev?.blockers || [];
      if (!blockers.includes('PENDING_WORKFLOW')) blockers.push('PENDING_WORKFLOW');
      rows.set(deal.id, {
        dealId: deal.id,
        title: deal.title,
        status: deal.status,
        smeName: deal.sme.name,
        updatedAt: deal.updatedAt,
        blockers
      });
    }

    for (const deal of lowDocs) {
      if (deal.documents.length >= 2) continue;
      const prev = rows.get(deal.id);
      const blockers = prev?.blockers || [];
      if (!blockers.includes('LOW_DOCUMENT_COVERAGE')) blockers.push('LOW_DOCUMENT_COVERAGE');
      rows.set(deal.id, {
        dealId: deal.id,
        title: deal.title,
        status: deal.status,
        smeName: deal.sme.name,
        updatedAt: deal.updatedAt,
        blockers
      });
    }

    const attention = Array.from(rows.values())
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
      .slice(0, limit);

    return res.json({ attention, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Deal ops attention error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
