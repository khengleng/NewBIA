
import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { sanitizeAgreementContent } from '../utils/content-sanitizer';

const router = Router();

const createAgreementSchema = z.object({
    title: z.string().min(3),
    content: z.string().min(10), // HTML or Markdown
    signerIds: z.array(z.string()).min(1)
});

const signAgreementSchema = z.object({
    signature: z.string().min(1) // Base64 or typed name
});

// GET /api/agreements/deal/:dealId
router.get('/deal/:dealId', authorize('deal.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dealId } = req.params;
        const tenantId = req.user?.tenantId || 'default';

        const agreements = await (prisma as any).agreement.findMany({
            where: { dealId, tenantId },
            include: {
                signers: {
                    include: {
                        user: {
                            select: { id: true, firstName: true, lastName: true, email: true, role: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Add user-specific status (e.g., "needs your signature")
        const userId = req.user?.id;
        const enhancedAgreements = agreements.map((agreement: any) => {
            const mySignerRecord = agreement.signers.find((s: any) => s.userId === userId);
            return {
                ...agreement,
                userStatus: mySignerRecord ? mySignerRecord.status : 'NOT_INVOLVED',
                canSign: mySignerRecord && mySignerRecord.status === 'PENDING' && agreement.status === 'PENDING_SIGNATURES'
            };
        });

        return res.json(enhancedAgreements);

    } catch (error) {
        console.error('Error fetching agreements:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/agreements/:dealId
router.post('/:dealId', authorize('deal.update'), validateBody(createAgreementSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dealId } = req.params;
        const { title, content, signerIds } = req.body;
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const createdBy = req.user?.id;
        const sanitizedTitle = sanitizeAgreementContent(title);
        const sanitizedContent = sanitizeAgreementContent(content);

        // Verify deal within tenant scope (unless super admin)
        const deal = await prisma.deal.findFirst({
            where: isSuperAdmin ? { id: dealId } : { id: dealId, tenantId },
            include: {
                sme: { select: { userId: true } },
                investors: { include: { investor: { select: { userId: true } } } }
            }
        });
        if (!deal) return res.status(404).json({ error: 'Deal not found' });

        // Ensure signer accounts exist in same tenant to prevent cross-tenant association.
        const signerUsers = await prisma.user.findMany({
            where: isSuperAdmin
                ? { id: { in: signerIds as string[] } }
                : { id: { in: signerIds as string[] }, tenantId },
            select: { id: true }
        });
        if (signerUsers.length !== (signerIds as string[]).length) {
            return res.status(400).json({ error: 'One or more signerIds are invalid for this tenant' });
        }

        // Restrict signers to participants in this deal (SME owner, investors) plus agreement creator.
        const allowedSignerIds = new Set<string>([
            deal.sme.userId,
            ...(deal.investors || []).map((entry: any) => entry.investor.userId),
            ...(createdBy ? [createdBy] : [])
        ]);
        const invalidSigners = (signerIds as string[]).filter((id) => !allowedSignerIds.has(id));
        if (invalidSigners.length > 0) {
            return res.status(400).json({ error: 'Signer list includes users that are not participants in this deal' });
        }

        // Create Agreement
        const agreement = await (prisma as any).agreement.create({
            data: {
                dealId,
                tenantId: deal.tenantId,
                title: sanitizedTitle,
                content: sanitizedContent,
                status: 'PENDING_SIGNATURES',
                signers: {
                    create: signerIds.map((signerId: string) => ({
                        userId: signerId,
                        role: 'SIGNER', // Can be refined based on user role
                        status: 'PENDING'
                    }))
                }
            },
            include: {
                signers: true
            }
        });

        return res.status(201).json(agreement);

    } catch (error) {
        console.error('Error creating agreement:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/agreements/:agreementId/sign
router.post('/:agreementId/sign', authorize('deal.read'), validateBody(signAgreementSchema), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { agreementId } = req.params;
        const { signature } = req.body;
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const ipAddress = req.ip;
        const userAgent = req.headers['user-agent'];
        const sanitizedSignature = sanitizeAgreementContent(signature);

        // Find Signer Record
        const signerRecord = await (prisma as any).agreementSigner.findFirst({
            where: isSuperAdmin
                ? { agreementId, userId }
                : { agreementId, userId, agreement: { tenantId } }
        });

        if (!signerRecord) {
            return res.status(403).json({ error: 'You are not a designated signer for this agreement.' });
        }

        if (signerRecord.status === 'SIGNED') {
            return res.status(400).json({ error: 'You have already signed this agreement.' });
        }

        // Update Signer Record
        await (prisma as any).agreementSigner.update({
            where: { id: signerRecord.id },
            data: {
                status: 'SIGNED',
                signature: sanitizedSignature,
                signedAt: new Date(),
                ipAddress,
                userAgent
            }
        });

        // Check if all signers have signed
        const agreement = await (prisma as any).agreement.findUnique({
            where: { id: agreementId },
            include: { signers: true }
        });
        if (!agreement || (!isSuperAdmin && agreement.tenantId !== tenantId)) {
            return res.status(404).json({ error: 'Agreement not found' });
        }

        const allSigned = agreement.signers.every((s: any) => s.status === 'SIGNED' || s.status === 'REJECTED'); // Handle rejection logic if needed

        if (allSigned) {
            await (prisma as any).agreement.update({
                where: { id: agreementId },
                data: { status: 'COMPLETED' }
            });

        }

        return res.json({ success: true, message: 'Agreement signed successfully.' });

    } catch (error) {
        console.error('Error signing agreement:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/agreements/:agreementId/verify
// Publicly accessible verification (optional, often requires hash reference) or protected
router.get('/:agreementId/verify', authorize('deal.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { agreementId } = req.params;
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';

        const agreement = await (prisma as any).agreement.findFirst({
            where: isSuperAdmin ? { id: agreementId } : { id: agreementId, tenantId },
            include: {
                signers: {
                    include: {
                        user: { select: { id: true, email: true, firstName: true, lastName: true } }
                    }
                }
            }
        });

        if (!agreement) return res.status(404).json({ error: 'Agreement not found' });

        return res.json({
            verified: true,
            agreementId: agreement.id,
            status: agreement.status,
            createdAt: agreement.createdAt,
            signers: agreement.signers.map((s: any) => ({
                name: `${s.user.firstName} ${s.user.lastName}`,
                email: s.user.email,
                status: s.status,
                signedAt: s.signedAt,
                ipAddress: s.ipAddress // Sensitive? Maybe mask it
            }))
        });

    } catch (error) {
        console.error('Error verifying agreement check:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
