import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { isMissingSchemaError } from '../utils/prisma-errors';

const router = Router();

const retentionModules = [
  'MESSAGES',
  'DOCUMENTS',
  'ACTIVITY_LOGS',
  'SESSIONS',
  'DISPUTES',
  'WORKFLOWS'
] as const;

function tenantScope(req: AuthenticatedRequest) {
  const tenantId = req.user?.tenantId || 'default';
  const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
  return { tenantId, isSuperAdmin };
}

router.get('/overview', authorize('data_governance.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const scope = isSuperAdmin ? {} : { tenantId };

    const [ruleCounts, holdCounts, oldestHold] = await Promise.all([
      prisma.dataRetentionRule.groupBy({
        by: ['status'],
        where: scope,
        _count: { id: true }
      }),
      prisma.legalHold.groupBy({
        by: ['status'],
        where: scope,
        _count: { id: true }
      }),
      prisma.legalHold.findFirst({
        where: {
          ...scope,
          status: 'ACTIVE'
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, title: true, createdAt: true }
      })
    ]);

    const activeRules = ruleCounts.find((row) => row.status === 'ACTIVE')?._count.id || 0;
    const pausedRules = ruleCounts.find((row) => row.status === 'PAUSED')?._count.id || 0;
    const activeHolds = holdCounts.find((row) => row.status === 'ACTIVE')?._count.id || 0;

    return res.json({
      overview: {
        activeRules,
        pausedRules,
        activeHolds,
        oldestActiveHold: oldestHold || null
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.json({
        overview: {
          activeRules: 0,
          pausedRules: 0,
          activeHolds: 0,
          oldestActiveHold: null
        },
        unavailable: true,
        reason: 'Pending database migration for data governance'
      });
    }
    console.error('Data governance overview error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/retention/rules', authorize('retention_rule.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const where = isSuperAdmin ? {} : { tenantId };

    const rules = await prisma.dataRetentionRule.findMany({
      where,
      orderBy: [{ module: 'asc' }]
    });

    return res.json({ rules, modules: retentionModules });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.json({
        rules: [],
        modules: retentionModules,
        unavailable: true,
        reason: 'Pending database migration for data governance'
      });
    }
    console.error('List retention rules error:', error);
    return res.json({ rules: [], modules: retentionModules, unavailable: true, reason: 'Data governance service temporarily unavailable' });
  }
});

router.put('/retention/rules/:module', authorize('retention_rule.update'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = tenantScope(req);
    const module = String(req.params.module || '').toUpperCase();
    const retentionDays = Number(req.body?.retentionDays);
    const archiveBeforeDelete = req.body?.archiveBeforeDelete !== false;
    const status = String(req.body?.status || 'ACTIVE').toUpperCase();

    if (!retentionModules.includes(module as typeof retentionModules[number])) {
      return res.status(400).json({ error: 'Invalid retention module' });
    }
    if (!Number.isFinite(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
      return res.status(400).json({ error: 'retentionDays must be between 1 and 3650' });
    }
    if (!['ACTIVE', 'PAUSED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid rule status' });
    }

    const rule = await prisma.dataRetentionRule.upsert({
      where: { tenantId_module: { tenantId, module: module as any } },
      create: {
        tenantId,
        module: module as any,
        retentionDays,
        archiveBeforeDelete,
        status: status as any,
        lastEvaluatedAt: new Date()
      },
      update: {
        retentionDays,
        archiveBeforeDelete,
        status: status as any,
        lastEvaluatedAt: new Date()
      }
    });

    return res.json({ message: 'Retention rule updated', rule });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.status(200).json({
        message: 'Data governance module unavailable; rule update deferred',
        unavailable: true,
        reason: 'Pending database migration for data governance'
      });
    }
    console.error('Upsert retention rule error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/legal-holds', authorize('legal_hold.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const status = String(req.query.status || '').toUpperCase();

    const where: any = isSuperAdmin ? {} : { tenantId };
    if (['ACTIVE', 'RELEASED'].includes(status)) where.status = status;

    const holds = await prisma.legalHold.findMany({
      where,
      include: {
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        releasedBy: { select: { firstName: true, lastName: true, email: true } }
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200
    });

    return res.json({ holds });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.json({
        holds: [],
        unavailable: true,
        reason: 'Pending database migration for data governance'
      });
    }
    console.error('List legal holds error:', error);
    return res.json({ holds: [], unavailable: true, reason: 'Data governance service temporarily unavailable' });
  }
});

router.post('/legal-holds', authorize('legal_hold.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = tenantScope(req);
    const createdById = req.user?.id;
    const title = String(req.body?.title || '').trim();
    const reason = String(req.body?.reason || '').trim();
    const scopeType = String(req.body?.scopeType || 'TENANT').trim().toUpperCase();
    const scope = req.body?.scope && typeof req.body.scope === 'object' ? req.body.scope : {};

    if (!createdById) return res.status(401).json({ error: 'Unauthorized' });
    if (!title || !reason) return res.status(400).json({ error: 'title and reason are required' });

    const hold = await prisma.legalHold.create({
      data: {
        tenantId,
        title,
        reason,
        scopeType,
        scope,
        createdById
      }
    });

    return res.status(201).json({ message: 'Legal hold created', hold });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.status(200).json({
        message: 'Data governance module unavailable; legal hold not persisted',
        unavailable: true,
        reason: 'Pending database migration for data governance'
      });
    }
    console.error('Create legal hold error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/legal-holds/:id/release', authorize('legal_hold.release'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const releasedById = req.user?.id;
    const { id } = req.params;

    if (!releasedById) return res.status(401).json({ error: 'Unauthorized' });

    const hold = await prisma.legalHold.findUnique({ where: { id } });
    if (!hold || (!isSuperAdmin && hold.tenantId !== tenantId)) {
      return res.status(404).json({ error: 'Legal hold not found' });
    }
    if (hold.status === 'RELEASED') {
      return res.status(400).json({ error: 'Legal hold already released' });
    }

    const updated = await prisma.legalHold.update({
      where: { id },
      data: {
        status: 'RELEASED',
        releasedById,
        releasedAt: new Date()
      }
    });

    return res.json({ message: 'Legal hold released', hold: updated });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.status(200).json({
        message: 'Data governance module unavailable; legal hold release deferred',
        unavailable: true,
        reason: 'Pending database migration for data governance'
      });
    }
    console.error('Release legal hold error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/legal-holds/check', authorize('legal_hold.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId, isSuperAdmin } = tenantScope(req);
    const entityType = String(req.query.entityType || '').toUpperCase();
    const entityId = String(req.query.entityId || '');

    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required' });
    }

    const activeHolds = await prisma.legalHold.findMany({
      where: {
        ...(isSuperAdmin ? {} : { tenantId }),
        status: 'ACTIVE'
      },
      select: {
        id: true,
        title: true,
        scopeType: true,
        scope: true,
        createdAt: true
      }
    });

    const matching = activeHolds.filter((hold) => {
      if (hold.scopeType === 'TENANT') return true;
      const scope = hold.scope as { entityType?: string; entityId?: string; ids?: string[] };
      if (!scope) return false;
      if (scope.entityType === entityType && scope.entityId === entityId) return true;
      if (scope.entityType === entityType && Array.isArray(scope.ids) && scope.ids.includes(entityId)) return true;
      return false;
    });

    return res.json({ blocked: matching.length > 0, holds: matching });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.json({
        blocked: false,
        holds: [],
        unavailable: true,
        reason: 'Pending database migration for data governance'
      });
    }
    console.error('Check legal hold error:', error);
    return res.json({ blocked: false, holds: [], unavailable: true, reason: 'Data governance service temporarily unavailable' });
  }
});

export default router;
