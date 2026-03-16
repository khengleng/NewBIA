import { Router } from 'express';
import { prisma } from '../database';
import { authenticateToken, authorizeRoles } from '../middleware/jwt-auth';


const router = Router();

// ==========================================
// PUBLIC/INVESTOR ROUTES
// ==========================================




// Get all launchpad offerings (with optional status filters)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { getTenantId } = await import('../utils/tenant-utils');
        const tenantId = getTenantId(req);

        if (!tenantId) {
            return res.status(400).json({ error: 'Tenant ID required' });
        }

        if (!prisma.launchpadOffering) {
            console.error('❌ Prisma model LaunchpadOffering is not initialized');
            return res.status(500).json({ error: 'Service configuration error: Launchpad is unavailable' });
        }

        const offerings = await prisma.launchpadOffering.findMany({
            where: { tenantId },
            include: {
                deal: {
                    include: { sme: true }
                }
            },
            orderBy: { startTime: 'desc' }
        });

        return res.json(offerings);
    } catch (error: any) {
        console.error('❌ Launchpad fetch error:', error);
        return res.status(500).json({ error: 'Failed to fetch offerings', details: error.message });
    }
});

// Get a single offering by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const offering = await prisma.launchpadOffering.findUnique({
            where: { id },
            include: {
                deal: {
                    include: { sme: true, documents: true }
                }
            }
        });

        if (!offering) {
            return res.status(404).json({ error: 'Offering not found' });
        }

        return res.json(offering);
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to fetch offering', details: error.message });
    }
});

// Get current investor's commitments
router.get('/my-commitments', authenticateToken, authorizeRoles('INVESTOR'), async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const tenantId = (req as any).user.tenantId;

        const investor = await prisma.investor.findUnique({ where: { userId } });
        if (!investor) {
            return res.status(404).json({ error: 'Investor profile not found' });
        }

        const commitments = await prisma.launchpadCommitment.findMany({
            where: { investorId: investor.id, tenantId },
            include: {
                offering: {
                    include: {
                        deal: { include: { sme: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.json(commitments);
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to fetch your commitments', details: error.message });
    }
});

// Get summary stats for a specific offering
router.get('/:id/stats', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = (req as any).user.tenantId;

        const commitments = await prisma.launchpadCommitment.findMany({
            where: { offeringId: id, tenantId }
        });

        const totalRaised = commitments.reduce((sum, c) => sum + c.committedAmount, 0);
        const investorCount = commitments.length;

        // Fetch offering to get hardCap
        const offering = await prisma.launchpadOffering.findUnique({
            where: { id },
            select: { hardCap: true }
        });

        if (!offering) {
            return res.status(404).json({ error: 'Offering not found' });
        }

        const completionPercentage = (totalRaised / offering.hardCap) * 100;

        return res.json({
            totalRaised,
            investorCount,
            hardCap: offering.hardCap,
            completionPercentage: Math.min(100, completionPercentage)
        });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to fetch offering stats', details: error.message });
    }
});

// Submit a commitment (Investor)
router.post('/:id/commit', authenticateToken, authorizeRoles('INVESTOR'), async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;
        const userId = (req as any).user.id;
        const tenantId = (req as any).user.tenantId;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid commitment amount' });
        }

        // 1. Fetch Offering & Validations
        const offering = await prisma.launchpadOffering.findUnique({ where: { id } });
        if (!offering) {
            return res.status(404).json({ error: 'Offering not found' });
        }

        if (amount < offering.minCommitment || amount > offering.maxCommitment) {
            return res.status(400).json({ error: `Amount must be between ${offering.minCommitment} and ${offering.maxCommitment}` });
        }

        const now = new Date();
        if (now < offering.startTime || now > offering.endTime) {
            return res.status(400).json({ error: 'Offering is not currently active' });
        }

        // 2. Fetch Investor Profile
        const investor = await prisma.investor.findUnique({ where: { userId } });
        if (!investor) {
            return res.status(404).json({ error: 'Investor profile not found' });
        }

        if (investor.kycStatus !== 'VERIFIED') {
            return res.status(403).json({
                error: 'Account verification required',
                code: 'KYC_REQUIRED',
                message: 'You must complete your identity verification (KYC) before participating in Launchpad offerings.'
            });
        }

        // 3. Process Transaction in a Serializable Transaction
        const result = await prisma.$transaction(async (tx) => {
            // Find wallet
            const wallet = await tx.wallet.findUnique({
                where: { userId }
            });

            if (!wallet) throw new Error('Wallet not found');
            if (wallet.balance < amount) throw new Error('Insufficient wallet balance');

            // Deduct from wallet balance and move to frozen balance (locked)
            await tx.wallet.update({
                where: { id: wallet.id },
                data: {
                    balance: { decrement: amount },
                    frozenBalance: { increment: amount }
                }
            });

            // Record transaction
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    tenantId: tenantId,
                    type: 'LAUNCHPAD_LOCK',
                    amount: -amount,
                    status: 'SUCCESS',
                    description: `Locked commitment for offering ${id}`
                }
            });

            // Create Commitment Record
            const commitment = await tx.launchpadCommitment.create({
                data: {
                    offeringId: id,
                    investorId: investor.id,
                    tenantId: tenantId,
                    committedAmount: amount,
                    status: 'PENDING'
                }
            });

            return commitment;
        });

        return res.json({ message: 'Commitment successful', commitment: result });

    } catch (error: any) {
        if (error.message.includes('Insufficient wallet balance')) {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Failed to process commitment', details: error.message });
    }
});

