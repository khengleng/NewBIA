import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';

const router = Router();

// Get reports list
router.get('/', authorize('report.list'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const reports = [
            {
                id: 1,
                title: 'Monthly Summary - January 2024',
                type: 'PDF',
                date: '2024-01-31',
                status: 'Generated',
                size: '2.4 MB',
                description: 'A comprehensive summary of all platform activity in January.'
            },
            {
                id: 2,
                title: 'Investment Performance Q4',
                type: 'Excel',
                date: '2024-01-15',
                status: 'Generated',
                size: '1.2 MB',
                description: 'Detailed analysis of investment returns for the last quarter of 2023.'
            }
        ];

        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get stats for reports
router.get('/stats', authorize('report.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';

        const [
            dealCount,
            syndicateCount,
            smeCount,
            dealInvestments,
            syndicateInvestments,
            closedDeals
        ] = await Promise.all([
            prisma.deal.count({ where: { tenantId } }),
            prisma.syndicate.count({ where: { tenantId } }),
            prisma.sME.count({ where: { tenantId, status: 'CERTIFIED' } }),
            prisma.dealInvestor.aggregate({
                where: { status: 'COMPLETED' },
                _sum: { amount: true }
            }),
            prisma.syndicateMember.aggregate({
                where: { syndicate: { tenantId }, status: 'APPROVED' },
                _sum: { amount: true }
            }),
            prisma.deal.count({ where: { tenantId, status: 'CLOSED' } })
        ]);

        const totalDeals = dealCount + syndicateCount;
        const totalInvestment = (dealInvestments._sum.amount || 0) + (syndicateInvestments._sum.amount || 0);
        const successRate = dealCount > 0 ? Math.round((closedDeals / dealCount) * 100) : 0;

        // Format investment value
        const formatInvestment = (value: number): string => {
            if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
            return `$${value}`;
        };

        const stats = [
            { title: 'Total Deals', value: totalDeals.toString(), change: '+12%', trend: 'up' },
            { title: 'Active SMEs', value: smeCount.toString(), change: '+5%', trend: 'up' },
            { title: 'Total Investment', value: formatInvestment(totalInvestment), change: '+20%', trend: 'up' },
            { title: 'Success Rate', value: `${successRate}%`, change: '+3%', trend: 'up' }
        ];

        res.json({ stats });
    } catch (error) {
        console.error('Error fetching report stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Generate a new report
router.post('/generate', authorize('report.create'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { reportType } = req.body;

        const newReport = {
            id: Date.now(),
            title: `${reportType} - ${new Date().toLocaleDateString()}`,
            type: 'PDF',
            date: new Date().toISOString().split('T')[0],
            status: 'Generated',
            size: '1.0 MB',
            description: `Auto-generated ${reportType.toLowerCase()} report.`
        };

        res.status(201).json({ report: newReport });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
