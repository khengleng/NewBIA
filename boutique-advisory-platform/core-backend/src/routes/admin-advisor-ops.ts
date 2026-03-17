import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { isMissingSchemaError } from '../utils/prisma-errors';
import { logAuditEvent } from '../utils/security';

const router = Router();
function isAdvisorOpsUnavailableError(error: unknown): boolean {
  return (
    isMissingSchemaError(error) ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  );
}
const assignmentTransitions: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'COMPLETED', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

function canTransitionAssignmentStatus(current: string, next: string): boolean {
  return (assignmentTransitions[current] || []).includes(next);
}

function tenantScope(req: AuthenticatedRequest) {
  const tenantId = req.user?.tenantId || 'default';
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  return { tenantId, isSuperAdmin };
}

async function recomputeCapacity(tenantId: string, advisorId: string) {
  const [capacity, activeCount] = await Promise.all([
    prisma.advisorCapacity.findUnique({
      where: { tenantId_advisorId: { tenantId, advisorId } }
    }),
    prisma.advisorAssignment.count({
      where: {
        tenantId,
        advisorId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] }
      }
    })
  ]);

  const weekly = capacity?.weeklyCapacityHours || 40;
  const utilization = Math.min(100, Number(((activeCount / Math.max(1, weekly / 8)) * 100).toFixed(1)));

  await prisma.advisorCapacity.upsert({
    where: { tenantId_advisorId: { tenantId, advisorId } },
    create: {
      tenantId,
      advisorId,
      weeklyCapacityHours: weekly,
      activeAssignments: activeCount,
      utilizationPct: utilization
    },
    update: {
      activeAssignments: activeCount,
      utilizationPct: utilization
    }
  });
}

router.get('/overview', authorize('advisor_ops.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const scope = isSuperAdmin ? {} : { tenantId };
    const now = new Date();

    const [advisorCount, openAssignments, overdueAssignments, pendingConflicts, avgUtilizationAgg] = await Promise.all([
      prisma.advisor.count({ where: scope }),
      prisma.advisorAssignment.count({
        where: {
          ...scope,
          status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] }
        }
      }),
      prisma.advisorAssignment.count({
        where: {
          ...scope,
          status: { in: ['OPEN', 'IN_PROGRESS', 'BLOCKED'] },
          dueAt: { lt: now }
        }
      }),
      prisma.advisorConflictDeclaration.count({
        where: {
          ...scope,
          status: 'PENDING'
        }
      }),
      prisma.advisorCapacity.aggregate({
        where: scope,
        _avg: { utilizationPct: true }
      })
    ]);

    return res.json({
      overview: {
        advisors: advisorCount,
        openAssignments,
        overdueAssignments,
        pendingConflicts,
        avgUtilizationPct: Number((avgUtilizationAgg._avg.utilizationPct || 0).toFixed(1))
      }
    });
  } catch (error) {
    if (isAdvisorOpsUnavailableError(error)) {
      return res.json({
        overview: {
          advisors: 0,
          openAssignments: 0,
          overdueAssignments: 0,
          pendingConflicts: 0,
          avgUtilizationPct: 0
        },
        unavailable: true,
        reason: 'Pending database migration for advisor operations'
      });
    }
    console.error('Advisor ops overview error:', error);
    return res.json({
      overview: {
        advisors: 0,
        openAssignments: 0,
        overdueAssignments: 0,
        pendingConflicts: 0,
        avgUtilizationPct: 0
      },
      unavailable: true,
      reason: 'Advisor operations service temporarily unavailable'
    });
  }
});

router.get('/advisors', authorize('advisor_capacity.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const advisors = await prisma.advisor.findMany({
      where: isSuperAdmin ? {} : { tenantId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
        capacities: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      advisors: advisors.map((advisor) => ({
        id: advisor.id,
        name: advisor.name,
        status: advisor.status,
        specialization: advisor.specialization,
        user: advisor.user,
        capacity: advisor.capacities[0] || null
      }))
    });
  } catch (error) {
    if (isAdvisorOpsUnavailableError(error)) {
      return res.json({
        advisors: [],
        unavailable: true,
        reason: 'Advisor operations service temporarily unavailable'
      });
    }
    console.error('List advisors for ops error:', error);
    return res.json({ advisors: [], unavailable: true, reason: 'Advisor operations service temporarily unavailable' });
  }
});

