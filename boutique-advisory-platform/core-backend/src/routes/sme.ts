import { Router, Request, Response } from 'express';
import { prisma } from '../database';
import { createSMEOnboardingSchema, validateBody, updateSMESchema, idParamSchema, validateParams } from '../middleware/validation';
import { authorize, AuthenticatedRequest } from '../middleware/authorize';
import { logAuditEvent } from '../utils/security';
import bcrypt from 'bcryptjs';
import { generateSecureToken, sanitizeEmail } from '../utils/security';

const router = Router();
const smeStatusTransitions: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'DELETED'],
  SUBMITTED: ['UNDER_REVIEW', 'DRAFT', 'DELETED'],
  UNDER_REVIEW: ['CERTIFIED', 'REJECTED', 'DELETED'],
  REJECTED: ['DRAFT', 'DELETED'],
  CERTIFIED: ['DELETED'],
  DELETED: []
};

function canTransitionSmeStatus(current: string, next: string): boolean {
  return (smeStatusTransitions[current] || []).includes(next);
}

function canUserSetSmeStatus(role: string | undefined, current: string, next: string): boolean {
  if (!role) return false;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true;
  if (role === 'ADVISOR') {
    return ['UNDER_REVIEW', 'CERTIFIED', 'REJECTED'].includes(next);
  }
  if (role === 'SME') {
    return (current === 'DRAFT' && next === 'SUBMITTED')
      || (current === 'SUBMITTED' && next === 'DRAFT')
      || (current === 'REJECTED' && next === 'DRAFT');
  }
  return false;
}

