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
        const tenantId = (req as any).user?.tenantId || req.headers['x-tenant-id'];
        if (!tenantId) {
            res.status(400).json({ error: 'Tenant ID required' });
            return;
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

        res.json(offerings);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch offerings', details: error.message });
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
            res.status(404).json({ error: 'Offering not found' });
            return;
        }

        res.json(offering);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch offering', details: error.message });
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
            res.status(400).json({ error: 'Invalid commitment amount' });
            return;
        }

        // 1. Fetch Offering & Validations
        const offering = await prisma.launchpadOffering.findUnique({ where: { id } });
        if (!offering) {
            res.status(404).json({ error: 'Offering not found' });
            return;
        }

        if (amount < offering.minCommitment || amount > offering.maxCommitment) {
            res.status(400).json({ error: `Amount must be between ${offering.minCommitment} and ${offering.maxCommitment}` });
            return;
        }

        const now = new Date();
        if (now < offering.startTime || now > offering.endTime) {
            res.status(400).json({ error: 'Offering is not currently active' });
            return;
        }

        // 2. Fetch Investor Profile
        const investor = await prisma.investor.findUnique({ where: { userId } });
        if (!investor) {
            res.status(404).json({ error: 'Investor profile not found' });
            return;
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

        res.json({ message: 'Commitment successful', commitment: result });

    } catch (error: any) {
        if (error.message.includes('Insufficient wallet balance')) {
            res.status(400).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to process commitment', details: error.message });
    }
});

// ==========================================
// ADMIN / OPERATOR / ADVISOR ROUTES
// ==========================================

// Get Deals that are ready to be listed on the Launchpad
router.get('/eligible-deals', authenticateToken, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'PLATFORM_OPERATOR'), async (req, res) => {
    try {
        const tenantId = (req as any).user.tenantId;

        const deals = await prisma.deal.findMany({
            where: {
                tenantId,
                status: {
                    in: ['LAUNCHPAD_PREP', 'APPROVED_FOR_LISTING']
                },
                launchpadOffering: null // Not already an offering
            },
            include: { sme: true }
        });

        res.json(deals);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch eligible deals', details: error.message });
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
            res.status(404).json({ error: 'Deal not found' });
            return;
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

        res.status(201).json({ message: 'Launchpad offering created', offering });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to create offering', details: error.message });
    }
});

export default router;
