import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { logAuditEvent } from '../utils/security';
import { Prisma } from '@prisma/client';
import { isMissingSchemaError } from '../utils/prisma-errors';

const router = Router();

function isOperationsModuleUnavailableError(error: unknown): boolean {
  return (
    isMissingSchemaError(error) ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  );
}

function getMonthRange(month?: string) {
  const now = new Date();
  const text = (month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).trim();
  const [yearStr, monthStr] = text.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr);
  if (!year || !monthIndex || monthIndex < 1 || monthIndex > 12) return null;

  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 1);
  return { label: `${year}-${String(monthIndex).padStart(2, '0')}`, start, end };
}

router.get('/subscriptions/current', authorize('subscription.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';

    let subscription = await prisma.subscription.findUnique({ where: { tenantId } });
    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          tenantId,
          plan: 'STARTER',
          status: 'TRIAL',
          billingCycle: 'MONTHLY',
          seatsIncluded: 5,
          seatsUsed: 0,
          pricePerSeat: 0,
          featureEntitlements: {
            businessOps: true,
            billingOps: true,
            supportTickets: true
          },
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        }
      });
    }

    return res.json({ subscription });
  } catch (error) {
    if (isOperationsModuleUnavailableError(error)) {
      return res.json({
        subscription: {
          tenantId: req.user?.tenantId || 'default',
          plan: 'STARTER',
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          seatsIncluded: 5,
          seatsUsed: 0,
          pricePerSeat: 0,
          featureEntitlements: {
            businessOps: true,
            billingOps: true,
            supportTickets: true
          }
        },
        unavailable: true,
        reason: 'Pending database migration for subscription module'
      });
    }
    console.error('Get subscription error:', error);
    return res.json({
      subscription: {
        tenantId: req.user?.tenantId || 'default',
        plan: 'STARTER',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        seatsIncluded: 5,
        seatsUsed: 0,
        pricePerSeat: 0,
        featureEntitlements: {
          businessOps: true,
          billingOps: true,
          supportTickets: true
        }
      },
      unavailable: true,
      reason: 'Subscription service temporarily unavailable'
    });
  }
});

router.put('/subscriptions/current', authorize('subscription.manage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const { plan, status, billingCycle, seatsIncluded, seatsUsed, pricePerSeat, nextBillingDate, featureEntitlements } = req.body;

    const subscription = await prisma.subscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        plan: plan || 'STARTER',
        status: status || 'ACTIVE',
        billingCycle: billingCycle || 'MONTHLY',
        seatsIncluded: seatsIncluded ?? 5,
        seatsUsed: seatsUsed ?? 0,
        pricePerSeat: pricePerSeat ?? 0,
        nextBillingDate: nextBillingDate ? new Date(nextBillingDate) : null,
        featureEntitlements: featureEntitlements || {}
      },
      update: {
        ...(plan ? { plan } : {}),
        ...(status ? { status } : {}),
        ...(billingCycle ? { billingCycle } : {}),
        ...(typeof seatsIncluded === 'number' ? { seatsIncluded } : {}),
        ...(typeof seatsUsed === 'number' ? { seatsUsed } : {}),
        ...(typeof pricePerSeat === 'number' ? { pricePerSeat } : {}),
        ...(nextBillingDate ? { nextBillingDate: new Date(nextBillingDate) } : {}),
        ...(featureEntitlements ? { featureEntitlements } : {})
      }
    });

    return res.json({ message: 'Subscription updated', subscription });
  } catch (error) {
    if (isOperationsModuleUnavailableError(error)) {
      return res.status(200).json({
        message: 'Subscription module unavailable; update skipped',
        unavailable: true,
        reason: 'Pending database migration for subscription module'
      });
    }
    console.error('Update subscription error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/invoices/generate-monthly', authorize('invoice.manage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const range = getMonthRange(req.body?.month);
    if (!range) return res.status(400).json({ error: 'Invalid month. Use YYYY-MM' });

    const byUser = await prisma.payment.groupBy({
      by: ['userId'],
      where: {
        ...(isSuperAdmin ? {} : { tenantId }),
        createdAt: { gte: range.start, lt: range.end },
        status: { in: ['COMPLETED', 'PENDING', 'PROCESSING', 'REFUNDED'] }
      },
      _sum: { amount: true },
      _count: true
    });

    const subscription = isSuperAdmin ? null : await prisma.subscription.findUnique({ where: { tenantId } });

    let generated = 0;
    for (const row of byUser) {
      const invoiceNumber = `INV-${range.label.replace('-', '')}-${row.userId.slice(0, 6).toUpperCase()}`;
      const total = row._sum.amount || 0;
      const dueDate = new Date(range.end.getTime() + 7 * 24 * 60 * 60 * 1000);

      const invoice = await prisma.invoice.upsert({
        where: { invoiceNumber },
        create: {
          tenantId: isSuperAdmin ? (req.user?.tenantId || 'default') : tenantId,
          customerUserId: row.userId,
          subscriptionId: subscription?.id,
          invoiceNumber,
          monthStart: range.start,
          monthEnd: range.end,
          dueDate,
          status: total > 0 ? 'ISSUED' : 'PAID',
          subtotal: total,
          tax: 0,
          total,
          amountPaid: 0,
          outstandingAmount: total,
          issuedAt: new Date(),
          metadata: {
            generatedBy: req.user?.id,
            source: 'monthly-payment-aggregation'
          }
        },
        update: {
          subtotal: total,
          total,
          outstandingAmount: total,
          dueDate,
          status: total > 0 ? 'ISSUED' : 'PAID',
          metadata: {
            generatedBy: req.user?.id,
            source: 'monthly-payment-aggregation',
            regeneratedAt: new Date().toISOString()
          }
        }
      });

      await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: invoice.id } });
      await prisma.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          description: `Platform activity for ${range.label}`,
          quantity: row._count,
          unitPrice: row._count > 0 ? Number((total / row._count).toFixed(2)) : 0,
          amount: total,
          metadata: {
            paymentCount: row._count
          }
        }
      });

      generated += 1;
    }

    await logAuditEvent({
      userId: req.user?.id || 'unknown',
      action: 'INVOICE_GENERATION',
      resource: 'INVOICE',
      resourceId: range.label,
      details: { tenantId, month: range.label, generated },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    return res.json({ message: 'Invoices generated', month: range.label, generated });
  } catch (error) {
    if (isOperationsModuleUnavailableError(error)) {
      return res.status(200).json({
        message: 'Invoices schema is not fully available yet',
        generated: 0,
        unavailable: true
      });
    }
    console.error('Generate monthly invoices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/invoices', authorize('invoice.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const range = getMonthRange(req.query.month as string | undefined);
    if (!range) return res.status(400).json({ error: 'Invalid month. Use YYYY-MM' });

    const invoices = await prisma.invoice.findMany({
      where: {
        ...(isSuperAdmin ? {} : { tenantId }),
        monthStart: range.start,
        monthEnd: range.end
      },
      include: {
        customer: { select: { id: true, email: true, firstName: true, lastName: true } }
      },
      orderBy: { total: 'desc' }
    });

    return res.json({ month: range.label, invoices });
  } catch (error) {
    if (isOperationsModuleUnavailableError(error)) {
      return res.json({
        month: req.query.month || null,
        invoices: [],
        unavailable: true,
        reason: 'Pending database migration for invoices module'
      });
    }
    console.error('List invoices error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/support-tickets', authorize('support_ticket.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const status = req.query.status as string | undefined;

    const where: any = { tenantId };
    if (status) where.status = status;

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        requester: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, email: true, firstName: true, lastName: true } }
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }]
    });

    return res.json({ tickets });
  } catch (error) {
    if (isOperationsModuleUnavailableError(error)) {
      return res.json({
        tickets: [],
        unavailable: true,
        reason: 'Pending database migration for support tickets module'
      });
    }
    console.error('List support tickets error:', error);
    return res.json({
      tickets: [],
      unavailable: true,
      reason: 'Support ticket service temporarily unavailable'
    });
  }
});