router.post('/', authorize('sme.create'), validateBody(createSMEOnboardingSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const actorUserId = req.user?.id;
    const actorRole = req.user?.role;
    const tenantId = req.user?.tenantId;
    if (!actorUserId || !tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      ownerFirstName,
      ownerLastName,
      ownerEmail,
      ownerPassword,
      name,
      sector,
      stage,
      fundingRequired,
      description,
      website,
      location,
      onboardingMode,
      mandateDocumentUrl,
      mandateDocumentName
    } = req.body || {};

    const sanitizedOwnerEmail = sanitizeEmail(ownerEmail || '');
    if (!sanitizedOwnerEmail) {
      return res.status(400).json({ error: 'Invalid owner email' });
    }

    const isOnBehalfMode = String(onboardingMode || '').toUpperCase() === 'ON_BEHALF';
    if (isOnBehalfMode) {
      const canOnboardOnBehalf = actorRole === 'ADVISOR' || actorRole === 'ADMIN' || actorRole === 'SUPER_ADMIN';
      if (!canOnboardOnBehalf) {
        return res.status(403).json({ error: 'Only advisors/admins can onboard SMEs on behalf of owners' });
      }
      if (!mandateDocumentUrl || !String(mandateDocumentUrl).startsWith('https://')) {
        return res.status(400).json({ error: 'Mandate document URL must be a valid HTTPS URL' });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let existingSmeIdToRevive: string | null = null;
      let ownerUser = await tx.user.findFirst({
        where: {
          tenantId,
          email: { equals: sanitizedOwnerEmail, mode: 'insensitive' },
          status: { not: 'DELETED' }
        }
      });

      if (ownerUser) {
        if (ownerUser.role !== 'SME') {
          throw new Error('OWNER_EMAIL_ROLE_CONFLICT');
        }
        const existingSme = await tx.sME.findUnique({ where: { userId: ownerUser.id } });
        if (existingSme && existingSme.status !== 'DELETED') {
          throw new Error('SME_PROFILE_ALREADY_EXISTS');
        }
        if (existingSme && existingSme.status === 'DELETED') {
          existingSmeIdToRevive = existingSme.id;
        }
      } else {
        const passwordToUse = ownerPassword || `${generateSecureToken(16)}Aa1!`;
        ownerUser = await tx.user.create({
          data: {
            tenantId,
            firstName: String(ownerFirstName).trim(),
            lastName: String(ownerLastName).trim(),
            email: sanitizedOwnerEmail,
            password: await bcrypt.hash(passwordToUse, 12),
            role: 'SME' as any,
            status: 'ACTIVE' as any,
            isEmailVerified: false,
            language: 'EN'
          }
        });
      }

      const sme = existingSmeIdToRevive
        ? await tx.sME.update({
          where: { id: existingSmeIdToRevive },
          data: {
            name: String(name).trim(),
            sector: String(sector).trim(),
            stage: String(stage).toUpperCase() as any,
            fundingRequired: Number(fundingRequired),
            description: description ? String(description) : null,
            website: website ? String(website) : null,
            location: location ? String(location) : null,
            status: 'DRAFT' as any
          },
          include: { user: true }
        })
        : await tx.sME.create({
          data: {
            tenantId,
            userId: ownerUser.id,
            name: String(name).trim(),
            sector: String(sector).trim(),
            stage: String(stage).toUpperCase() as any,
            fundingRequired: Number(fundingRequired),
            description: description ? String(description) : null,
            website: website ? String(website) : null,
            location: location ? String(location) : null,
            status: 'DRAFT' as any
          },
          include: { user: true }
        });

      if (isOnBehalfMode) {
        await tx.document.create({
          data: {
            tenantId,
            name: mandateDocumentName ? String(mandateDocumentName) : `Mandate-${sme.id}.pdf`,
            type: 'LEGAL_DOCUMENT' as any,
            url: String(mandateDocumentUrl),
            size: 0,
            mimeType: 'application/pdf',
            smeId: sme.id,
            uploadedBy: actorUserId
          }
        });
      }

      return { sme, ownerUserCreated: !ownerPassword ? !ownerUser?.isEmailVerified : false };
    });

    await logAuditEvent({
      userId: actorUserId,
      tenantId,
      action: isOnBehalfMode ? 'SME_ONBEHALF_ONBOARDED' : 'SME_ONBOARDED',
      resource: 'sme',
      resourceId: result.sme.id,
      details: {
        ownerEmail: sanitizedOwnerEmail,
        onboardingMode: isOnBehalfMode ? 'ON_BEHALF' : 'DIRECT'
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
      success: true
    });

    return res.status(201).json({
      message: isOnBehalfMode
        ? 'SME onboarded on behalf of owner successfully'
        : 'SME onboarded successfully',
      sme: result.sme
    });
  } catch (error: any) {
    if (error?.message === 'SME_PROFILE_ALREADY_EXISTS') {
      return res.status(409).json({ error: 'SME profile already exists for this owner email' });
    }
    if (error?.message === 'OWNER_EMAIL_ROLE_CONFLICT') {
      return res.status(409).json({ error: 'Owner email is already assigned to a non-SME account' });
    }
    console.error('Create SME error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all SMEs
router.get('/', authorize('sme.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const tenantId = req.user?.tenantId;

    let query: any = {
      where: {
        tenantId: tenantId,
        status: { not: 'DELETED' }
      },
      include: {
        user: true,
        deals: true
      }
    };

    // RBAC: SME can only see their own profile
    if (userRole === 'SME') {
      query.where.userId = userId;
    } else if (userRole === 'INVESTOR') {
      query.where.status = { in: ['CERTIFIED', 'SUBMITTED', 'UNDER_REVIEW'] };
    }

    const smes = await prisma.sME.findMany(query);
    return res.json(smes);
  } catch (error) {
    console.error('Get SMEs error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get SME by ID
router.get('/:id', authorize('sme.read', {
  getOwnerId: async (req) => {
    const sme = await prisma.sME.findUnique({
      where: { id: req.params.id },
      select: { userId: true }
    });
    return sme?.userId;
  }
}), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const sme = await prisma.sME.findFirst({
      where: {
        id,
        tenantId: req.user?.tenantId || 'default'
      },
      include: {
        user: true,
        deals: true,
        documents: true
      }
    });

    if (!sme) {
      return res.status(404).json({ error: 'SME not found' });
    }

    // Explicit ownership check since authorize() level check for ':owner' might need pre-fetching
    if (userRole === 'SME' && sme.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: You can only view your own SME profile' });
    }

    return res.json(sme);
  } catch (error) {
    console.error('Get SME error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update SME - with input validation
router.put('/:id', authorize('sme.update', {
  getOwnerId: async (req) => {
    const sme = await prisma.sME.findUnique({
      where: { id: req.params.id },
      select: { userId: true }
    });
    return sme?.userId;
  }
}), validateBody(updateSMESchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const updateData = req.body;

    // Check if SME exists and ownership
    const existingSme = await prisma.sME.findFirst({
      where: {
        id,
        tenantId: req.user?.tenantId || 'default'
      }
    });
    if (!existingSme) {
      return res.status(404).json({ error: 'SME not found' });
    }

    if (userRole === 'SME' && existingSme.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: You can only update your own SME profile' });
    }

    if (updateData.status && updateData.status !== existingSme.status) {
      const nextStatus = String(updateData.status);
      const currentStatus = String(existingSme.status);
      if (!canTransitionSmeStatus(currentStatus, nextStatus)) {
        return res.status(409).json({
          error: `Invalid SME status transition: ${currentStatus} -> ${nextStatus}`
        });
      }
      if (!canUserSetSmeStatus(userRole, currentStatus, nextStatus)) {
        return res.status(403).json({
          error: `Role ${userRole} is not allowed to move SME status to ${nextStatus}`
        });
      }

      if (nextStatus === 'SUBMITTED') {
        const requiredForSubmission = ['name', 'sector', 'stage', 'fundingRequired'] as const;
        for (const field of requiredForSubmission) {
          const newValue = updateData[field] ?? (existingSme as any)[field];
          if (newValue === null || newValue === undefined || newValue === '' || (field === 'fundingRequired' && Number(newValue) <= 0)) {
            return res.status(400).json({
              error: `SME is missing required field for submission: ${field}`
            });
          }
        }
      }
    }

    const sme = await prisma.sME.update({
      where: { id },
      data: updateData,
      include: {
        user: true
      }
    });

    if (updateData.status && updateData.status !== existingSme.status) {
      await logAuditEvent({
        userId: req.user?.id || 'unknown',
        tenantId: req.user?.tenantId,
        action: 'SME_STATUS_TRANSITION',
        resource: 'sme',
        resourceId: sme.id,
        details: {
          fromStatus: existingSme.status,
          toStatus: sme.status
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
        success: true
      });
    }

    return res.json(sme);
  } catch (error) {
    console.error('Update SME error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete SME
router.delete('/:id', authorize('sme.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingSme = await prisma.sME.findFirst({
      where: {
        id,
        tenantId: req.user?.tenantId || 'default'
      },
      include: { user: true }
    });
    if (!existingSme) {
      return res.status(404).json({ error: 'SME not found' });
    }

    const timestamp = Date.now();
    const deletedEmail = `deleted_${timestamp}_${existingSme.user.email}`;

    await prisma.sME.update({
      where: { id },
      data: {
        status: 'DELETED' as any,
        // Mark the associated user as deleted too and free up the email
        user: {
          update: {
            status: 'DELETED' as any,
            email: deletedEmail
          }
        }
      }
    });

    return res.status(200).json({ message: 'SME soft deleted successfully' });
  } catch (error: any) {
    console.error('Delete SME error:', error);
    return res.status(500).json({ error: 'Failed to delete SME' });
  }
});

export default router;
