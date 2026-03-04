import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { PaymentStatus } from '@prisma/client';

const router = Router();

type DealContext = {
  id: string;
  tenantId: string;
  status: string;
  sme: {
    id: string;
    userId: string;
    name: string;
  };
};

function requirePositiveAmount(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(parsed.toFixed(2));
}

async function getDealContext(req: AuthenticatedRequest, dealId: string): Promise<DealContext | null> {
  const tenantId = req.user?.tenantId || 'default';
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId },
    include: {
      sme: {
        select: { id: true, userId: true, name: true }
      }
    }
  });
  if (!deal) return null;
  return {
    id: deal.id,
    tenantId: deal.tenantId,
    status: deal.status,
    sme: deal.sme
  };
}

function isAdminRole(role: string | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

function ensureDealIsFinanciallyActive(dealStatus: string): boolean {
  return dealStatus === 'FUNDED' || dealStatus === 'CLOSED';
}

async function getDealInvestorIds(dealId: string): Promise<string[]> {
  const rows = await prisma.dealInvestor.findMany({
    where: { dealId },
    select: { id: true }
  });
  return rows.map((row) => row.id);
}

async function aggregateAmount(where: Parameters<typeof prisma.payment.aggregate>[0]['where']): Promise<number> {
  const result = await prisma.payment.aggregate({
    where,
    _sum: { amount: true }
  });
  return Number((result._sum.amount || 0).toFixed(2));
}

async function buildCashflowSummary(deal: DealContext) {
  const dealInvestorIds = await getDealInvestorIds(deal.id);

  const [
    investorPaidCompleted,
    disbursedCompleted,
    disbursedCommitted,
    dividendFundedCompleted,
    dividendPayoutCompleted,
    dividendPayoutCommitted
  ] = await Promise.all([
    dealInvestorIds.length === 0
      ? Promise.resolve(0)
      : aggregateAmount({
          tenantId: deal.tenantId,
          dealInvestorId: { in: dealInvestorIds },
          status: 'COMPLETED'
        }),
    aggregateAmount({
      tenantId: deal.tenantId,
      status: 'COMPLETED',
      metadata: {
        path: ['category'],
        equals: 'PRIMARY_FUND_DISBURSEMENT'
      }
    }).then(async (total) => {
      const rows = await prisma.payment.findMany({
        where: {
          tenantId: deal.tenantId,
          status: 'COMPLETED',
          metadata: {
            path: ['category'],
            equals: 'PRIMARY_FUND_DISBURSEMENT'
          }
        },
        select: { amount: true, metadata: true }
      });
      const scoped = rows.filter((row) => {
        const metadata = (row.metadata as Record<string, unknown>) || {};
        return metadata.dealId === deal.id;
      });
      return Number(scoped.reduce((sum, row) => sum + row.amount, 0).toFixed(2));
    }),
    prisma.payment.findMany({
      where: {
        tenantId: deal.tenantId,
        status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
        metadata: {
          path: ['category'],
          equals: 'PRIMARY_FUND_DISBURSEMENT'
        }
      },
      select: { amount: true, metadata: true }
    }).then((rows) =>
      Number(
        rows
          .filter((row) => {
            const metadata = (row.metadata as Record<string, unknown>) || {};
            return metadata.dealId === deal.id;
          })
          .reduce((sum, row) => sum + row.amount, 0)
          .toFixed(2)
      )
    ),
    prisma.payment.findMany({
      where: {
        tenantId: deal.tenantId,
        status: 'COMPLETED',
        metadata: { path: ['category'], equals: 'DIVIDEND_FUNDING' }
      },
      select: { amount: true, metadata: true }
    }).then((rows) =>
      Number(
        rows
          .filter((row) => {
            const metadata = (row.metadata as Record<string, unknown>) || {};
            return metadata.dealId === deal.id;
          })
          .reduce((sum, row) => sum + row.amount, 0)
          .toFixed(2)
      )
    ),
    prisma.payment.findMany({
      where: {
        tenantId: deal.tenantId,
        status: 'COMPLETED',
        metadata: { path: ['category'], equals: 'DIVIDEND_PAYOUT' }
      },
      select: { amount: true, metadata: true }
    }).then((rows) =>
      Number(
        rows
          .filter((row) => {
            const metadata = (row.metadata as Record<string, unknown>) || {};
            return metadata.dealId === deal.id;
          })
          .reduce((sum, row) => sum + row.amount, 0)
          .toFixed(2)
      )
    ),
    prisma.payment.findMany({
      where: {
        tenantId: deal.tenantId,
        status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
        metadata: { path: ['category'], equals: 'DIVIDEND_PAYOUT' }
      },
      select: { amount: true, metadata: true }
    }).then((rows) =>
      Number(
        rows
          .filter((row) => {
            const metadata = (row.metadata as Record<string, unknown>) || {};
            return metadata.dealId === deal.id;
          })
          .reduce((sum, row) => sum + row.amount, 0)
          .toFixed(2)
      )
    )
  ]);

  const availableForSmeDisbursement = Number((investorPaidCompleted - disbursedCommitted).toFixed(2));
  const availableDividendPool = Number((dividendFundedCompleted - dividendPayoutCommitted).toFixed(2));

  return {
    investorPaidCompleted,
    disbursedCompleted,
    disbursedCommitted,
    availableForSmeDisbursement,
    dividendFundedCompleted,
    dividendPayoutCompleted,
    dividendPayoutCommitted,
    availableDividendPool
  };
}

async function buildLifecycleReadiness(deal: DealContext) {
  const summary = await buildCashflowSummary(deal);

  const [dealInvestors, openDisputes, openCases] = await Promise.all([
    prisma.dealInvestor.findMany({
      where: { dealId: deal.id },
      include: {
        investor: {
          select: {
            id: true,
            kycStatus: true,
            status: true
          }
        }
      }
    }),
    prisma.dispute.count({
      where: {
        tenantId: deal.tenantId,
        dealId: deal.id,
        status: { in: ['OPEN', 'IN_PROGRESS'] }
      }
    }),
    prisma.adminCase.count({
      where: {
        tenantId: deal.tenantId,
        relatedEntityId: deal.id,
        status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] }
      }
    })
  ]);

  const totalCommitments = Number(dealInvestors.reduce((sum, investor) => sum + investor.amount, 0).toFixed(2));
  const activeInvestors = dealInvestors.filter((investor) => ['APPROVED', 'COMPLETED'].includes(investor.status));
  const kycReady = activeInvestors.every((investor) => investor.investor.kycStatus === 'VERIFIED');
  const investorReady = activeInvestors.length > 0 && kycReady;

  const checks = {
    smeOnboarded: true,
    dealFinanciallyActive: ensureDealIsFinanciallyActive(deal.status),
    investorOnboardingReady: investorReady,
    investorFundsReceived: summary.investorPaidCompleted >= totalCommitments && totalCommitments > 0,
    primaryDisbursementCompleted: summary.disbursedCompleted > 0,
    noCriticalOpenItems: openDisputes === 0 && openCases === 0
  };

  const readyForClose = Object.values(checks).every(Boolean);

  return {
    checks,
    readyForClose,
    totals: {
      totalCommitments,
      ...summary
    },
    blockingItems: {
      openDisputes,
      openCases
    }
  };
}