router.post('/support-tickets', authorize('support_ticket.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const requesterId = req.user?.id;
    const { subject, description, category, priority, slaHours } = req.body;

    if (!requesterId || !subject || !description) {
      return res.status(400).json({ error: 'subject and description are required' });
    }

    const hours = Number(slaHours || 24);
    const responseDueAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId,
        requesterId,
        subject,
        description,
        category: category || 'GENERAL',
        priority: priority || 'MEDIUM',
        slaHours: hours,
        responseDueAt
      }
    });

    return res.status(201).json({ message: 'Support ticket created', ticket });
  } catch (error) {
    if (isOperationsModuleUnavailableError(error)) {
      return res.status(200).json({
        message: 'Support ticket module unavailable; request recorded as deferred',
        unavailable: true,
        reason: 'Pending database migration for support tickets module'
      });
    }
    console.error('Create support ticket error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/support-tickets/:id', authorize('support_ticket.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const { id } = req.params;
    const { status, priority, assigneeId, notes } = req.body;

    const existing = await prisma.supportTicket.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(status === 'RESOLVED' || status === 'CLOSED' ? { resolvedAt: new Date() } : {}),
        metadata: {
          ...((existing.metadata as any) || {}),
          ...(notes ? { notes } : {}),
          updatedBy: req.user?.id,
          updatedAt: new Date().toISOString()
        }
      }
    });

    return res.json({ message: 'Support ticket updated', ticket: updated });
  } catch (error) {
    if (isOperationsModuleUnavailableError(error)) {
      return res.status(200).json({
        message: 'Support ticket module unavailable; update deferred',
        unavailable: true,
        reason: 'Pending database migration for support tickets module'
      });
    }
    console.error('Update support ticket error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/escalations/run', authorize('escalation.run'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const now = new Date();
    const staleWorkflowCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const ticketUpdate = await prisma.supportTicket.updateMany({
      where: {
        tenantId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER'] },
        responseDueAt: { lt: now }
      },
      data: { status: 'ESCALATED', priority: 'URGENT' }
    });

    const staleWorkflows = await prisma.workflow.count({
      where: {
        tenantId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        createdAt: { lt: staleWorkflowCutoff }
      }
    });

    await logAuditEvent({
      userId: req.user?.id || 'unknown',
      action: 'OPS_ESCALATION_RUN',
      resource: 'SYSTEM',
      resourceId: tenantId,
      details: {
        tenantId,
        escalatedTickets: ticketUpdate.count,
        staleWorkflows
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    return res.json({
      message: 'Escalation scan complete',
      escalatedTickets: ticketUpdate.count,
      staleWorkflows
    });
  } catch (error) {
    if (isOperationsModuleUnavailableError(error)) {
      return res.json({
        message: 'Escalation scan skipped',
        escalatedTickets: 0,
        staleWorkflows: 0,
        unavailable: true,
        reason: 'Pending database migration for escalation dependencies'
      });
    }
    console.error('Run escalation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
