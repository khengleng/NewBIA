import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import redis from '../redis';

const router = Router();

function requireTenantId(req: AuthenticatedRequest, res: Response): string | undefined {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
        res.status(403).json({ error: 'Tenant context required' });
        return undefined;
    }
    return tenantId;
}

/**
 * Get role-based dashboard statistics
 * GET /api/dashboard/stats
 */
router.get('/stats', authorize('dashboard.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        let stats: any = {};

        switch (role) {
            case 'SME': {
                const sme = await prisma.sME.findUnique({ where: { userId } });
                if (sme) {
                    const [dealsCount, activeBookings, documentCount] = await Promise.all([
                        prisma.deal.count({ where: { smeId: sme.id, tenantId } }),
                        prisma.booking.count({ where: { userId, status: 'CONFIRMED', tenantId } }),
                        prisma.document.count({ where: { smeId: sme.id, tenantId } })
                    ]);

                    const deals = await prisma.deal.findMany({ where: { smeId: sme.id, tenantId } });
                    const totalFunding = deals.reduce((acc, deal) => acc + deal.amount, 0);

                    // Calculate Profile Completeness
                    let filledFields = 0;
                    const totalFields = 6; // description, website, location, sector, stage, documents
                    if (sme.description) filledFields++;
                    if (sme.website) filledFields++;
                    if (sme.location) filledFields++;
                    if (sme.sector) filledFields++;
                    if (sme.stage) filledFields++;
                    if (documentCount > 0) filledFields++;

                    const profileCompleteness = Math.round((filledFields / totalFields) * 100);

                    // Real Match Interest (Investors interested in this SME)
                    const interestCount = await prisma.matchInterest.count({
                        where: {
                            match: { smeId: sme.id, tenantId },
                            interest: true,
                            // Ensure the interest comes from an investor, not the SME itself
                            user: { role: 'INVESTOR' }
                        }
                    });

                    stats = {
                        smeName: sme.name,
                        smeStatus: sme.status,
                        sector: sme.sector,
                        stage: sme.stage,
                        totalDeals: dealsCount,
                        activeBookings,
                        documents: documentCount,
                        fundingGoal: totalFunding,
                        profileCompleteness,
                        matchCount: await prisma.match.count({ where: { smeId: sme.id, tenantId } }),
                        interestExpressed: interestCount,
                        activeDisputes: await (prisma as any).dispute.count({
                            where: {
                                deal: { smeId: sme.id },
                                status: { in: ['OPEN', 'IN_PROGRESS'] }
                            }
                        })
                    };
                }
                break;
            }

            case 'INVESTOR': {
                const investor = await prisma.investor.findFirst({ where: { userId, tenantId } });
                if (investor) {
                    const [matchCount, dealInvestmentCount, activeOffers, syndicateMembershipCount] = await Promise.all([
                        prisma.match.count({ where: { investorId: investor.id, tenantId } }),
                        prisma.dealInvestor.count({ where: { investorId: investor.id, status: { in: ['COMPLETED', 'APPROVED'] }, deal: { tenantId } } }),
                        prisma.dealInvestor.count({ where: { investorId: investor.id, status: 'PENDING', deal: { tenantId } } }),
                        prisma.syndicateMember.count({ where: { investorId: investor.id, status: 'APPROVED', syndicate: { tenantId } } })
                    ]);

                    // Calculate Portfolio Value from both deals and syndicates
                    const [completedDealInvestments, syndicateInvestments] = await Promise.all([
                        prisma.dealInvestor.findMany({
                            where: {
                                investorId: investor.id,
                                status: { in: ['COMPLETED', 'APPROVED'] },
                                deal: { tenantId }
                            },
                            select: { amount: true, createdAt: true }
                        }),
                        prisma.syndicateMember.findMany({
                            where: {
                                investorId: investor.id,
                                status: 'APPROVED',
                                syndicate: { tenantId }
                            },
                            select: { amount: true, joinedAt: true }
                        })
                    ]);

                    const dealPortfolioValue = completedDealInvestments.reduce((sum, d_inv) => sum + d_inv.amount, 0);
                    const syndicatePortfolioValue = syndicateInvestments.reduce((sum, s_inv) => sum + s_inv.amount, 0);
                    const portfolioValue = dealPortfolioValue + syndicatePortfolioValue;

                    // Calculate estimated performance for the dashboard
                    const totalPerformance = 0; // Set to 0. Real performance will be calculated from actual dividends or exits in the future.

                    // Fetch recent activity for the dashboard
                    const [recentDealInvestments, recentSyndicateInvestments, openDeals] = await Promise.all([
                        prisma.dealInvestor.findMany({
                            where: { investorId: investor.id, deal: { tenantId } },
                            include: { deal: { include: { sme: true } } },
                            orderBy: { createdAt: 'desc' },
                            take: 3
                        }),
                        prisma.syndicateMember.findMany({
                            where: { investorId: investor.id, syndicate: { tenantId } },
                            include: { syndicate: true },
                            orderBy: { joinedAt: 'desc' },
                            take: 3
                        }),
                        prisma.deal.findMany({
                            where: { status: 'PUBLISHED', tenantId },
                            include: { sme: true },
                            take: 2,
                            orderBy: { createdAt: 'desc' }
                        })
                    ]);

                    const recentInvestments = [
                        ...recentDealInvestments.map(inv => ({
                            id: inv.id,
                            name: inv.deal?.sme?.name || 'Unknown SME',
                            amount: inv.amount,
                            type: 'DEAL',
                            date: inv.createdAt,
                            status: inv.status
                        })),
                        ...recentSyndicateInvestments.map(inv => ({
                            id: inv.id,
                            name: inv.syndicate?.name || 'Syndicate',
                            amount: inv.amount,
                            type: 'SYNDICATE',
                            date: inv.joinedAt,
                            status: inv.status
                        }))
                    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

                    stats = {
                        totalMatches: matchCount,
                        activeInvestments: dealInvestmentCount + syndicateMembershipCount,
                        pendingOffers: activeOffers,
                        portfolioValue,
                        totalPerformance,
                        syndicateMemberships: syndicateMembershipCount,
                        avgMatchScore: 85,
                        recentInvestments,
                        marketOpportunities: openDeals.map(d => ({
                            id: d.id,
                            name: d.sme?.name || 'SME',
                            title: d.title,
                            amount: d.amount,
                            sector: d.sme?.sector
                        }))
                    };
                }
                break;
            }

            case 'ADVISOR': {
                const advisor = await prisma.advisor.findFirst({ where: { userId, tenantId } });
                if (advisor) {
                    const [totalBookings, activeClients, pendingCerts] = await Promise.all([
                        prisma.booking.count({ where: { advisorId: advisor.id, tenantId } }),
                        prisma.booking.groupBy({
                            by: ['userId'],
                            where: { advisorId: advisor.id, tenantId }
                        }).then(groups => groups.length),
                        prisma.certification.count({ where: { advisorId: advisor.id, status: 'PENDING', sme: { tenantId } } })
                    ]);

                    const completedPaidBookings = await prisma.booking.findMany({
                        where: { advisorId: advisor.id, status: 'COMPLETED', amount: { not: null }, tenantId }
                    });
                    const totalEarnings = completedPaidBookings.reduce((acc, b) => acc + (b.amount || 0), 0);

                    stats = {
                        bookings: totalBookings,
                        clients: activeClients,
                        pendingCertifications: pendingCerts,
                        earnings: totalEarnings,
                        rating: 4.9
                    };
                }
                break;
            }

            case 'ADMIN':
            case 'SUPER_ADMIN': {
                const [users, smes, investors, deals, bookingRevenue, deletedUsers, activeDisputesCount, syndicateRevenue, secondaryTradingRevenue, dealInvestments, recentLogs] = await Promise.all([
                    prisma.user.count({ where: { tenantId, status: { not: 'DELETED' as any } } }),
                    prisma.sME.count({ where: { tenantId } }),
                    prisma.investor.count({ where: { tenantId } }),
                    prisma.deal.count({
                        where: {
                            tenantId,
                            status: { in: ['PUBLISHED', 'NEGOTIATION', 'DUE_DILIGENCE', 'FUNDED'] }
                        }
                    }),
                    prisma.booking.aggregate({
                        where: { status: 'CONFIRMED', tenantId },
                        _sum: { amount: true }
                    }),
                    prisma.user.count({ where: { status: 'DELETED' as any, tenantId } }),
                    (prisma as any).dispute.count({
                        where: { tenantId, status: { in: ['OPEN', 'IN_PROGRESS'] } }
                    }),
                    // Syndicate investments
                    prisma.syndicateMember.aggregate({
                        where: { syndicate: { tenantId }, status: 'APPROVED' },
                        _sum: { amount: true }
                    }),
                    // Secondary trading fees (1% of trade volume)
                    prisma.secondaryTrade.aggregate({
                        where: { status: 'COMPLETED', listing: { tenantId } },
                        _sum: { fee: true }
                    }),
                    // Deal investments
                    prisma.dealInvestor.aggregate({
                        where: { status: 'COMPLETED', deal: { tenantId } },
                        _sum: { amount: true }
                    }),
                    prisma.activityLog.findMany({
                        where: { tenantId },
                        orderBy: { timestamp: 'desc' },
                        take: 5,
                        select: {
                            id: true,
                            action: true,
                            entityType: true,
                            timestamp: true
                        }
                    })
                ]);

                // Volume includes capital moved through platform workflows.
                const totalVolume = (
                    (bookingRevenue._sum.amount || 0) +
                    (syndicateRevenue._sum.amount || 0) +
                    (secondaryTradingRevenue._sum.fee || 0) +
                    (dealInvestments._sum.amount || 0)
                );
                // Revenue tracks monetization (fees + paid bookings).
                const platformRevenue = (
                    (bookingRevenue._sum.amount || 0) +
                    (secondaryTradingRevenue._sum.fee || 0)
                );

                const activityFallback = [
                    {
                        id: 'fallback-kyc',
                        title: 'Pending KYC requests in queue',
                        timestamp: new Date()
                    }
                ];
                const recentActivity = (recentLogs.length > 0 ? recentLogs : activityFallback).map((item: any) => ({
                    id: item.id,
                    title: item.title || `${item.action} on ${item.entityType}`,
                    timestamp: item.timestamp
                }));

                stats = {
                    users,
                    smes,
                    investors,
                    deals,
                    totalVolume,
                    platformRevenue,
                    deletedUsers,
                    activeDisputes: activeDisputesCount,
                    generatedAt: new Date().toISOString(),
                    systemOverview: {
                        api: 'online',
                        database: 'online',
                        redis: redis.status === 'ready' ? 'online' : 'degraded'
                    },
                    recentActivity
                };
                break;
            }
        }

        return res.json({ role, stats });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

/**
 * Get platform analytics data
 * GET /api/dashboard/analytics
 */
router.get('/analytics', authorize('dashboard.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        // 1. Fetch KPIs
        const [
            totalDeals,
            activeDeals,
            dealInvestmentAgg,
            syndicateInvestmentAgg,
            totalSyndicates,
            activeSMEs,
            activeInvestors,
            pendingMatches
        ] = await Promise.all([
            prisma.deal.count({ where: { tenantId } }),
            prisma.deal.count({
                where: {
                    tenantId,
                    status: { in: ['PUBLISHED', 'NEGOTIATION', 'FUNDED'] }
                }
            }),
            // Deal investments
            prisma.dealInvestor.aggregate({
                where: { status: 'COMPLETED', deal: { tenantId } },
                _sum: { amount: true }
            }),
            // Syndicate investments
            prisma.syndicateMember.aggregate({
                where: { syndicate: { tenantId }, status: 'APPROVED' },
                _sum: { amount: true }
            }),
            prisma.syndicate.count({ where: { tenantId } }),
            prisma.sME.count({ where: { tenantId, status: 'CERTIFIED' } }),
            prisma.investor.count({ where: { tenantId, kycStatus: 'VERIFIED' } }),
            prisma.match.count({ where: { tenantId, status: 'PENDING' } })
        ]);

        // Calculate total investment including both deals and syndicates
        const dealInvestment = dealInvestmentAgg._sum.amount || 0;
        const syndicateInvestment = syndicateInvestmentAgg._sum.amount || 0;
        const totalInvestment = dealInvestment + syndicateInvestment;

        const totalDealsAndSyndicates = totalDeals + totalSyndicates;
        const avgDealSize = totalDealsAndSyndicates > 0 ? totalInvestment / totalDealsAndSyndicates : 0;

        // Calculate success rate based on CLOSED deals
        const closedDeals = await prisma.deal.count({
            where: { tenantId, status: 'CLOSED' }
        });
        const successRate = totalDeals > 0 ? Math.round((closedDeals / totalDeals) * 100) : 0;

        const kpis = {
            totalDeals: totalDealsAndSyndicates,
            activeDeals,
            totalInvestment,
            avgDealSize,
            successRate,
            activeSMEs,
            activeInvestors,
            pendingMatches
        };

        // 2. Fetch Monthly Deals and Syndicates (Last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const [deals, syndicateMembers] = await Promise.all([
            prisma.deal.findMany({
                where: {
                    tenantId,
                    createdAt: { gte: sixMonthsAgo }
                },
                select: {
                    createdAt: true,
                    amount: true
                },
                orderBy: { createdAt: 'asc' }
            }),
            prisma.syndicateMember.findMany({
                where: {
                    syndicate: { tenantId },
                    status: 'APPROVED',
                    joinedAt: { gte: sixMonthsAgo }
                },
                select: {
                    joinedAt: true,
                    amount: true
                },
                orderBy: { joinedAt: 'asc' }
            })
        ]);

        const monthlyDealsMap = new Map<string, { deals: number, value: number }>();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Add deal data
        deals.forEach(deal => {
            const date = new Date(deal.createdAt);
            const monthKey = monthNames[date.getMonth()];

            const current = monthlyDealsMap.get(monthKey) || { deals: 0, value: 0 };
            monthlyDealsMap.set(monthKey, {
                deals: current.deals + 1,
                value: current.value + deal.amount
            });
        });

        // Add syndicate investment data
        syndicateMembers.forEach(member => {
            const date = new Date(member.joinedAt);
            const monthKey = monthNames[date.getMonth()];

            const current = monthlyDealsMap.get(monthKey) || { deals: 0, value: 0 };
            monthlyDealsMap.set(monthKey, {
                deals: current.deals + 1,
                value: current.value + member.amount
            });
        });

        const monthlyDeals = Array.from(monthlyDealsMap.entries()).map(([month, data]) => ({
            month,
            deals: data.deals,
            value: data.value
        }));

        // 3. Sector Distribution
        const sectors = await prisma.sME.groupBy({
            by: ['sector'],
            where: { tenantId },
            _count: { id: true }
        });

        const sectorDistribution: { [key: string]: number } = {};
        sectors.forEach(s => {
            sectorDistribution[s.sector] = s._count.id;
        });

        // 4. Stage Distribution
        const stages = await prisma.deal.groupBy({
            by: ['status'],
            where: { tenantId },
            _count: { id: true }
        });

        const stageDistribution: { [key: string]: number } = {};
        stages.forEach(s => {
            stageDistribution[s.status] = s._count.id;
        });

        // 5. Recent Activity (Mocked from Deals for now)
        const recentDeals = await prisma.deal.findMany({
            where: { tenantId },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { sme: { select: { name: true } } }
        });

        const recentActivity = recentDeals.map(deal => ({
            type: 'DEAL_CREATED',
            description: `New deal posted by ${deal.sme.name}: ${deal.title}`,
            timestamp: deal.createdAt.toISOString()
        }));

        res.json({
            kpis,
            monthlyDeals,
            sectorDistribution,
            stageDistribution,
            recentActivity
        });

    } catch (error) {
        console.error('Analytics dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
});

export default router;
