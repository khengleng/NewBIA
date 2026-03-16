import { Router, Response } from 'express';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { logAuditEvent } from '../utils/security';
import { isMissingSchemaError } from '../utils/prisma-errors';

const router = Router();

function isValidRole(value: string): value is UserRole {
  return ['SUPER_ADMIN', 'ADMIN', 'FINOPS', 'CX', 'AUDITOR', 'COMPLIANCE', 'ADVISOR', 'SUPPORT', 'INVESTOR', 'SME'].includes(value);
}

function requiresSuperAdmin(role: string): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

router.get('/requests/mine', authorize('role_request.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const userId = req.user?.id;
    const requests = await prisma.roleChangeRequest.findMany({
      where: { tenantId, requesterId: userId },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ requests });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.json({
        requests: [],
        unavailable: true,
        reason: 'Pending database migration for role lifecycle'
      });
    }
    console.error('List my role requests error:', error);
    return res.json({ requests: [], unavailable: true, reason: 'Role lifecycle service temporarily unavailable' });
  }
});

router.post('/requests', authorize('role_request.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const requesterId = req.user?.id;
    const currentRole = req.user?.role;
    const requestedRole = String(req.body?.requestedRole || '').toUpperCase();
    const reason = String(req.body?.reason || '').trim();

    if (!requesterId || !currentRole) return res.status(401).json({ error: 'Unauthorized' });
    if (!isValidRole(requestedRole)) return res.status(400).json({ error: 'Invalid requested role' });
    if (!reason || reason.length < 10) return res.status(400).json({ error: 'Reason must be at least 10 characters' });
    if (currentRole === requestedRole) return res.status(400).json({ error: 'Requested role must be different from current role' });

    const existingPending = await prisma.roleChangeRequest.findFirst({
      where: { tenantId, requesterId, status: 'PENDING' }
    });
    if (existingPending) return res.status(400).json({ error: 'You already have a pending role request' });

    const request = await prisma.roleChangeRequest.create({
      data: {
        tenantId,
        requesterId,
        currentRole,
        requestedRole,
        reason
      }
    });

    return res.status(201).json({ message: 'Role change request submitted', request });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.status(200).json({
        message: 'Role lifecycle module unavailable; request not persisted',
        unavailable: true,
        reason: 'Pending database migration for role lifecycle'
      });
    }
    console.error('Create role request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/requests', authorize('role_request.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const status = String(req.query.status || '').toUpperCase();
    const where: any = { tenantId };
    if (['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) where.status = status;

    const requests = await prisma.roleChangeRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ requests });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.json({
        requests: [],
        unavailable: true,
        reason: 'Pending database migration for role lifecycle'
      });
    }
    console.error('List role requests error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/requests/:id/approve', authorize('role_request.review'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const reviewerId = req.user?.id;
    const reviewerRole = req.user?.role;
    const { id } = req.params;
    const reviewNote = String(req.body?.reviewNote || '').trim();

    const request = await prisma.roleChangeRequest.findUnique({
      where: { id },
      include: { requester: true }
    });
    if (!request || request.tenantId !== tenantId) return res.status(404).json({ error: 'Role request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'Only pending requests can be approved' });
    if (requiresSuperAdmin(request.requestedRole) && reviewerRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only SUPER_ADMIN can approve ADMIN or SUPER_ADMIN role requests' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.roleChangeRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewNote: reviewNote || null
        }
      });

      const updatedUser = await tx.user.update({
        where: { id: request.requesterId },
        data: { role: request.requestedRole }
      });

      return { updatedRequest, updatedUser };
    });

    await logAuditEvent({
      userId: reviewerId || 'unknown',
      action: 'ROLE_REQUEST_APPROVED',
      resource: 'role_change_request',
      resourceId: id,
      details: {
        requesterId: request.requesterId,
        from: request.currentRole,
        to: request.requestedRole
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    return res.json({ message: 'Role request approved', request: result.updatedRequest, user: result.updatedUser });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.status(200).json({
        message: 'Role lifecycle module unavailable; approval deferred',
        unavailable: true,
        reason: 'Pending database migration for role lifecycle'
      });
    }
    console.error('Approve role request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/requests/:id/reject', authorize('role_request.review'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const reviewerId = req.user?.id;
    const { id } = req.params;
    const reviewNote = String(req.body?.reviewNote || '').trim();
    if (!reviewNote || reviewNote.length < 5) return res.status(400).json({ error: 'Review note is required to reject' });

    const request = await prisma.roleChangeRequest.findUnique({ where: { id } });
    if (!request || request.tenantId !== tenantId) return res.status(404).json({ error: 'Role request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'Only pending requests can be rejected' });

    const updated = await prisma.roleChangeRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote
      }
    });

    return res.json({ message: 'Role request rejected', request: updated });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.status(200).json({
        message: 'Role lifecycle module unavailable; rejection deferred',
        unavailable: true,
        reason: 'Pending database migration for role lifecycle'
      });
    }
    console.error('Reject role request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/grants', authorize('role_grant.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const userId = req.query.userId as string | undefined;
    const status = String(req.query.status || '').toUpperCase();
    const now = new Date();
    const where: any = { tenantId };
    if (userId) where.userId = userId;
    if (['ACTIVE', 'EXPIRED', 'REVOKED'].includes(status)) where.status = status;

    const grants = await prisma.temporaryRoleGrant.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        grantedBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const normalized = grants.map((grant) => {
      if (grant.status === 'ACTIVE' && grant.expiresAt <= now) {
        return { ...grant, status: 'EXPIRED' as const };
      }
      return grant;
    });

    return res.json({ grants: normalized });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.json({
        grants: [],
        unavailable: true,
        reason: 'Pending database migration for role lifecycle'
      });
    }
    console.error('List role grants error:', error);
    return res.json({ grants: [], unavailable: true, reason: 'Role grants service temporarily unavailable' });
  }
});

router.post('/grants', authorize('role_grant.create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const grantedById = req.user?.id;
    const grantorRole = req.user?.role;
    const { userId, role, reason, expiresAt } = req.body || {};
    const normalizedRole = String(role || '').toUpperCase();

    if (!grantedById) return res.status(401).json({ error: 'Unauthorized' });
    if (!isValidRole(normalizedRole)) return res.status(400).json({ error: 'Invalid role' });
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!expiresAt) return res.status(400).json({ error: 'expiresAt is required' });

    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry <= new Date()) {
      return res.status(400).json({ error: 'expiresAt must be a future datetime' });
    }
    if (requiresSuperAdmin(normalizedRole) && grantorRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only SUPER_ADMIN can grant ADMIN or SUPER_ADMIN privileges' });
    }

    const target = await prisma.user.findUnique({ where: { id: String(userId) } });
    if (!target || target.tenantId !== tenantId) return res.status(404).json({ error: 'Target user not found' });

    const grant = await prisma.temporaryRoleGrant.create({
      data: {
        tenantId,
        userId: target.id,
        role: normalizedRole,
        reason: reason ? String(reason).trim() : null,
        grantedById,
        expiresAt: expiry
      }
    });

    await logAuditEvent({
      userId: grantedById,
      action: 'ROLE_GRANT_CREATED',
      resource: 'temporary_role_grant',
      resourceId: grant.id,
      details: { targetUserId: target.id, role: normalizedRole, expiresAt: expiry.toISOString() },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });

    return res.status(201).json({ message: 'Temporary role grant created', grant });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.status(200).json({
        message: 'Role lifecycle module unavailable; grant not persisted',
        unavailable: true,
        reason: 'Pending database migration for role lifecycle'
      });
    }
    console.error('Create role grant error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/grants/:id/revoke', authorize('role_grant.revoke'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    const revokedById = req.user?.id;
    const { id } = req.params;
    const revokeReason = String(req.body?.revokeReason || '').trim();

    const grant = await prisma.temporaryRoleGrant.findUnique({ where: { id } });
    if (!grant || grant.tenantId !== tenantId) return res.status(404).json({ error: 'Grant not found' });
    if (grant.status !== 'ACTIVE') return res.status(400).json({ error: 'Only active grants can be revoked' });

    const updated = await prisma.temporaryRoleGrant.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById: revokedById || null,
        revokeReason: revokeReason || null
      }
    });

    return res.json({ message: 'Grant revoked', grant: updated });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      return res.status(200).json({
        message: 'Role lifecycle module unavailable; revoke deferred',
        unavailable: true,
        reason: 'Pending database migration for role lifecycle'
      });
    }
    console.error('Revoke role grant error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
