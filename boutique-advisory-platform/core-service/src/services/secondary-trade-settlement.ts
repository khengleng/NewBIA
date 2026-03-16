import { Prisma } from '@prisma/client';
import { WalletService } from './wallet';

type TxClient = Prisma.TransactionClient;

export async function settleSecondaryTrade(tx: TxClient, tradeId: string, tenantId: string) {
  const trade = await tx.secondaryTrade.findUnique({
    where: { id: tradeId },
    include: {
      listing: {
        include: {
          seller: { select: { userId: true } }
        }
      },
      buyer: { select: { userId: true } }
    }
  });

  if (!trade || trade.listing.tenantId !== tenantId) {
    throw new Error('Trade not found');
  }

  if (trade.status === 'COMPLETED') {
    return trade;
  }

  if (!['PENDING', 'PROCESSING'].includes(trade.status)) {
    throw new Error(`Trade cannot be settled from ${trade.status} status`);
  }

  const sellerInvestment = await tx.dealInvestor.findUnique({
    where: { id: trade.listing.dealInvestorId }
  });

  if (!sellerInvestment || sellerInvestment.amount < trade.shares) {
    throw new Error('Seller has insufficient investment amount to transfer');
  }

  await tx.dealInvestor.update({
    where: { id: trade.listing.dealInvestorId },
    data: { amount: { decrement: trade.shares } }
  });

  const buyerInvestment = await tx.dealInvestor.findUnique({
    where: {
      dealId_investorId: {
        dealId: sellerInvestment.dealId,
        investorId: trade.buyerId
      }
    }
  });

  if (buyerInvestment) {
    await tx.dealInvestor.update({
      where: { id: buyerInvestment.id },
      data: {
        amount: { increment: trade.shares },
        status: 'APPROVED'
      }
    });
  } else {
    await tx.dealInvestor.create({
      data: {
        dealId: sellerInvestment.dealId,
        investorId: trade.buyerId,
        amount: trade.shares,
        status: 'APPROVED'
      }
    });
  }

  // 5. Update Wallets (Binance Standard)
  // This ensures the financial move is recorded in the platform's ledger
  await WalletService.settleTrade(
    trade.buyer.userId,
    trade.listing.seller.userId,
    trade.totalAmount,
    trade.fee,
    trade.id,
    tenantId,
    tx
  );

  return tx.secondaryTrade.update({
    where: { id: trade.id },
    data: {
      status: 'COMPLETED',
      executedAt: new Date()
    }
  });
}