router.put('/capacity/:advisorId', authorize('advisor_capacity.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const { advisorId } = req.params;
    const weeklyCapacityHours = Number(req.body?.weeklyCapacityHours || 0);
    const notes = req.body?.notes ? String(req.body.notes) : null;

    if (!weeklyCapacityHours || weeklyCapacityHours < 1 || weeklyCapacityHours > 168) {
      return res.status(400).json({ error: 'weeklyCapacityHours must be between 1 and 168' });
    }

    const advisor = await prisma.advisor.findUnique({ where: { id: advisorId } });
    if (!advisor || (!isSuperAdmin && advisor.tenantId !== tenantId)) {
      return res.status(404).json({ error: 'Advisor not found' });
    }

    await prisma.advisorCapacity.upsert({
      where: { tenantId_advisorId: { tenantId: advisor.tenantId, advisorId } },
      create: {
        tenantId: advisor.tenantId,
        advisorId,
        weeklyCapacityHours,
        notes
      },
      update: {
        weeklyCapacityHours,
        notes
      }
    });

    await recomputeCapacity(advisor.tenantId, advisorId);
    const updated = await prisma.advisorCapacity.findUnique({
      where: { tenantId_advisorId: { tenantId: advisor.tenantId, advisorId } }
    });
    await logAuditEvent({
      userId: req.user?.id || 'unknown',
      tenantId: advisor.tenantId,
      action: 'ADVISOR_CAPACITY_UPDATED',
      resource: 'advisor_capacity',
      resourceId: advisorId,
      details: {
        weeklyCapacityHours,
        notes: notes || undefined
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      success: true
    });

    return res.json({ message: 'Capacity updated', capacity: updated });
  } catch (error) {
    console.error('Update advisor capacity error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/assignments', authorize('advisor_assignment.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const status = String(req.query.status || '').toUpperCase();
    const where: any = isSuperAdmin ? {} : { tenantId };
    if (['OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'].includes(status)) where.status = status;

    const assignments = await prisma.advisorAssignment.findMany({
      where,
      include: {
        advisor: {
          include: { user: { select: { firstName: true, lastName: true, email: true } } }
        },
        createdBy: { select: { firstName: true, lastName: true, email: true } }
      },
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }]
    });

    return res.json({ assignments });
  } catch (error) {
    if (isAdvisorOpsUnavailableError(error)) {
      return res.json({
        assignments: [],
        unavailable: true,
        reason: 'Advisor assignments service temporarily unavailable'
      });
    }
    console.error('List advisor assignments error:', error);
    return res.json({ assignments: [], unavailable: true, reason: 'Advisor assignments service temporarily unavailable' });
  }
});

