
import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';

const router = Router();

// Zod schemas for validation
const createTransactionSchema = z.object({
    amount: z.number().positive(),
    currency: z.string().default('USD'),
    type: z.enum(['DEPOSIT', 'RELEASE', 'REFUND']),
    description: z.string().optional()
});

const approveReleaseSchema = z.object({
    password: z.string().min(1) // Re-enter password for sensitive action
});

// GET /api/escrow/:dealId - Get escrow details for a deal
router.get('/:dealId', authorize('deal.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dealId } = req.params;
        const tenantId = req.user?.tenantId || 'default';

        let escrow = await (prisma as any).escrowAccount.findUnique({
            where: { dealId }
        });

        // Auto-create escrow if it doesn't exist for the deal
        if (!escrow) {
            // Verify deal exists first
            const deal = await prisma.deal.findUnique({ where: { id: dealId } });
            if (!deal) return res.status(404).json({ error: 'Deal not found' });

            escrow = await (prisma as any).escrowAccount.create({
                data: {
                    dealId,
                    tenantId,
                    status: 'OPEN',
                    balance: 0
                }
            });
        }

        // Fetch recent transactions
        const transactions = await (prisma as any).escrowTransaction.findMany({
            where: { escrowAccountId: escrow.id },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        return res.json({ escrow, transactions });
    } catch (error) {
        console.error('Error fetching escrow:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/escrow/:dealId/deposit - Simulate a deposit (Integrate with Payment Gateway in real scenario)
router.post('/:dealId/deposit', authorize('payment.create'), validateBody(createTransactionSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dealId } = req.params;
        const { amount, currency, description } = req.body;
        const tenantId = req.user?.tenantId || 'default';
        const userId = req.user?.id;

        const escrow = await (prisma as any).escrowAccount.findUnique({ where: { dealId } });
        if (!escrow) return res.status(404).json({ error: 'Escrow account not found' });

        // Only INVESTOR role can deposit funds
        if (req.user?.role !== 'INVESTOR') {
            return res.status(403).json({ error: 'Only investors can deposit funds' });
        }

        // In a real app, verify payment success here (e.g. Stripe PaymentIntent)

        // Create transaction record
        const transaction = await (prisma as any).escrowTransaction.create({
            data: {
                escrowAccountId: escrow.id,
                tenantId,
                amount,
                currency,
                type: 'DEPOSIT',
                status: 'COMPLETED', // Use PENDING if waiting for callback
                description: description || 'Deposit funds',
                requestedBy: userId
            }
        });

        // Update Escrow Balance
        const updatedEscrow = await (prisma as any).escrowAccount.update({
            where: { id: escrow.id },
            data: {
                balance: { increment: amount }
            }
        });

        return res.json({ success: true, transaction, newBalance: updatedEscrow.balance });
    } catch (error) {
        console.error('Error depositing funds:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/escrow/:dealId/release - Request funds release (Requires Approval)
router.post('/:dealId/release', authorize('deal.update'), validateBody(createTransactionSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dealId } = req.params;
        const { amount, description } = req.body;
        const tenantId = req.user?.tenantId || 'default';
        const userId = req.user?.id;

        const escrow = await (prisma as any).escrowAccount.findUnique({ where: { dealId } });
        if (!escrow) return res.status(404).json({ error: 'Escrow account not found' });

        if (escrow.balance < amount) {
            return res.status(400).json({ error: 'Insufficient escrow balance' });
        }

        // Create PENDING release transaction
        const transaction = await (prisma as any).escrowTransaction.create({
            data: {
                escrowAccountId: escrow.id,
                tenantId,
                amount,
                type: 'RELEASE',
                status: 'PENDING', // Waiting for multi-sig/admin approval
                description: description || 'Release funds to SME',
                requestedBy: userId
            }
        });

        return res.json({ success: true, transaction, message: 'Release request created. Waiting for approval.' });
    } catch (error) {
        console.error('Error requesting release:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/escrow/approve/:transactionId - Approve release (Admin/Advisor only)
router.post('/approve/:transactionId', authorize('deal.approve'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { transactionId } = req.params;
        const userId = req.user?.id;

        const transaction = await (prisma as any).escrowTransaction.findUnique({ where: { id: transactionId } });

        if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
        if (transaction.status !== 'PENDING') return res.status(400).json({ error: 'Transaction is not pending' });
        if (transaction.type !== 'RELEASE' && transaction.type !== 'REFUND') return res.status(400).json({ error: 'Invalid transaction type for approval' });

        // Execute logic: Update status and decrement balance
        await prisma.$transaction([
            (prisma as any).escrowTransaction.update({
                where: { id: transactionId },
                data: {
                    status: 'COMPLETED',
                    approvedBy: userId,
                    approvedAt: new Date()
                }
            }),
            (prisma as any).escrowAccount.update({
                where: { id: transaction.escrowAccountId },
                data: {
                    balance: { decrement: transaction.amount }
                }
            })
        ]);

        return res.json({ success: true, message: 'Funds released successfully' });
    } catch (error) {
        console.error('Error approving transaction:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
