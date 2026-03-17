import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { sendNotification } from '../services/notification.service';

const router = Router();

// Refined scoring helper
const calculateMatchScore = (sme: any, investor: any) => {
    // ... (Score logic remains same, abstracted for brevity if not changing)
    let score = 0;
    const factors: any = {};

    // 1. Sector Match (30 points)
    const preferredSectors = (investor.preferences as any)?.preferredSectors || [];
    if (preferredSectors.includes(sme.sector)) {
        score += 30;
        factors.sector = { score: 30, details: `Perfect alignment in ${sme.sector}` };
    } else {
        factors.sector = { score: 0, details: 'Sector mismatch' };
    }

    // 2. Stage Match (20 points)
    const preferredStages = (investor.preferences as any)?.preferredStages || [];
    if (preferredStages.includes(sme.stage)) {
        score += 20;
        factors.stage = { score: 20, details: `Aligned with ${sme.stage} stage` };
    } else {
        factors.stage = { score: 0, details: 'Stage mismatch' };
    }

    // 3. Investment Amount Fit (20 points)
    const minTicket = (investor.preferences as any)?.minInvestment || 0;
    const maxTicket = (investor.preferences as any)?.maxInvestment || 1000000000;
    if (sme.fundingRequired >= minTicket && sme.fundingRequired <= maxTicket) {
        score += 20;
        factors.funding = { score: 20, details: 'Funding requirement fits investor ticket size' };
    } else {
        factors.funding = { score: 0, details: 'Ticket size mismatch' };
    }

    // 4. Advisor Certification (15 points)
    if (sme.certified) {
        score += 15;
        factors.certification = { score: 15, details: 'SME is Advisor Certified (Proven Diligence)' };
    } else {
        factors.certification = { score: 0, details: 'Self-reported business data' };
    }

    // 5. Traction/Platform Score (15 points)
    const tractionContribution = Math.min((sme.score || 0) / 100 * 15, 15);
    score += Math.round(tractionContribution);
    factors.traction = { score: Math.round(tractionContribution), details: `Based on platform assessment score (${sme.score})` };

    return { score: Math.round(score), factors };
};

// Helper: Handle Interest & Notifications
async function handleMatchInterestNotifications(matchId: string, userId: string, interest: boolean) {
    if (!interest) return;

    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: { sme: true, investor: true }
    });

    if (match) {
        const isInvestor = userId === match.investor.userId;
        const targetUserId = isInvestor ? match.sme.userId : match.investor.userId;
        const actorName = isInvestor ? 'An Investor' : 'An SME';

        // 1. Notify the passed party
        await sendNotification(
            targetUserId,
            'New Interest Received',
            `${actorName} is interested in connecting with you!`,
            'INTEREST_RECEIVED',
            `/matchmaking`
        );

        // 2. Check for Mutual Interest
        const otherInterest = await prisma.matchInterest.findUnique({
            where: {
                matchId_userId: {
                    matchId,
                    userId: targetUserId
                }
            }
        });

        if (otherInterest?.interest) {
            // Mutual Match! Notify both!
            await sendNotification(
                userId,
                "It's a Match! 🎉",
                `You have a new mutual match with ${isInvestor ? match.sme.name : match.investor.name}.`,
                'MATCH_FOUND',
                `/matchmaking`
            );

            await sendNotification(
                targetUserId,
                "It's a Match! 🎉",
                `You have a new mutual match with ${isInvestor ? match.investor.name : match.sme.name}.`,
                'MATCH_FOUND',
                `/matchmaking`
            );
        }
    }
}