// ==========================================
// ADMIN / OPERATOR / ADVISOR ROUTES
// ==========================================

// Get Deals that are ready to be listed on the Launchpad
router.get('/eligible-deals', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'PLATFORM_OPERATOR'), async (req, res) => {
    try {
        const { getTenantId } = await import('../utils/tenant-utils');
        const tenantId = getTenantId(req);

        // Security check for Prisma models
        if (!prisma.deal || !prisma.launchpadOffering) {
            console.error('❌ Prisma models not initialized for eligible-deals');
            return res.status(500).json({ error: 'Service configuration error' });
        }

        const deals = await prisma.deal.findMany({
            where: {
                tenantId,
                status: {
                    in: ['LAUNCHPAD_PREP', 'APPROVED_FOR_LISTING']
                }
            },
            include: {
                sme: true,
                launchpadOffering: true
            }
        });

        // Manual filter to avoid potential issues with complex Prisma query in some environments
        const eligibleDeals = deals.filter(d => !d.launchpadOffering);

        return res.json(eligibleDeals);
    } catch (error: any) {
        console.error('❌ [Launchpad Error] Failed to fetch eligible deals:', error);
        return res.status(500).json({ error: 'Failed to fetch eligible deals', details: error.message });
    }
});

// Create a new offering (Triggered from cambobia.com origination normally)
router.post('/', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PLATFORM_OPERATOR', 'ADVISOR'), async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;
        const { dealId, hardCap, unitPrice, minCommitment, maxCommitment, startTime, endTime } = req.body;

        // Verify deal exists
        const deal = await prisma.deal.findUnique({ where: { id: dealId, tenantId } });
        if (!deal) {
            return res.status(404).json({ error: 'Deal not found' });
        }

        // Update Deal Status to Prep
        await prisma.deal.update({
            where: { id: dealId },
            data: { status: 'LAUNCHPAD_PREP' }
        });

        // Create Offering
        const offering = await prisma.launchpadOffering.create({
            data: {
                dealId,
                tenantId,
                hardCap,
                unitPrice,
                minCommitment,
                maxCommitment,
                startTime: new Date(startTime),
                endTime: new Date(endTime)
            }
        });

        return res.status(201).json({ message: 'Launchpad offering created', offering });
    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to create offering', details: error.message });
    }
});

// Close and Finalize Offering (Admin/Operator)
router.post('/:id/close', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PLATFORM_OPERATOR'), async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = (req as any).user.tenantId;

        const offering = await prisma.launchpadOffering.findUnique({
            where: { id },
            include: { commitments: true }
        });

        if (!offering) {
            return res.status(404).json({ error: 'Offering not found' });
        }

        // 1. Move deal status to COMPLETED
        await prisma.deal.update({
            where: { id: offering.dealId },
            data: { status: 'CLOSED' }
        });

        // 2. Finalize each commitment (Convert frozenBalance to actual cost)
        // In a real system, this would trigger token issuance.
        // For our MVP, we'll mark commitments as ALLOCATED.
        const results = await prisma.$transaction(
            offering.commitments.map(c =>
                prisma.launchpadCommitment.update({
                    where: { id: c.id },
                    data: { status: 'ALLOCATED' }
                })
            )
        );

        return res.json({ message: 'Offering closed and finalized successfully', results });

    } catch (error: any) {
        return res.status(500).json({ error: 'Failed to close offering', details: error.message });
    }
});

export default router;
