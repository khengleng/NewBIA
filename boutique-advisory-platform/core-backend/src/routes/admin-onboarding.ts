import { Router, Response } from 'express';
import { Prisma, UserRole, OnboardingTaskStatus } from '@prisma/client';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { sendNotification } from '../services/notification.service';
import { isMissingSchemaError } from '../utils/prisma-errors';

const router = Router();

function isOnboardingModuleUnavailableError(error: unknown): boolean {
  return (
    isMissingSchemaError(error) ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  );
}

interface TemplateStep {
  title: string;
  description?: string;
  required?: boolean;
  dueDays?: number;
}

function parseSteps(input: unknown): TemplateStep[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const steps: TemplateStep[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    const title = String(item.title || '').trim();
    if (!title) return null;
    const step: TemplateStep = {
      title,
      description: item.description ? String(item.description).trim() : undefined,
      required: item.required === undefined ? true : Boolean(item.required),
      dueDays: item.dueDays === undefined ? undefined : Number(item.dueDays)
    };
    steps.push(step);
  }
  return steps;
}

function isOnboardingRole(value: string): value is UserRole {
  return ['SME', 'INVESTOR', 'ADVISOR'].includes(value);
}

function isTaskStatus(value: string): value is OnboardingTaskStatus {
  return ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAIVED'].includes(value);
}

