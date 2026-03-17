import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { logAuditEvent } from '../utils/security';
import { Prisma } from '@prisma/client';
import { isMissingSchemaError } from '../utils/prisma-errors';

const router = Router();

function isCasesModuleUnavailableError(error: unknown): boolean {
  return (
    isMissingSchemaError(error) ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  );
}

const CASE_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REJECTED'] as const;
const CASE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const CASE_TYPES = ['KYC', 'DISPUTE', 'ONBOARDING', 'SUPPORT', 'COMPLIANCE', 'DEAL_OPS', 'OTHER'] as const;

type CaseStatus = typeof CASE_STATUSES[number];
type CasePriority = typeof CASE_PRIORITIES[number];
type CaseType = typeof CASE_TYPES[number];

function isCaseStatus(value: string): value is CaseStatus {
  return CASE_STATUSES.includes(value as CaseStatus);
}

function isCasePriority(value: string): value is CasePriority {
  return CASE_PRIORITIES.includes(value as CasePriority);
}

function isCaseType(value: string): value is CaseType {
  return CASE_TYPES.includes(value as CaseType);
}

async function appendCaseEvent(
  caseId: string,
  actorUserId: string | undefined,
  eventType: string,
  note?: string,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.adminCaseEvent.create({
    data: {
      caseId,
      actorUserId,
      eventType,
      note,
      metadata: metadata || {}
    }
  });
}

router.get('/stats', authorize('case.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const [open, inProgress, escalated, resolved] = await Promise.all([
      prisma.adminCase.count({ where: { tenantId, status: 'OPEN' } }),
      prisma.adminCase.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
      prisma.adminCase.count({ where: { tenantId, status: 'ESCALATED' } }),
      prisma.adminCase.count({ where: { tenantId, status: { in: ['RESOLVED', 'CLOSED'] } } })
    ]);

    return res.json({ stats: { open, inProgress, escalated, resolved } });
  } catch (error) {
    if (isCasesModuleUnavailableError(error)) {
      return res.json({
        stats: { open: 0, inProgress: 0, escalated: 0, resolved: 0 },
        unavailable: true,
        reason: 'Pending database migration for cases module'
      });
    }
    console.error('Case stats error:', error);
    return res.json({
      stats: { open: 0, inProgress: 0, escalated: 0, resolved: 0 },
      unavailable: true,
      reason: 'Cases service temporarily unavailable'
    });
  }
});

router.get('/', authorize('case.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const status = String(req.query.status || '').toUpperCase();
    const priority = String(req.query.priority || '').toUpperCase();
    const type = String(req.query.type || '').toUpperCase();
    const assigneeId = req.query.assigneeId as string | undefined;
    const search = String(req.query.search || '').trim();

    const where: any = { tenantId };
    if (status && isCaseStatus(status)) where.status = status;
    if (priority && isCasePriority(priority)) where.priority = priority;
    if (type && isCaseType(type)) where.type = type;
    if (assigneeId) where.assigneeId = assigneeId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } }
      ];
    }

    const cases = await prisma.adminCase.findMany({
      where,
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return res.json({ cases });
  } catch (error) {
    if (isCasesModuleUnavailableError(error)) {
      return res.json({
        cases: [],
        unavailable: true,
        reason: 'Pending database migration for cases module'
      });
    }
    console.error('List cases error:', error);
    return res.json({
      cases: [],
      unavailable: true,
      reason: 'Cases service temporarily unavailable'
    });
  }
});

