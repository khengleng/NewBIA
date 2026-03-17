/**
 * Syndicate Routes - Investor Pooling (like AngelList)
 * 
 * Uses Prisma ORM for database persistence
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma, prismaReplica } from '../database';
import { shouldUseDatabase } from '../migration-manager';
import { SyndicateStatus } from '@prisma/client';

const router = Router();

// Helper to calculate raised amount from members
async function calculateRaisedAmount(syndicateId: string): Promise<number> {
    const result = await prismaReplica.syndicateMember.aggregate({
        where: {
            syndicateId,
            status: 'APPROVED'
        },
        _sum: { amount: true }
    });
    return result._sum.amount || 0;
}

// Get all syndicates
router.get('/', authorize('syndicate.list'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            // Fallback to in-memory for backwards compatibility
            res.json([]);
            return;
        }

        const { status, leadInvestorId } = req.query;

        const syndicates = await prismaReplica.syndicate.findMany({
            where: {
                ...(status ? { status: status as SyndicateStatus } : {}),
                ...(leadInvestorId ? { leadInvestorId: leadInvestorId as string } : {})
            },
            include: {
                leadInvestor: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        userId: true
                    }
                },
                deal: {
                    select: {
                        id: true,
                        title: true,
                        amount: true
                    }
                },
                members: {
                    where: { status: 'APPROVED' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Transform for frontend
        const result = syndicates.map(s => ({
            ...s,
            raisedAmount: s.members.reduce((sum, m) => sum + m.amount, 0),
            memberCount: s.members.length,
            progress: Math.round((s.members.reduce((sum, m) => sum + m.amount, 0) / s.targetAmount) * 100)
        }));

        res.json(result);
    } catch (error) {
        console.error('Error fetching syndicates:', error);
        res.status(500).json({ error: 'Failed to fetch syndicates' });
    }
});

// Get syndicate by ID
router.get('/:id', authorize('syndicate.read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(404).json({ error: 'Syndicate not found' });
            return;
        }

        const syndicate = await prismaReplica.syndicate.findUnique({
            where: { id: req.params.id },
            include: {
                leadInvestor: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        userId: true
                    }
                },
                deal: {
                    select: {
                        id: true,
                        title: true,
                        amount: true,
                        sme: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
                members: {
                    include: {
                        investor: {
                            select: {
                                id: true,
                                name: true,
                                type: true
                            }
                        }
                    }
                }
            }
        });

        if (!syndicate) {
            res.status(404).json({ error: 'Syndicate not found' });
            return;
        }

        // Auto-fix member tokens if missing for display
        const members = syndicate.members.map(member => {
            if (syndicate.isTokenized && syndicate.pricePerToken && (!member.tokens || member.tokens === 0)) {
                return {
                    ...member,
                    tokens: member.amount / syndicate.pricePerToken
                };
            }
            return member;
        });

        const raisedAmount = members
            .filter(m => m.status === 'APPROVED')
            .reduce((sum, m) => sum + m.amount, 0);

        res.json({
            ...syndicate,
            members,
            raisedAmount,
            memberCount: members.length,
            progress: Math.round((raisedAmount / syndicate.targetAmount) * 100)
        });
    } catch (error) {
        console.error('Error fetching syndicate:', error);
        res.status(500).json({ error: 'Failed to fetch syndicate' });
    }
});

// Create syndicate (Lead investor only)
router.post('/', authorize('syndicate.create'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const {
            name,
            description,
            targetAmount,
            minInvestment,
            maxInvestment,
            managementFee,
            carryFee,
            dealId,
            closingDate,
            isTokenized,
            tokenName,
            tokenSymbol,
            pricePerToken,
            totalTokens
        } = req.body;

        // Only INVESTOR role can create syndicates
        if (req.user?.role !== 'INVESTOR') {
            res.status(403).json({ error: 'Only investors can create syndicates' });
            return;
        }

        // Get investor ID for the current user
        const investor = await prisma.investor.findFirst({
            where: { userId: req.user?.id }
        });

        if (!investor) {
            res.status(403).json({ error: 'Investor profile not found. Please complete your investor onboarding first.' });
            return;
        }

        const syndicate = await prisma.syndicate.create({
            data: {
                tenantId: investor.tenantId,
                name,
                description,
                leadInvestorId: investor.id,
                targetAmount: Number(targetAmount),
                minInvestment: minInvestment ? Number(minInvestment) : 1000,
                maxInvestment: maxInvestment ? Number(maxInvestment) : null,
                managementFee: managementFee ? Number(managementFee) : 2.0,
                carryFee: carryFee ? Number(carryFee) : 20.0,
                dealId: dealId || null,
                closingDate: closingDate ? new Date(closingDate) : null,
                isTokenized: !!isTokenized,
                tokenName,
                tokenSymbol,
                pricePerToken: pricePerToken ? Number(pricePerToken) : null,
                totalTokens: totalTokens ? Number(totalTokens) : null,
                status: 'FORMING'
            },
            include: {
                leadInvestor: {
                    select: { id: true, name: true, type: true }
                },
                deal: {
                    select: { id: true, title: true, amount: true }
                }
            }
        });

        res.status(201).json({
            ...syndicate,
            raisedAmount: 0,
            memberCount: 0,
            progress: 0
        });
    } catch (error) {
        console.error('Error creating syndicate:', error);
        res.status(500).json({ error: 'Failed to create syndicate' });
    }
});

// Join syndicate
router.post('/:id/join', authorize('syndicate.join'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const { amount } = req.body;

        // Only INVESTOR role can join syndicates
        if (req.user?.role !== 'INVESTOR') {
            res.status(403).json({ error: 'Only investors can join syndicates' });
            return;
        }

        // Get investor ID for the current user
        const investor = await prisma.investor.findFirst({
            where: { userId: req.user?.id }
        });

        if (!investor) {
            res.status(403).json({ error: 'Investor profile not found. Please complete your investor onboarding first.' });
            return;
        }

        const syndicate = await prisma.syndicate.findUnique({
            where: { id: req.params.id }
        });

        if (!syndicate) {
            res.status(404).json({ error: 'Syndicate not found' });
            return;
        }

        if (syndicate.status !== 'OPEN' && syndicate.status !== 'FORMING') {
            res.status(400).json({ error: 'Syndicate is not accepting new members' });
            return;
        }

        if (amount < syndicate.minInvestment) {
            res.status(400).json({ error: `Minimum investment is $${syndicate.minInvestment}` });
            return;
        }

        if (syndicate.maxInvestment && amount > syndicate.maxInvestment) {
            res.status(400).json({ error: `Maximum investment is $${syndicate.maxInvestment}` });
            return;
        }

        // Calculate current raised amount
        const result = await prisma.syndicateMember.aggregate({
            where: {
                syndicateId: req.params.id,
                status: 'APPROVED'
            },
            _sum: { amount: true }
        });
        const currentRaised = result._sum.amount || 0;

        if (currentRaised + amount > syndicate.targetAmount) {
            const remaining = syndicate.targetAmount - currentRaised;
            res.status(400).json({ error: `Investment exceeds target amount. Remaining allocation: $${remaining.toLocaleString()}` });
            return;
        }

        // Check token supply if tokenized
        if (syndicate.isTokenized && syndicate.pricePerToken && syndicate.totalTokens) {
            const tokensNeeded = amount / syndicate.pricePerToken;
            const currentTokensSold = syndicate.tokensSold || 0;

            if (currentTokensSold + tokensNeeded > syndicate.totalTokens) {
                const remainingTokens = syndicate.totalTokens - currentTokensSold;
                res.status(400).json({ error: `Investment exceeds available tokens. Remaining tokens: ${remainingTokens.toLocaleString()}` });
                return;
            }
        }

        // Check if already a member
        const existingMember = await prisma.syndicateMember.findUnique({
            where: {
                syndicateId_investorId: {
                    syndicateId: req.params.id,
                    investorId: investor.id
                }
            }
        });

        if (existingMember) {
            // Allow top-up investment
            let additionalTokens = 0;
            if (syndicate.isTokenized && syndicate.pricePerToken) {
                additionalTokens = amount / syndicate.pricePerToken;
            }

            const updatedMember = await prisma.syndicateMember.update({
                where: {
                    syndicateId_investorId: {
                        syndicateId: req.params.id,
                        investorId: investor.id
                    }
                },
                data: {
                    amount: { increment: amount },
                    tokens: { increment: additionalTokens }
                },
                include: {
                    investor: {
                        select: { id: true, name: true, type: true }
                    }
                }
            });

            // If tokenized and already approved, update total sold immediately
            if (syndicate.isTokenized && existingMember.status === 'APPROVED') {
                await prisma.syndicate.update({
                    where: { id: syndicate.id },
                    data: {
                        tokensSold: { increment: additionalTokens }
                    }
                });
            }

            res.status(200).json({
                message: 'Investment topped up successfully',
                member: updatedMember
            });
            return;
        }

        const isLeadInvestor = syndicate.leadInvestorId === investor.id;
        const initialStatus = isLeadInvestor ? 'APPROVED' : 'PENDING';

        // Calculate tokens if syndicate is tokenized
        let tokensToIssue = 0;
        if (syndicate.isTokenized && syndicate.pricePerToken) {
            tokensToIssue = amount / syndicate.pricePerToken;
        }

        const member = await prisma.syndicateMember.create({
            data: {
                syndicateId: req.params.id,
                investorId: investor.id,
                amount,
                tokens: tokensToIssue,
                status: initialStatus
            },
            include: {
                investor: {
                    select: { id: true, name: true, type: true }
                }
            }
        });

        res.status(201).json({
            message: isLeadInvestor ? 'Joined successfully (GP Commitment Auto-approved)' : 'Join request submitted',
            member
        });
    } catch (error) {
        console.error('Error joining syndicate:', error);
        res.status(500).json({ error: 'Failed to join syndicate' });
    }
});

// Update syndicate
router.patch('/:id', authorize('syndicate.manage'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const syndicate = await prisma.syndicate.findUnique({
            where: { id: req.params.id },
            include: { leadInvestor: true }
        });

        if (!syndicate) {
            res.status(404).json({ error: 'Syndicate not found' });
            return;
        }

        // Check ownership
        const investor = await prisma.investor.findFirst({
            where: { userId: req.user?.id }
        });
        if (investor?.id !== syndicate.leadInvestorId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
            res.status(403).json({ error: 'Unauthorized to update this syndicate' });
            return;
        }

        const updateData = { ...req.body };
        // Clean up numeric fields
        ['targetAmount', 'minInvestment', 'maxInvestment', 'managementFee', 'carryFee', 'pricePerToken', 'totalTokens'].forEach(field => {
            if (updateData[field] !== undefined) updateData[field] = updateData[field] === null ? null : Number(updateData[field]);
        });
        if (updateData.closingDate) updateData.closingDate = new Date(updateData.closingDate);

        const updatedSyndicate = await prisma.syndicate.update({
            where: { id: req.params.id },
            data: updateData
        });

        // If newly tokenized or price changed, update all members
        if (updatedSyndicate.isTokenized && updatedSyndicate.pricePerToken) {
            const members = await prisma.syndicateMember.findMany({
                where: { syndicateId: updatedSyndicate.id }
            });

            let totalTokensSold = 0;
            for (const member of members) {
                const tokens = member.amount / updatedSyndicate.pricePerToken;
                await prisma.syndicateMember.update({
                    where: { id: member.id },
                    data: { tokens }
                });
                if (member.status === 'APPROVED') {
                    totalTokensSold += tokens;
                }
            }

            // Sync tokensSold
            await prisma.syndicate.update({
                where: { id: updatedSyndicate.id },
                data: { tokensSold: totalTokensSold }
            });
        }

        res.json(updatedSyndicate);
    } catch (error) {
        console.error('Error updating syndicate:', error);
        res.status(500).json({ error: 'Failed to update syndicate' });
    }
});

// Approve member (Lead investor only)
router.post('/:id/members/:memberId/approve', authorize('syndicate.manage'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const syndicate = await prisma.syndicate.findUnique({
            where: { id: req.params.id },
            include: { leadInvestor: true }
        });

        if (!syndicate) {
            res.status(404).json({ error: 'Syndicate not found' });
            return;
        }

        // Check if current user is lead investor or admin
        const investor = await prisma.investor.findFirst({
            where: { userId: req.user?.id }
        });

        const isLeadInvestor = investor && investor.id === syndicate.leadInvestorId;
        const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';

        if (!isLeadInvestor && !isAdmin) {
            res.status(403).json({ error: 'Only lead investor can approve members' });
            return;
        }

        const member = await prisma.syndicateMember.update({
            where: { id: req.params.memberId },
            data: { status: 'APPROVED' },
            include: {
                investor: {
                    select: { id: true, name: true }
                }
            }
        });

        // Update tokens sold if tokenized
        if (syndicate.isTokenized && member.tokens) {
            await prisma.syndicate.update({
                where: { id: syndicate.id },
                data: {
                    tokensSold: {
                        increment: member.tokens
                    }
                }
            });
        }

        // Check if syndicate is now fully funded
        // We calculate sum manually here using the primary connection to be safe against replication lag
        const result = await prisma.syndicateMember.aggregate({
            where: {
                syndicateId: req.params.id,
                status: 'APPROVED'
            },
            _sum: { amount: true }
        });
        const raisedAmount = result._sum.amount || 0;

        if (raisedAmount >= syndicate.targetAmount) {
            await prisma.syndicate.update({
                where: { id: req.params.id },
                data: { status: 'FUNDED' }
            });
        }

        res.json({ message: 'Member approved', member });
    } catch (error) {
        console.error('Error approving member:', error);
        res.status(500).json({ error: 'Failed to approve member' });
    }
});

// Get syndicate stats
router.get('/stats/overview', authorize('syndicate.list'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.json({
                totalSyndicates: 0,
                openSyndicates: 0,
                fundedSyndicates: 0,
                totalRaised: 0,
                totalMembers: 0
            });
            return;
        }

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            res.status(403).json({ error: 'Tenant context required' });
            return;
        }

        const [totalSyndicates, openSyndicates, formingSyndicates, fundedSyndicates, totalMembers] = await Promise.all([
            prismaReplica.syndicate.count({ where: { tenantId } }),
            prismaReplica.syndicate.count({ where: { tenantId, status: 'OPEN' } }),
            prismaReplica.syndicate.count({ where: { tenantId, status: 'FORMING' } }),
            prismaReplica.syndicate.count({ where: { tenantId, status: 'FUNDED' } }),
            prismaReplica.syndicateMember.count({ where: { status: 'APPROVED', syndicate: { tenantId } } })
        ]);

        const totalRaisedResult = await prismaReplica.syndicateMember.aggregate({
            where: { status: 'APPROVED', syndicate: { tenantId } },
            _sum: { amount: true }
        });

        const totalTargetResult = await prismaReplica.syndicate.aggregate({
            where: { tenantId },
            _sum: { targetAmount: true }
        });

        res.json({
            totalSyndicates,
            activeSyndicates: openSyndicates + formingSyndicates + fundedSyndicates,
            openSyndicates,
            formingSyndicates,
            fundedSyndicates,
            totalRaised: totalRaisedResult._sum.amount || 0,
            totalTarget: totalTargetResult._sum.targetAmount || 0,
            totalMembers
        });
    } catch (error) {
        console.error('Error fetching syndicate stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

export default router;
