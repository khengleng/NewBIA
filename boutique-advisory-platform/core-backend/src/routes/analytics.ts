import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';

const router = Router();

// Get financial performance stats
router.get('/performance', authorize('analytics.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        // TODO: Implement real-time performance analytics from transactions
        const performanceData = {
            monthlyReturns: [],
            sectorDistribution: [],
            pipelineValue: 0,
            activeDeals: 0,
            successRate: 0
        };

        res.json(performanceData);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get platform-wide stats for institutional display
router.get('/platform-overview', authorize('analytics.system'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const stats = await prisma.$transaction([
            prisma.user.count(),
            prisma.sME.count(),
            prisma.investor.count(),
            prisma.deal.count(),
            prisma.deal.aggregate({ _sum: { amount: true } })
        ]);

        res.json({
            totalUsers: stats[0],
            totalSMEs: stats[1],
            totalInvestors: stats[2],
            totalDeals: stats[3],
            totalVolume: stats[4]._sum.amount || 0,
            avgDealSize: (stats[4]._sum.amount || 0) / (stats[3] || 1)
        });
    } catch (error) {
        console.error('Error fetching platform overview:', error);
        res.status(500).json({ error: 'Failed to fetch platform overview' });
    }
});

export default router;