router.get('/templates', authorize('onboarding_template.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const role = String(req.query.role || '').toUpperCase();

    const where: Prisma.OnboardingTemplateWhereInput = { tenantId };
    if (role && isOnboardingRole(role)) where.role = role;

    const templates = await prisma.onboardingTemplate.findMany({
      where,
      include: { createdBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { version: 'desc' }]
    });

    return res.json({ templates });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.json({
        templates: [],
        unavailable: true,
        reason: 'Pending database migration for onboarding templates'
      });
    }
    console.error('List onboarding templates error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/templates', authorize('onboarding_template.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const createdById = req.user?.id;
    const { role, name, description, steps, isActive = true } = req.body || {};

    const normalizedRole = String(role || '').toUpperCase();
    if (!createdById) return res.status(401).json({ error: 'Unauthorized' });
    if (!isOnboardingRole(normalizedRole)) return res.status(400).json({ error: 'Role must be SME, INVESTOR, or ADVISOR' });
    if (!name || String(name).trim().length < 3) return res.status(400).json({ error: 'Template name is required' });

    const parsedSteps = parseSteps(steps);
    if (!parsedSteps) {
      return res.status(400).json({ error: 'Steps must be a non-empty array with valid step titles' });
    }

    const latest = await prisma.onboardingTemplate.findFirst({
      where: { tenantId, role: normalizedRole },
      orderBy: { version: 'desc' }
    });

    const template = await prisma.onboardingTemplate.create({
      data: {
        tenantId,
        role: normalizedRole,
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        steps: parsedSteps as unknown as Prisma.InputJsonValue,
        isActive: Boolean(isActive),
        version: (latest?.version || 0) + 1,
        createdById
      }
    });

    return res.status(201).json({ message: 'Template created', template });
  } catch (error) {
    console.error('Create onboarding template error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/templates/:id', authorize('onboarding_template.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const { id } = req.params;
    const { name, description, steps, isActive } = req.body || {};

    const existing = await prisma.onboardingTemplate.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) return res.status(404).json({ error: 'Template not found' });

    const data: Prisma.OnboardingTemplateUpdateInput = {};
    if (name) data.name = String(name).trim();
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (steps !== undefined) {
      const parsedSteps = parseSteps(steps);
      if (!parsedSteps) return res.status(400).json({ error: 'Invalid steps payload' });
      data.steps = parsedSteps as unknown as Prisma.InputJsonValue;
    }

    const template = await prisma.onboardingTemplate.update({
      where: { id },
      data
    });

    return res.json({ message: 'Template updated', template });
  } catch (error) {
    console.error('Update onboarding template error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/templates/:id/publish', authorize('onboarding_template.publish'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const { id } = req.params;
    const { isActive = true } = req.body || {};

    const existing = await prisma.onboardingTemplate.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) return res.status(404).json({ error: 'Template not found' });

    const template = await prisma.onboardingTemplate.update({
      where: { id },
      data: { isActive: Boolean(isActive) }
    });

    return res.json({ message: isActive ? 'Template published' : 'Template unpublished', template });
  } catch (error) {
    console.error('Publish onboarding template error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/templates/:id/apply', authorize('onboarding_task.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const { id } = req.params;
    const { userId, assigneeId } = req.body || {};

    const template = await prisma.onboardingTemplate.findUnique({ where: { id } });
    if (!template || template.tenantId !== tenantId) return res.status(404).json({ error: 'Template not found' });

    const candidates = await prisma.user.findMany({
      where: {
        tenantId,
        role: template.role,
        ...(userId ? { id: userId } : {})
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true }
    });

    if (candidates.length === 0) return res.status(400).json({ error: 'No matching users to apply template' });
    const steps = parseSteps(template.steps as unknown[]) || [];

    let created = 0;
    for (const user of candidates) {
      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        const dueAt = typeof step.dueDays === 'number' && step.dueDays > 0
          ? new Date(Date.now() + step.dueDays * 24 * 60 * 60 * 1000)
          : null;

        const exists = await prisma.onboardingTask.findFirst({
          where: {
            tenantId,
            templateId: template.id,
            userId: user.id,
            title: step.title,
            stepOrder: i + 1
          }
        });
        if (exists) continue;

        await prisma.onboardingTask.create({
          data: {
            tenantId,
            templateId: template.id,
            userId: user.id,
            assigneeId: assigneeId || null,
            title: step.title,
            description: step.description || null,
            required: step.required !== false,
            stepOrder: i + 1,
            dueAt
          }
        });
        created += 1;
      }
    }

    return res.json({ message: 'Template applied', created });
  } catch (error) {
    console.error('Apply onboarding template error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tasks', authorize('onboarding_task.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const status = String(req.query.status || '').toUpperCase();
    const role = String(req.query.role || '').toUpperCase();
    const assigneeId = req.query.assigneeId as string | undefined;
    const search = String(req.query.search || '').trim();

    const where: Prisma.OnboardingTaskWhereInput = { tenantId };
    if (status && isTaskStatus(status)) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;
    if (role && isOnboardingRole(role)) where.user = { role };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const tasks = await prisma.onboardingTask.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        assignee: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        template: { select: { id: true, name: true, role: true, version: true } }
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }]
    });

    return res.json({ tasks });
  } catch (error) {
    if (isOnboardingModuleUnavailableError(error)) {
      return res.json({
        tasks: [],
        unavailable: true,
        reason: 'Pending database migration for onboarding tasks'
      });
    }
    console.error('List onboarding tasks error:', error);
    return res.json({
      tasks: [],
      unavailable: true,
      reason: 'Onboarding tasks service temporarily unavailable'
    });
  }
});

router.patch('/tasks/:id', authorize('onboarding_task.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const { id } = req.params;
    const { status, assigneeId, dueAt, notes } = req.body || {};

    const existing = await prisma.onboardingTask.findUnique({ where: { id } });
    if (!existing || existing.tenantId !== tenantId) return res.status(404).json({ error: 'Task not found' });

    let nextStatus: OnboardingTaskStatus | undefined;
    if (status) {
      const normalized = String(status).toUpperCase();
      if (!isTaskStatus(normalized)) return res.status(400).json({ error: 'Invalid task status' });
      nextStatus = normalized;
    }

    if (assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!assignee || assignee.tenantId !== tenantId) return res.status(400).json({ error: 'Invalid assignee for tenant' });
    }

    const updated = await prisma.onboardingTask.update({
      where: { id },
      data: {
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(assigneeId !== undefined ? { assigneeId: assigneeId || null } : {}),
        ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
        ...(nextStatus === 'APPROVED' || nextStatus === 'WAIVED' ? { completedAt: new Date() } : {}),
        ...(notes !== undefined ? { notes: String(notes || '').trim() || null } : {})
      }
    });

    return res.json({ message: 'Task updated', task: updated });
  } catch (error) {
    console.error('Update onboarding task error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tasks/:id/remind', authorize('onboarding_task.remind'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const { id } = req.params;
    const task = await prisma.onboardingTask.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
    if (!task || task.tenantId !== tenantId) return res.status(404).json({ error: 'Task not found' });

    await sendNotification(
      task.userId,
      'Onboarding Task Reminder',
      `Please complete your onboarding task: ${task.title}`,
      'INFO',
      '/settings',
      tenantId
    );

    const updated = await prisma.onboardingTask.update({
      where: { id },
      data: {
        lastReminderAt: new Date(),
        reminderCount: { increment: 1 }
      }
    });

    return res.json({ message: 'Reminder sent', task: updated });
  } catch (error) {
    console.error('Send onboarding reminder error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
