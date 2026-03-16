import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { isMissingSchemaError } from '../utils/prisma-errors';

const router = Router();

function tenantScope(req: AuthenticatedRequest) {
  const tenantId = req.user?.tenantId || 'default';
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  return { tenantId, isSuperAdmin };
}

router.get('/overview', authorize('reconciliation.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const scope = isSuperAdmin ? {} : { tenantId };

    const [lastRun, exceptionCounts, openCritical] = await Promise.all([
      prisma.reconciliationRun.findFirst({
        where: scope,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.reconciliationException.groupBy({
        by: ['status'],
        where: scope,
        _count: { id: true }
      }),
      prisma.reconciliationException.count({
        where: {
          ...scope,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          severity: 'CRITICAL'
        }
      })
    ]);

    return res.json({
      overview: {
        lastRun,
        openExceptions: exceptionCounts.filter((row) => row.status === 'OPEN' || row.status === 'IN_PROGRESS').reduce((sum, row) => sum + row._count.id, 0),
        resolvedExceptions: exceptionCounts.find((row) => row.status === 'RESOLVED')?._count.id || 0,
        criticalOpenExceptions: openCritical
      }
    });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.json({
        overview: {
          lastRun: null,
          openExceptions: 0,
          resolvedExceptions: 0,
          criticalOpenExceptions: 0
        },
        unavailable: true,
        reason: 'Pending database migration for reconciliation'
      });
    }
    console.error('Reconciliation overview error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/runs', authorize('reconciliation.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const runs = await prisma.reconciliationRun.findMany({
      where: isSuperAdmin ? {} : { tenantId },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true, email: true }
        },
        exceptions: {
          select: { id: true, status: true, severity: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return res.json({ runs });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.json({
        runs: [],
        unavailable: true,
        reason: 'Pending database migration for reconciliation'
      });
    }
    console.error('List reconciliation runs error:', error);
    return res.json({ runs: [], unavailable: true, reason: 'Reconciliation service temporarily unavailable' });
  }
});

router.post('/runs', authorize('reconciliation.run'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = tenantScope(req);
    const createdById = req.user?.id;
    if (!createdById) return res.status(401).json({ error: 'Unauthorized' });

    const periodStart = req.body?.periodStart ? new Date(req.body.periodStart) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const periodEnd = req.body?.periodEnd ? new Date(req.body.periodEnd) : new Date();

    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart >= periodEnd) {
      return res.status(400).json({ error: 'Invalid period range' });
    }

    const [paymentAgg, invoiceAgg, paidInvoices, completedPayments] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          tenantId,
          status: 'COMPLETED',
          createdAt: { gte: periodStart, lte: periodEnd }
        },
        _sum: { amount: true }
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId,
          status: { in: ['PAID', 'PARTIALLY_PAID'] },
          createdAt: { gte: periodStart, lte: periodEnd }
        },
        _sum: { total: true, amountPaid: true }
      }),
      prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: ['PAID', 'PARTIALLY_PAID'] },
          createdAt: { gte: periodStart, lte: periodEnd }
        },
        select: { id: true, total: true, amountPaid: true }
      }),
      prisma.payment.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          createdAt: { gte: periodStart, lte: periodEnd }
        },
        select: { id: true, amount: true, providerTxId: true }
      })
    ]);

    const expectedPayout = Number((paymentAgg._sum.amount || 0).toFixed(2));
    const actualPayout = Number((invoiceAgg._sum.amountPaid || 0).toFixed(2));
    const invoicesTotal = Number((invoiceAgg._sum.total || 0).toFixed(2));
    const discrepancyAmount = Number((expectedPayout - actualPayout).toFixed(2));

    const run = await prisma.reconciliationRun.create({
      data: {
        tenantId,
        periodStart,
        periodEnd,
        status: 'COMPLETED',
        paymentsTotal: expectedPayout,
        invoicesTotal,
        expectedPayout,
        actualPayout,
        discrepancyAmount,
        createdById,
        completedAt: new Date()
      }
    });

    const exceptionCreates: Array<Promise<unknown>> = [];

    if (discrepancyAmount !== 0) {
      exceptionCreates.push(
        prisma.reconciliationException.create({
          data: {
            tenantId,
            runId: run.id,
            type: 'PAYMENT_MISMATCH',
            severity: Math.abs(discrepancyAmount) > 1000 ? 'HIGH' : 'MEDIUM',
            status: 'OPEN',
            expectedAmount: expectedPayout,
            actualAmount: actualPayout,
            delta: discrepancyAmount,
            reason: 'Aggregate payment total does not match aggregate paid invoice amount.'
          }
        })
      );
    }

    for (const invoice of paidInvoices) {
      if (Number(invoice.amountPaid.toFixed(2)) === Number(invoice.total.toFixed(2))) continue;
      const delta = Number((invoice.total - invoice.amountPaid).toFixed(2));
      exceptionCreates.push(
        prisma.reconciliationException.create({
          data: {
            tenantId,
            runId: run.id,
            type: 'INVOICE_MISMATCH',
            severity: Math.abs(delta) > 500 ? 'HIGH' : 'MEDIUM',
            status: 'OPEN',
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            expectedAmount: invoice.total,
            actualAmount: invoice.amountPaid,
            delta,
            reason: 'Invoice marked paid/partially paid with unmatched amount.'
          }
        })
      );
    }

    for (const payment of completedPayments) {
      if (payment.providerTxId) continue;
      exceptionCreates.push(
        prisma.reconciliationException.create({
          data: {
            tenantId,
            runId: run.id,
            type: 'ORPHAN_TRANSACTION',
            severity: 'LOW',
            status: 'OPEN',
            referenceType: 'PAYMENT',
            referenceId: payment.id,
            expectedAmount: payment.amount,
            actualAmount: null,
            delta: payment.amount,
            reason: 'Completed payment is missing provider transaction reference.'
          }
        })
      );
    }

    await Promise.all(exceptionCreates);

    const exceptionCount = await prisma.reconciliationException.count({ where: { runId: run.id } });

    return res.status(201).json({
      message: 'Reconciliation run completed',
      runId: run.id,
      exceptionsCreated: exceptionCount
    });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.status(200).json({
        message: 'Reconciliation module unavailable; run not executed',
        unavailable: true,
        reason: 'Pending database migration for reconciliation'
      });
    }
    console.error('Create reconciliation run error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/exceptions', authorize('reconciliation.exception.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const status = String(req.query.status || '').toUpperCase();

    const where: any = isSuperAdmin ? {} : { tenantId };
    if (['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'].includes(status)) where.status = status;

    const exceptions = await prisma.reconciliationException.findMany({
      where,
      include: {
        assignedTo: { select: { firstName: true, lastName: true, email: true } },
        run: { select: { id: true, periodStart: true, periodEnd: true, createdAt: true } }
      },
      orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
      take: 300
    });

    return res.json({ exceptions });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.json({
        exceptions: [],
        unavailable: true,
        reason: 'Pending database migration for reconciliation'
      });
    }
    console.error('List reconciliation exceptions error:', error);
    return res.json({ exceptions: [], unavailable: true, reason: 'Reconciliation service temporarily unavailable' });
  }
});

router.patch('/exceptions/:id', authorize('reconciliation.exception.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const { id } = req.params;
    const status = req.body?.status ? String(req.body.status).toUpperCase() : undefined;
    const assignedToId = req.body?.assignedToId !== undefined ? String(req.body.assignedToId || '') : undefined;

    const exception = await prisma.reconciliationException.findUnique({ where: { id } });
    if (!exception || (!isSuperAdmin && exception.tenantId !== tenantId)) {
      return res.status(404).json({ error: 'Reconciliation exception not found' });
    }

    if (status && !['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid exception status' });
    }

    const updated = await prisma.reconciliationException.update({
      where: { id },
      data: {
        ...(status ? { status: status as any } : {}),
        ...(assignedToId !== undefined ? { assignedToId: assignedToId || null } : {}),
        ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {})
      }
    });

    return res.json({ message: 'Reconciliation exception updated', exception: updated });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.status(200).json({
        message: 'Reconciliation module unavailable; update deferred',
        unavailable: true,
        reason: 'Pending database migration for reconciliation'
      });
    }
    console.error('Update reconciliation exception error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
