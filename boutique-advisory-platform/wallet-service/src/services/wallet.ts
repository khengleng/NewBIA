
import { Prisma } from '@prisma/client';
import { prisma } from '../database';

type TxClient = Prisma.TransactionClient;

/**
 * Wallet Service - Implementation of "Binance-standard" financial operations
 * Handles atomic balance updates, freezes and audit trails for the Boutique Advisory Platform.
 */
export const WalletService = {
    /**
     * Get or create a wallet for a user
     */
    async getOrCreateWallet(userId: string, tenantId: string, tx?: TxClient) {
        const client = tx || prisma;

        let wallet = await (client as any).wallet.findUnique({
            where: { userId }
        });

        if (!wallet) {
            wallet = await (client as any).wallet.create({
                data: {
                    userId,
                    tenantId,
                    balance: 0,
                    frozenBalance: 0,
                    currency: 'USD',
                    status: 'ACTIVE'
                }
            });
        }

        return wallet;
    },

    /**
     * Atomically update a user's balance with an audit trail
     */
    async updateBalance(
        userId: string,
        amount: number,
        type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE_BUY' | 'TRADE_SELL' | 'FEE' | 'REFUND',
        description: string,
        metadata: any = {},
        tx?: TxClient
    ) {
        const execute = async (currentTx: TxClient) => {
            const wallet = await this.getOrCreateWallet(userId, metadata.tenantId || 'default', currentTx);

            if (amount < 0 && (wallet.balance + amount) < 0) {
                throw new Error('Insufficient wallet balance');
            }

            const updatedWallet = await (currentTx as any).wallet.update({
                where: { id: wallet.id },
                data: {
                    balance: { increment: amount }
                }
            });

            await (currentTx as any).walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    tenantId: updatedWallet.tenantId,
                    amount,
                    type,
                    status: 'SUCCESS',
                    description,
                    metadata: {
                        ...metadata,
                        prevBalance: wallet.balance,
                        nextBalance: updatedWallet.balance
                    }
                }
            });

            return updatedWallet;
        };

        if (tx) {
            return await execute(tx);
        } else {
            return await (prisma as any).$transaction(async (newTx: TxClient) => {
                return await execute(newTx);
            });
        }
    },

    /**
     * Freeze funds for an open order
     */
    async freezeFunds(userId: string, amount: number, referenceType: string, referenceId: string, tx?: TxClient) {
        const client = tx || prisma;
        const wallet = await (client as any).wallet.findUnique({ where: { userId } });

        if (!wallet || wallet.balance < amount) {
            throw new Error('Insufficient balance to lock funds');
        }

        return await (client as any).wallet.update({
            where: { id: wallet.id },
            data: {
                balance: { decrement: amount },
                frozenBalance: { increment: amount }
            }
        });
    },

    /**
     * Release frozen funds (unfreeze)
     */
    async releaseFunds(userId: string, amount: number, tx?: TxClient) {
        const client = tx || prisma;
        const wallet = await (client as any).wallet.findUnique({ where: { userId } });

        if (!wallet || wallet.frozenBalance < amount) {
            throw new Error('Insufficient frozen balance to release');
        }

        return await (client as any).wallet.update({
            where: { id: wallet.id },
            data: {
                balance: { increment: amount },
                frozenBalance: { decrement: amount }
            }
        });
    },

    /**
     * Settle a trade between buyer and seller using wallet balances
     */
    async settleTrade(
        buyerUserId: string,
        sellerUserId: string,
        totalAmount: number,
        fee: number,
        tradeId: string,
        tenantId: string,
        tx: TxClient
    ) {
        // 1. Debit Buyer (already frozen usually, but for simple flow we debit now or from frozen)
        // For current "Instant Buy" from listing, we check balance and debit immediately.

        // 2. Debit Buyer
        await this.updateBalance(
            buyerUserId,
            -(totalAmount + fee),
            'TRADE_BUY',
            `Purchase of shares - Trade ${tradeId}`,
            { tradeId, tenantId },
            tx
        );

        // 3. Credit Seller
        await this.updateBalance(
            sellerUserId,
            totalAmount,
            'TRADE_SELL',
            `Sale of shares - Trade ${tradeId}`,
            { tradeId, tenantId },
            tx
        );

        // Fees are implicitly collected by the decrement in buyer and increment in seller (delta goes to operator)
        // In a real binance-standard app, we might also credit an operator wallet.
    }
};