// Get matches
router.get('/', authorize('matchmaking.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;

        let matches: any[] = [];

        if (role === 'SME') {
            const sme = await prisma.sME.findUnique({
                where: { userId },
                include: { user: true }
            });
            if (!sme || sme.user.status !== 'ACTIVE') return res.json({ matches: [], stats: {} });

            matches = await prisma.match.findMany({
                where: {
                    smeId: sme.id,
                    investor: { user: { status: 'ACTIVE' } }
                },
                include: { investor: true, interests: true },
                orderBy: { score: 'desc' }
            });
        } else if (role === 'INVESTOR') {
            const investor = await prisma.investor.findUnique({
                where: { userId },
                include: { user: true }
            });
            if (!investor || investor.user.status !== 'ACTIVE') return res.json({ matches: [], stats: {} });

            matches = await prisma.match.findMany({
                where: {
                    investorId: investor.id,
                    sme: { user: { status: 'ACTIVE' } }
                },
                include: { sme: true, interests: true },
                orderBy: { score: 'desc' }
            });
        } else {
            // Admin/Advisor see all
            matches = await prisma.match.findMany({
                include: { sme: true, investor: true, interests: true },
                orderBy: { score: 'desc' },
                take: 50
            });
        }

        // Stats calculation
        const stats = {
            totalPossibleMatches: matches.length,
            highScoreMatches: matches.filter(m => m.score >= 80).length,
            mediumScoreMatches: matches.filter(m => m.score >= 50 && m.score < 80).length,
            mutualInterests: matches.filter(m => {
                const investorLiked = m.interests.some((i: any) => i.interest === true && i.userId === m.investor?.userId);
                const smeLiked = m.interests.some((i: any) => i.interest === true && i.userId === m.sme?.userId);
                return (investorLiked && smeLiked) || false;
            }).length
        };

        return res.json({ matches, stats });
    } catch (error) {
        console.error('Error fetching matches:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Trigger Re-computation
router.post('/recompute', authorize('matchmaking.create_match'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const smes = await prisma.sME.findMany({
            where: { user: { status: 'ACTIVE' } }
        });
        const investors = await prisma.investor.findMany({
            where: { user: { status: 'ACTIVE' } }
        });
        const tenantId = req.user?.tenantId || 'default';

        let count = 0;
        for (const sme of smes) {
            for (const investor of investors) {
                const { score, factors } = calculateMatchScore(sme, investor);

                await prisma.match.upsert({
                    where: {
                        smeId_investorId: {
                            smeId: sme.id,
                            investorId: investor.id
                        }
                    },
                    update: { score, factors: factors as any },
                    create: {
                        tenantId,
                        smeId: sme.id,
                        investorId: investor.id,
                        score,
                        factors: factors as any
                    }
                });
                count++;
            }
        }

        return res.json({ message: `Successfully recomputed ${count} matches` });
    } catch (error) {
        console.error('Error recomputing matches:', error);
        return res.status(500).json({ error: 'Failed to recompute matches' });
    }
});

// Express Interest (By Match ID)
router.post('/:id/interest', authorize('matchmaking.express_interest'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { interest } = req.body; // true = like, false = dislike
        const matchId = req.params.id;
        const userId = req.user!.id;

        const updatedInterest = await prisma.matchInterest.upsert({
            where: {
                matchId_userId: { matchId, userId }
            },
            update: { interest },
            create: { matchId, userId, interest }
        });

        // Notifications
        await handleMatchInterestNotifications(matchId, userId, interest);

        return res.json({ message: 'Interest recorded', interest: updatedInterest });
    } catch (error) {
        console.error('Error recording interest:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Express Interest (By Deal ID - for Investor Dashboard)
router.post('/interest/deal/:dealId', authorize('matchmaking.express_interest'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dealId } = req.params;
        const userId = req.user!.id;
        const interest = true; // Implicitly true when clicking "Express Interest" button

        // 1. Get Deal & SME
        const deal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: { sme: true }
        });

        if (!deal) return res.status(404).json({ error: 'Deal not found' });

        // 2. Get Investor Profile
        const investor = await prisma.investor.findUnique({ where: { userId } });
        if (!investor) return res.status(403).json({ error: 'Investor profile not found' });

        // 3. Find or Create Match
        // We need a match record to hang interest on. If it doesn't exist, create it (likely with 0 score initially until recompute)
        let match = await prisma.match.findUnique({
            where: {
                smeId_investorId: {
                    smeId: deal.smeId,
                    investorId: investor.id
                }
            }
        });

        if (!match) {
            // Compute score on the fly
            const { score, factors } = calculateMatchScore(deal.sme, investor);

            match = await prisma.match.create({
                data: {
                    tenantId: req.user?.tenantId || 'default',
                    smeId: deal.smeId,
                    investorId: investor.id,
                    score,
                    factors: factors as any
                }
            });
        }

        // 4. Record Interest
        const updatedInterest = await prisma.matchInterest.upsert({
            where: {
                matchId_userId: { matchId: match.id, userId }
            },
            update: { interest },
            create: { matchId: match.id, userId, interest }
        });

        // 5. Notifications
        await handleMatchInterestNotifications(match.id, userId, interest);

        return res.json({ message: 'Interest expressed successfully', matchId: match.id });

    } catch (error) {
        console.error('Error expressing interest in deal:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
