import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';

const router = Router();

function tenantScope(req: AuthenticatedRequest) {
  const tenantId = req.user?.tenantId || 'default';
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  return { tenantId, isSuperAdmin };
}

router.get('/overview', authorize('investor_ops.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const scope = isSuperAdmin ? {} : { tenantId };
    const staleCutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

    const [
      totalInvestors,
      activeInvestors,
      pendingKyc,
      underReviewKyc,
      suspendedInvestors,
      staleInvestors,
      commitments
    ] = await Promise.all([
      prisma.investor.count({ where: scope }),
      prisma.investor.count({ where: { ...scope, status: 'ACTIVE' } }),
      prisma.investor.count({ where: { ...scope, kycStatus: 'PENDING' } }),
      prisma.investor.count({ where: { ...scope, kycStatus: 'UNDER_REVIEW' } }),
      prisma.investor.count({ where: { ...scope, status: 'SUSPENDED' } }),
      prisma.investor.count({ where: { ...scope, updatedAt: { lt: staleCutoff } } }),
      prisma.dealInvestor.aggregate({
        where: {
          investor: scope,
          status: { in: ['APPROVED', 'COMPLETED'] }
        },
        _sum: { amount: true },
        _count: { id: true }
      })
    ]);

    return res.json({
      overview: {
        totalInvestors,
        activeInvestors,
        pendingKyc,
        underReviewKyc,
        suspendedInvestors,
        staleInvestors,
        approvedCommitments: commitments._count.id || 0,
        committedCapital: Number((commitments._sum.amount || 0).toFixed(2))
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Investor ops overview error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/investors', authorize('investor_ops.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const kycStatus = String(req.query.kycStatus || '').toUpperCase();
    const status = String(req.query.status || '').toUpperCase();

    const where: any = isSuperAdmin ? {} : { tenantId };
    if (['PENDING', 'VERIFIED', 'REJECTED', 'UNDER_REVIEW'].includes(kycStatus)) where.kycStatus = kycStatus;
    if (['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'].includes(status)) where.status = status;

    const investors = await prisma.investor.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 250
    });

    const investorIds = investors.map((investor) => investor.id);
    const userIds = investors.map((investor) => investor.userId);

    const [users, allInvestmentAgg, approvedInvestmentAgg] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, email: true, status: true }
      }),
      prisma.dealInvestor.groupBy({
        by: ['investorId'],
        where: { investorId: { in: investorIds } },
        _count: { id: true },
        _max: { createdAt: true }
      }),
      prisma.dealInvestor.groupBy({
        by: ['investorId'],
        where: {
          investorId: { in: investorIds },
          status: { in: ['APPROVED', 'COMPLETED'] }
        },
        _count: { id: true },
        _sum: { amount: true }
      })
    ]);

    const usersById = new Map(users.map((user) => [user.id, user]));
    const totalsByInvestorId = new Map(allInvestmentAgg.map((row) => [row.investorId, row]));
    const approvedByInvestorId = new Map(approvedInvestmentAgg.map((row) => [row.investorId, row]));

    return res.json({
      investors: investors.map((investor) => {
        const totalAgg = totalsByInvestorId.get(investor.id);
        const approvedAgg = approvedByInvestorId.get(investor.id);
        const user = usersById.get(investor.userId);

        return {
          id: investor.id,
          name: investor.name,
          type: investor.type,
          status: investor.status,
          kycStatus: investor.kycStatus,
          user: user || null,
          totalInvestments: totalAgg?._count.id || 0,
          approvedInvestments: approvedAgg?._count.id || 0,
          approvedAmount: Number(((approvedAgg?._sum.amount as number | null) || 0).toFixed(2)),
          lastInvestmentAt: totalAgg?._max.createdAt || null,
          updatedAt: investor.updatedAt
        };
      })
    });
  } catch (error) {
    console.error('Investor ops list error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/investors/:id/kyc-review', authorize('investor_ops.review'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const { id } = req.params;
    const normalizedStatus = String(req.body?.status || '').toUpperCase();

    if (!['PENDING', 'VERIFIED', 'REJECTED', 'UNDER_REVIEW'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid KYC status' });
    }

    const investor = await prisma.investor.findUnique({ where: { id } });
    if (!investor || (!isSuperAdmin && investor.tenantId !== tenantId)) {
      return res.status(404).json({ error: 'Investor not found' });
    }

    const updated = await prisma.investor.update({
      where: { id },
      data: { kycStatus: normalizedStatus as any }
    });

    return res.json({ message: 'KYC status updated', investor: updated });
  } catch (error) {
    console.error('Investor KYC review error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/investors/:id/status', authorize('investor_ops.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const { id } = req.params;
    const normalizedStatus = String(req.body?.status || '').toUpperCase();

    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid investor status' });
    }

    const investor = await prisma.investor.findUnique({ where: { id } });
    if (!investor || (!isSuperAdmin && investor.tenantId !== tenantId)) {
      return res.status(404).json({ error: 'Investor not found' });
    }

    const updated = await prisma.investor.update({
      where: { id },
      data: { status: normalizedStatus as any }
    });

    return res.json({ message: 'Investor status updated', investor: updated });
  } catch (error) {
    console.error('Investor status update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
