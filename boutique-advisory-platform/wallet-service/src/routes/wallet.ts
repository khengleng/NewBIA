
import { Router, Response } from 'express';
import { prisma, prismaReplica } from '../database';
import { authorize, AuthenticatedRequest } from '../middleware/authorize';
import { WalletService } from '../services/wallet';
import { z } from 'zod';

const router = Router();

const walletAddressSchema = z.object({
    walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
});

// GET /api/wallet - Get current user wallet and recent transactions
router.get('/', authorize('wallet.read', { getOwnerId: (req: AuthenticatedRequest) => req.user?.id }), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId || 'default';

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const wallet = await WalletService.getOrCreateWallet(userId, tenantId);

        const transactions = await (prismaReplica as any).walletTransaction.findMany({
            where: { walletId: wallet.id },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return res.json({
            wallet,
            transactions
        });
    } catch (error) {
        console.error('Error fetching wallet:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/wallet/history - Paged transaction history
router.get('/history', authorize('wallet.read', { getOwnerId: (req: AuthenticatedRequest) => req.user?.id }), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { type, limit = 50, offset = 0 } = req.query;

        const wallet = await (prismaReplica as any).wallet.findUnique({
            where: { userId }
        });

        if (!wallet) return res.json({ transactions: [], total: 0 });

        const where: any = { walletId: wallet.id };
        if (type) where.type = type;

        const [transactions, total] = await Promise.all([
            (prismaReplica as any).walletTransaction.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: Number(limit),
                skip: Number(offset)
            }),
            (prismaReplica as any).walletTransaction.count({ where })
        ]);

        return res.json({ transactions, total });
    } catch (error) {
        console.error('Error fetching wallet history:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/wallet/address - Get on-chain wallet address
router.get('/address', authorize('wallet.read', { getOwnerId: (req: AuthenticatedRequest) => req.user?.id }), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const wallet = await (prismaReplica as any).wallet.findUnique({
            where: { userId }
        });

        if (!wallet) return res.json({ walletAddress: null });
        return res.json({ walletAddress: wallet.walletAddress || null });
    } catch (error) {
        console.error('Error fetching wallet address:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/wallet/address - Update on-chain wallet address
router.post('/address', authorize('wallet.update', { getOwnerId: (req: AuthenticatedRequest) => req.user?.id }), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId || 'default';
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const parsed = walletAddressSchema.safeParse(req.body || {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid wallet address', details: parsed.error.flatten() });
        }

        const wallet = await WalletService.getOrCreateWallet(userId, tenantId);
        const updated = await (prisma as any).wallet.update({
            where: { id: wallet.id },
            data: { walletAddress: parsed.data.walletAddress || null }
        });

        return res.json({ walletAddress: updated.walletAddress || null });
    } catch (error) {
        console.error('Error updating wallet address:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/wallet/deposit - Create a simulated deposit (Integrating with ABA)
router.post('/deposit', authorize('payment.create'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId || 'default';
        const { amount, simulate = false } = req.body;

        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid deposit amount' });
        }

        if (simulate) {
            // Demo mode deposit
            const wallet = await WalletService.updateBalance(
                userId,
                amount,
                'DEPOSIT',
                'Simulated Deposit (Demo Mode)',
                { tenantId, method: 'SIMULATED' }
            );
            return res.json({ success: true, wallet, message: 'Simulated deposit successful' });
        }

        // In a real app, this would return an ABA PayWay checkout payload
        // For now, we return a success for demo
        return res.json({
            success: true,
            message: 'Deposit request initiated. Complete payment in your banking app.'
        });
    } catch (error) {
        console.error('Error in deposit:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/wallet/withdraw - Create a simulated withdrawal
router.post('/withdraw', authorize('payment.create'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId || 'default';
        const { amount, simulate = true } = req.body;

        if (!userId || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid withdrawal amount' });
        }

        try {
            const wallet = await WalletService.updateBalance(
                userId,
                -amount,
                'WITHDRAWAL',
                'Withdrawal to Bank Account',
                { tenantId, method: 'SIMULATED' }
            );
            return res.json({ success: true, wallet, message: 'Withdrawal successful' });
        } catch (error: any) {
            if (error.message === 'Insufficient wallet balance') {
                return res.status(400).json({ error: 'Insufficient balance' });
            }
            throw error;
        }
    } catch (error) {
        console.error('Error in withdrawal:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/wallet/transfer - Peer to peer transfer between users
router.post('/transfer', authorize('payment.create'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId || 'default';
        const { recipient, amount, memo } = req.body;

        if (!userId || !recipient || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid transfer request' });
        }

        const normalizedRecipient = String(recipient).trim();
        if (!normalizedRecipient) {
            return res.status(400).json({ error: 'Recipient is required' });
        }

        const recipientUser = await (prisma as any).user.findFirst({
            where: {
                tenantId,
                OR: [
                    { id: normalizedRecipient },
                    { email: normalizedRecipient.toLowerCase() }
                ]
            }
        });

        if (!recipientUser) {
            return res.status(404).json({ error: 'Recipient not found' });
        }

        if (recipientUser.id === userId) {
            return res.status(400).json({ error: 'Recipient cannot be the same as sender' });
        }

        const transferId = `p2p_${Date.now()}`;

        const [senderWallet, recipientWallet] = await (prisma as any).$transaction(async (tx: any) => {
            const sender = await WalletService.updateBalance(
                userId,
                -Number(amount),
                'WITHDRAWAL',
                'P2P transfer',
                { tenantId, transferId, counterpartyId: recipientUser.id, memo, direction: 'OUT' },
                tx
            );

            const receiver = await WalletService.updateBalance(
                recipientUser.id,
                Number(amount),
                'DEPOSIT',
                'P2P transfer',
                { tenantId, transferId, counterpartyId: userId, memo, direction: 'IN' },
                tx
            );

            return [sender, receiver];
        });

        return res.json({
            success: true,
            transferId,
            senderWallet,
            recipientWallet
        });
    } catch (error: any) {
        console.error('Error in transfer:', error);
        if (error.message === 'Insufficient wallet balance') {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