router.post('/', authorize('case.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const userId = req.user?.id;
    const {
      type = 'OTHER',
      title,
      description,
      priority = 'MEDIUM',
      requesterUserId,
      assigneeId,
      sourceDisputeId,
      sourceTicketId,
      relatedEntityType,
      relatedEntityId,
      dueAt,
      metadata
    } = req.body || {};

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!title || !description) return res.status(400).json({ error: 'title and description are required' });
    if (!isCaseType(String(type).toUpperCase())) return res.status(400).json({ error: 'Invalid case type' });
    if (!isCasePriority(String(priority).toUpperCase())) return res.status(400).json({ error: 'Invalid case priority' });

    if (assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!assignee || assignee.tenantId !== tenantId) {
        return res.status(400).json({ error: 'Invalid assignee for tenant' });
      }
    }

    const created = await prisma.adminCase.create({
      data: {
        tenantId,
        type: String(type).toUpperCase() as CaseType,
        title: String(title).trim(),
        description: String(description).trim(),
        priority: String(priority).toUpperCase() as CasePriority,
        requesterUserId: requesterUserId || null,
        assigneeId: assigneeId || null,
        createdById: userId,
        sourceDisputeId: sourceDisputeId || null,
        sourceTicketId: sourceTicketId || null,
        relatedEntityType: relatedEntityType || null,
        relatedEntityId: relatedEntityId || null,
        dueAt: dueAt ? new Date(dueAt) : null,
        metadata: metadata || {}
      }
    });

    await appendCaseEvent(created.id, userId, 'CASE_CREATED', 'Case created', {
      type: created.type,
      priority: created.priority
    });

    await logAuditEvent({
      userId,
      action: 'CASE_CREATED',
      resource: 'admin_case',
      resourceId: created.id,
      details: { type: created.type, priority: created.priority },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    return res.status(201).json({ message: 'Case created', case: created });
  } catch (error) {
    if (isCasesModuleUnavailableError(error)) {
      return res.status(200).json({
        message: 'Case module unavailable; create deferred',
        unavailable: true,
        reason: 'Pending database migration for cases module'
      });
    }
    console.error('Create case error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authorize('case.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const { id } = req.params;

    const record = await prisma.adminCase.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        events: {
          include: {
            actor: { select: { id: true, firstName: true, lastName: true, email: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 100
        }
      }
    });

    if (!record || record.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Case not found' });
    }

    return res.json({ case: record });
  } catch (error) {
    if (isCasesModuleUnavailableError(error)) {
      return res.status(200).json({
        case: null,
        unavailable: true,
        reason: 'Pending database migration for cases module'
      });
    }
    console.error('Get case detail error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', authorize('case.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const actorId = req.user?.id;
    const { id } = req.params;
    const { title, description, status, priority, dueAt, note, metadata } = req.body || {};

    const existing = await prisma.adminCase.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const nextStatus: CaseStatus | undefined = status && isCaseStatus(String(status).toUpperCase())
      ? (String(status).toUpperCase() as CaseStatus)
      : undefined;
    const nextPriority: CasePriority | undefined = priority && isCasePriority(String(priority).toUpperCase())
      ? (String(priority).toUpperCase() as CasePriority)
      : undefined;
    if (status && !nextStatus) return res.status(400).json({ error: 'Invalid status' });
    if (priority && !nextPriority) return res.status(400).json({ error: 'Invalid priority' });

    const updated = await prisma.adminCase.update({
      where: { id },
      data: {
        ...(title ? { title: String(title).trim() } : {}),
        ...(description ? { description: String(description).trim() } : {}),
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(nextPriority ? { priority: nextPriority } : {}),
        ...(dueAt ? { dueAt: new Date(dueAt) } : {}),
        ...(nextStatus === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
        ...(nextStatus === 'CLOSED' ? { closedAt: new Date() } : {}),
        ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {})
      }
    });

    await appendCaseEvent(id, actorId, 'CASE_UPDATED', note || 'Case updated', {
      previousStatus: existing.status,
      status: updated.status,
      previousPriority: existing.priority,
      priority: updated.priority
    });

    return res.json({ message: 'Case updated', case: updated });
  } catch (error) {
    if (isCasesModuleUnavailableError(error)) {
      return res.status(200).json({
        message: 'Case module unavailable; update deferred',
        unavailable: true,
        reason: 'Pending database migration for cases module'
      });
    }
    console.error('Update case error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/assign', authorize('case.assign'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const actorId = req.user?.id;
    const { id } = req.params;
    const { assigneeId, note } = req.body || {};

    const existing = await prisma.adminCase.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!assignee || assignee.tenantId !== tenantId) {
        return res.status(400).json({ error: 'Invalid assignee for tenant' });
      }
    }

    const updated = await prisma.adminCase.update({
      where: { id },
      data: {
        assigneeId: assigneeId || null,
        ...(existing.status === 'OPEN' && assigneeId ? { status: 'IN_PROGRESS' } : {})
      }
    });

    await appendCaseEvent(id, actorId, 'CASE_ASSIGNED', note || 'Case assignment updated', {
      previousAssigneeId: existing.assigneeId,
      assigneeId: updated.assigneeId
    });

    return res.json({ message: 'Case assignment updated', case: updated });
  } catch (error) {
    if (isCasesModuleUnavailableError(error)) {
      return res.status(200).json({
        message: 'Case module unavailable; assignment deferred',
        unavailable: true,
        reason: 'Pending database migration for cases module'
      });
    }
    console.error('Assign case error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/escalate', authorize('case.escalate'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const actorId = req.user?.id;
    const { id } = req.params;
    const { note } = req.body || {};

    const existing = await prisma.adminCase.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Case not found' });
    }
    if (['RESOLVED', 'CLOSED', 'REJECTED'].includes(existing.status)) {
      return res.status(400).json({ error: `Cannot escalate case in ${existing.status} status` });
    }

    const updated = await prisma.adminCase.update({
      where: { id },
      data: {
        status: 'ESCALATED',
        priority: 'URGENT',
        escalatedAt: new Date()
      }
    });

    await appendCaseEvent(id, actorId, 'CASE_ESCALATED', note || 'Case escalated', {
      previousStatus: existing.status
    });

    return res.json({ message: 'Case escalated', case: updated });
  } catch (error) {
    if (isCasesModuleUnavailableError(error)) {
      return res.status(200).json({
        message: 'Case module unavailable; escalation deferred',
        unavailable: true,
        reason: 'Pending database migration for cases module'
      });
    }
    console.error('Escalate case error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