router.get('/deals/:dealId/summary', authorize('deal.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deal = await getDealContext(req, req.params.dealId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const summary = await buildCashflowSummary(deal);

    const recentPayments = await prisma.payment.findMany({
      where: {
        tenantId: deal.tenantId,
        metadata: {
          path: ['dealId'],
          equals: deal.id
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return res.json({
      dealId: deal.id,
      dealStatus: deal.status,
      summary,
      recentPayments
    });
  } catch (error) {
    console.error('Cashflow summary error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/deals/:dealId/disbursements/request', authorize('deal.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deal = await getDealContext(req, req.params.dealId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    if (!ensureDealIsFinanciallyActive(deal.status)) {
      return res.status(409).json({ error: `Deal must be FUNDED or CLOSED for disbursement. Current status: ${deal.status}` });
    }

    const role = req.user?.role;
    const isAdmin = isAdminRole(role);
    const isSmeOwner = req.user?.id === deal.sme.userId;
    if (!isAdmin && !isSmeOwner && role !== 'ADVISOR') {
      return res.status(403).json({ error: 'Only SME owner, advisor, or admin can request disbursement' });
    }

    const amount = requirePositiveAmount(req.body?.amount);
    if (!amount) return res.status(400).json({ error: 'Valid amount is required' });

    const summary = await buildCashflowSummary(deal);
    if (amount > summary.availableForSmeDisbursement) {
      return res.status(400).json({
        error: 'Requested amount exceeds available investor-funded pool',
        availableForSmeDisbursement: summary.availableForSmeDisbursement
      });
    }

    const autoApprove = Boolean(req.body?.autoApprove) && isAdmin;
    const payment = await prisma.payment.create({
      data: {
        tenantId: deal.tenantId,
        userId: deal.sme.userId,
        amount,
        currency: 'USD',
        method: 'BANK_TRANSFER',
        provider: 'INTERNAL_LEDGER',
        status: autoApprove ? 'COMPLETED' : 'PENDING',
        description: `Primary fund disbursement to SME (${deal.sme.name})`,
        metadata: {
          category: 'PRIMARY_FUND_DISBURSEMENT',
          dealId: deal.id,
          direction: 'OUTFLOW',
          sourceAccount: 'INVESTOR_FUND_POOL',
          destinationUserId: deal.sme.userId,
          requestedBy: req.user?.id,
          requestedAt: new Date().toISOString(),
          approvalStatus: autoApprove ? 'APPROVED' : 'PENDING'
        }
      }
    });

    return res.status(201).json({
      message: autoApprove ? 'Disbursement approved and recorded' : 'Disbursement request created and awaiting approval',
      payment
    });
  } catch (error) {
    console.error('Request disbursement error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/disbursements/:paymentId/approve', authorize('billing.manage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.paymentId, tenantId }
    });

    if (!payment) return res.status(404).json({ error: 'Disbursement request not found' });
    const metadata = (payment.metadata as Record<string, unknown>) || {};
    if (metadata.category !== 'PRIMARY_FUND_DISBURSEMENT') {
      return res.status(400).json({ error: 'Payment is not a disbursement request' });
    }
    if (payment.status !== 'PENDING' && payment.status !== 'PROCESSING') {
      return res.status(400).json({ error: `Disbursement cannot be approved from ${payment.status} status` });
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        metadata: {
          ...metadata,
          approvalStatus: 'APPROVED',
          approvedAt: new Date().toISOString(),
          approvedBy: req.user?.id
        } as any
      }
    });

    return res.json({ message: 'Disbursement approved', payment: updated });
  } catch (error) {
    console.error('Approve disbursement error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/disbursements/:paymentId/reject', authorize('billing.manage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const reason = String(req.body?.reason || 'Rejected by finance operations').trim();

    const payment = await prisma.payment.findFirst({
      where: { id: req.params.paymentId, tenantId }
    });
    if (!payment) return res.status(404).json({ error: 'Disbursement request not found' });
    const metadata = (payment.metadata as Record<string, unknown>) || {};
    if (metadata.category !== 'PRIMARY_FUND_DISBURSEMENT') {
      return res.status(400).json({ error: 'Payment is not a disbursement request' });
    }
    if (payment.status === 'COMPLETED' || payment.status === 'REFUNDED') {
      return res.status(400).json({ error: 'Completed disbursements cannot be rejected' });
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CANCELLED',
        metadata: {
          ...metadata,
          approvalStatus: 'REJECTED',
          rejectedAt: new Date().toISOString(),
          rejectedBy: req.user?.id,
          rejectReason: reason
        } as any
      }
    });

    return res.json({ message: 'Disbursement rejected', payment: updated });
  } catch (error) {
    console.error('Reject disbursement error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/deals/:dealId/dividends/fund', authorize('payment.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deal = await getDealContext(req, req.params.dealId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    if (!ensureDealIsFinanciallyActive(deal.status)) {
      return res.status(409).json({ error: `Deal must be FUNDED or CLOSED for dividends. Current status: ${deal.status}` });
    }

    const role = req.user?.role;
    const isAdmin = isAdminRole(role);
    const isSmeOwner = req.user?.id === deal.sme.userId;
    if (!isAdmin && !isSmeOwner) {
      return res.status(403).json({ error: 'Only SME owner or admin can fund dividends' });
    }

    const amount = requirePositiveAmount(req.body?.amount);
    if (!amount) return res.status(400).json({ error: 'Valid amount is required' });

    const autoConfirm = req.body?.autoConfirm !== false;
    const payment = await prisma.payment.create({
      data: {
        tenantId: deal.tenantId,
        userId: req.user!.id,
        amount,
        currency: 'USD',
        method: 'BANK_TRANSFER',
        provider: 'INTERNAL_LEDGER',
        status: autoConfirm ? 'COMPLETED' : 'PENDING',
        description: `Dividend funding for deal ${deal.id}`,
        metadata: {
          category: 'DIVIDEND_FUNDING',
          dealId: deal.id,
          direction: 'INFLOW',
          sourceUserId: req.user?.id,
          sourceRole: req.user?.role,
          fundedAt: new Date().toISOString()
        }
      }
    });

    return res.status(201).json({
      message: autoConfirm ? 'Dividend funding recorded' : 'Dividend funding request created',
      payment
    });
  } catch (error) {
    console.error('Dividend funding error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/deals/:dealId/dividends/distribute', authorize('billing.manage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deal = await getDealContext(req, req.params.dealId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    if (!ensureDealIsFinanciallyActive(deal.status)) {
      return res.status(409).json({ error: `Deal must be FUNDED or CLOSED for dividend distribution. Current status: ${deal.status}` });
    }

    const summary = await buildCashflowSummary(deal);
    if (summary.availableDividendPool <= 0) {
      return res.status(400).json({ error: 'No available dividend pool for distribution' });
    }

    const requestedAmount = req.body?.amount !== undefined ? requirePositiveAmount(req.body.amount) : summary.availableDividendPool;
    if (!requestedAmount) return res.status(400).json({ error: 'Valid amount is required' });
    if (requestedAmount > summary.availableDividendPool) {
      return res.status(400).json({
        error: 'Requested amount exceeds available dividend pool',
        availableDividendPool: summary.availableDividendPool
      });
    }

    const investors = await prisma.dealInvestor.findMany({
      where: {
        dealId: deal.id,
        status: { in: ['APPROVED', 'COMPLETED'] },
        amount: { gt: 0 }
      },
      include: {
        investor: {
          select: { id: true, userId: true, name: true }
        }
      }
    });

    if (investors.length === 0) {
      return res.status(400).json({ error: 'No eligible investors for dividend distribution' });
    }

    const totalHolding = investors.reduce((sum, investor) => sum + investor.amount, 0);
    if (totalHolding <= 0) {
      return res.status(400).json({ error: 'Invalid investor holdings for distribution' });
    }

    const runId = `divrun_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const allocations = investors.map((investor) => ({
      investorUserId: investor.investor.userId,
      investorId: investor.investorId,
      dealInvestorId: investor.id,
      investorName: investor.investor.name,
      holdingAmount: investor.amount,
      ratio: investor.amount / totalHolding,
      payoutAmount: 0
    }));

    let distributed = 0;
    for (let index = 0; index < allocations.length; index += 1) {
      if (index === allocations.length - 1) {
        allocations[index].payoutAmount = Number((requestedAmount - distributed).toFixed(2));
      } else {
        const amount = Number((requestedAmount * allocations[index].ratio).toFixed(2));
        allocations[index].payoutAmount = amount;
        distributed = Number((distributed + amount).toFixed(2));
      }
    }

    if (req.body?.dryRun === true) {
      return res.json({
        runId,
        dryRun: true,
        requestedAmount,
        allocations
      });
    }

    const payoutStatus: PaymentStatus = req.body?.markAsProcessing ? 'PROCESSING' : 'COMPLETED';

    const created = await prisma.$transaction(async (tx) => {
      const payments = [];
      for (const allocation of allocations) {
        if (allocation.payoutAmount <= 0) continue;
        const payment = await tx.payment.create({
          data: {
            tenantId: deal.tenantId,
            userId: allocation.investorUserId,
            amount: allocation.payoutAmount,
            currency: 'USD',
            method: 'BANK_TRANSFER',
            provider: 'INTERNAL_LEDGER',
            status: payoutStatus,
            dealInvestorId: allocation.dealInvestorId,
            description: `Dividend payout for deal ${deal.id}`,
            metadata: {
              category: 'DIVIDEND_PAYOUT',
              dealId: deal.id,
              runId,
              direction: 'OUTFLOW',
              sourceAccount: 'DIVIDEND_POOL',
              distributedBy: req.user?.id,
              ratio: allocation.ratio,
              investorId: allocation.investorId
            }
          }
        });
        payments.push(payment);
      }
      return payments;
    });

    return res.status(201).json({
      message: payoutStatus === 'COMPLETED' ? 'Dividend distribution completed' : 'Dividend payout run created in processing state',
      runId,
      requestedAmount,
      payoutStatus,
      paymentsCreated: created.length,
      allocations
    });
  } catch (error) {
    console.error('Dividend distribute error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/deals/:dealId/dividends/history', authorize('deal.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deal = await getDealContext(req, req.params.dealId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const [fundingPayments, payoutPayments] = await Promise.all([
      prisma.payment.findMany({
        where: {
          tenantId: deal.tenantId,
          metadata: { path: ['category'], equals: 'DIVIDEND_FUNDING' }
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      }),
      prisma.payment.findMany({
        where: {
          tenantId: deal.tenantId,
          metadata: { path: ['category'], equals: 'DIVIDEND_PAYOUT' }
        },
        orderBy: { createdAt: 'desc' },
        take: 1000
      })
    ]);

    const scopedFunding = fundingPayments.filter((payment) => {
      const metadata = (payment.metadata as Record<string, unknown>) || {};
      return metadata.dealId === deal.id;
    });
    const scopedPayouts = payoutPayments.filter((payment) => {
      const metadata = (payment.metadata as Record<string, unknown>) || {};
      return metadata.dealId === deal.id;
    });

    return res.json({
      dealId: deal.id,
      funding: scopedFunding,
      payouts: scopedPayouts
    });
  } catch (error) {
    console.error('Dividend history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/deals/:dealId/lifecycle-readiness', authorize('deal.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deal = await getDealContext(req, req.params.dealId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const readiness = await buildLifecycleReadiness(deal);
    return res.json({
      dealId: deal.id,
      dealStatus: deal.status,
      readiness
    });
  } catch (error) {
    console.error('Lifecycle readiness error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/deals/:dealId/close-operations', authorize('deal.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deal = await getDealContext(req, req.params.dealId);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const role = req.user?.role;
    const isSmeOwner = req.user?.id === deal.sme.userId;
    if (!isAdminRole(role) && role !== 'ADVISOR' && !isSmeOwner) {
      return res.status(403).json({ error: 'Only admin, advisor, or SME owner can run closing operations' });
    }

    const readiness = await buildLifecycleReadiness(deal);
    const force = Boolean(req.body?.force);
    if (!readiness.readyForClose && !force) {
      return res.status(409).json({
        error: 'Deal is not ready for operations close',
        readiness
      });
    }

    const updatedDeal = await prisma.deal.update({
      where: { id: deal.id },
      data: { status: 'CLOSED' }
    });

    const workflow = await prisma.workflow.create({
      data: {
        tenantId: deal.tenantId,
        type: 'DEAL_APPROVAL',
        status: 'COMPLETED',
        dealId: deal.id,
        data: {
          operationClose: true,
          force,
          closedBy: req.user?.id,
          closedAt: new Date().toISOString(),
          readiness
        }
      }
    });

    return res.json({
      message: force ? 'Deal force-closed by operations' : 'Deal closed with readiness checks passed',
      deal: updatedDeal,
      workflow
    });
  } catch (error) {
    console.error('Close operations error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