router.post('/assignments', authorize('advisor_assignment.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = tenantScope(req);
    const createdById = req.user?.id;
    const { advisorId, title, description, sourceType, sourceId, priority = 'MEDIUM', dueAt } = req.body || {};

    if (!createdById) return res.status(401).json({ error: 'Unauthorized' });
    if (!advisorId || !title) return res.status(400).json({ error: 'advisorId and title are required' });

    const advisor = await prisma.advisor.findFirst({ where: { id: advisorId, tenantId } });
    if (!advisor) return res.status(404).json({ error: 'Advisor not found' });

    const assignment = await prisma.advisorAssignment.create({
      data: {
        tenantId,
        advisorId,
        createdById,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        sourceType: sourceType ? String(sourceType) : null,
        sourceId: sourceId ? String(sourceId) : null,
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(priority).toUpperCase()) ? String(priority).toUpperCase() as any : 'MEDIUM',
        dueAt: dueAt ? new Date(dueAt) : null
      }
    });

    await recomputeCapacity(tenantId, advisorId);
    await logAuditEvent({
      userId: createdById,
      tenantId,
      action: 'ADVISOR_ASSIGNMENT_CREATED',
      resource: 'advisor_assignment',
      resourceId: assignment.id,
      details: {
        advisorId,
        priority: assignment.priority,
        status: assignment.status
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      success: true
    });
    return res.status(201).json({ message: 'Assignment created', assignment });
  } catch (error) {
    console.error('Create advisor assignment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/assignments/:id', authorize('advisor_assignment.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = tenantScope(req);
    const { id } = req.params;
    const { status, priority, dueAt, description } = req.body || {};

    const existing = await prisma.advisorAssignment.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Assignment not found' });

    const normalizedStatus = status ? String(status).toUpperCase() : undefined;
    const normalizedPriority = priority ? String(priority).toUpperCase() : undefined;
    if (normalizedStatus && !['OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid assignment status' });
    }
    if (normalizedStatus && normalizedStatus !== existing.status && !canTransitionAssignmentStatus(existing.status, normalizedStatus)) {
      return res.status(409).json({
        error: `Invalid assignment status transition: ${existing.status} -> ${normalizedStatus}`
      });
    }

    const updated = await prisma.advisorAssignment.update({
      where: { id },
      data: {
        ...(normalizedStatus && ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'].includes(normalizedStatus) ? { status: normalizedStatus as any } : {}),
        ...(normalizedPriority && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(normalizedPriority) ? { priority: normalizedPriority as any } : {}),
        ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
        ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
        ...(normalizedStatus === 'IN_PROGRESS' && !existing.startedAt ? { startedAt: new Date() } : {}),
        ...(normalizedStatus === 'COMPLETED' ? { completedAt: new Date() } : {})
      }
    });

    await recomputeCapacity(tenantId, existing.advisorId);
    if (normalizedStatus && normalizedStatus !== existing.status) {
      await logAuditEvent({
        userId: req.user?.id || 'unknown',
        tenantId,
        action: 'ADVISOR_ASSIGNMENT_STATUS_TRANSITION',
        resource: 'advisor_assignment',
        resourceId: id,
        details: {
          fromStatus: existing.status,
          toStatus: normalizedStatus
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        success: true
      });
    }
    return res.json({ message: 'Assignment updated', assignment: updated });
  } catch (error) {
    console.error('Update advisor assignment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/conflicts', authorize('advisor_conflict.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const status = String(req.query.status || '').toUpperCase();
    const where: any = isSuperAdmin ? {} : { tenantId };
    if (['PENDING', 'APPROVED', 'REJECTED'].includes(status)) where.status = status;

    const conflicts = await prisma.advisorConflictDeclaration.findMany({
      where,
      include: {
        advisor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        deal: { select: { id: true, title: true } },
        reviewedBy: { select: { firstName: true, lastName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ conflicts });
  } catch (error) {
    if (isAdvisorOpsUnavailableError(error)) {
      return res.json({
        conflicts: [],
        unavailable: true,
        reason: 'Advisor conflicts service temporarily unavailable'
      });
    }
    console.error('List advisor conflicts error:', error);
    return res.json({ conflicts: [], unavailable: true, reason: 'Advisor conflicts service temporarily unavailable' });
  }
});

router.post('/conflicts/:id/review', authorize('advisor_conflict.review'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = tenantScope(req);
    const reviewerId = req.user?.id;
    const { id } = req.params;
    const status = String(req.body?.status || '').toUpperCase();
    const reviewNote = String(req.body?.reviewNote || '').trim();

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'status must be APPROVED or REJECTED' });
    }

    const existing = await prisma.advisorConflictDeclaration.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Conflict declaration not found' });
    if (existing.status !== 'PENDING') return res.status(400).json({ error: 'Only pending declarations can be reviewed' });

    const updated = await prisma.advisorConflictDeclaration.update({
      where: { id },
      data: {
        status: status as any,
        reviewedById: reviewerId || null,
        reviewNote: reviewNote || null,
        reviewedAt: new Date()
      }
    });
    await logAuditEvent({
      userId: reviewerId || 'unknown',
      tenantId,
      action: 'ADVISOR_CONFLICT_REVIEWED',
      resource: 'advisor_conflict_declaration',
      resourceId: id,
      details: {
        fromStatus: existing.status,
        toStatus: status
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      success: true
    });

    return res.json({ message: 'Conflict declaration reviewed', declaration: updated });
  } catch (error) {
    console.error('Review advisor conflict error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
