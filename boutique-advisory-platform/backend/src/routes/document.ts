import { Router, Response } from 'express';
import { prisma } from '../database';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { upload } from '../middleware/upload';
import { uploadFile, deleteFile, getPresignedUrl, extractKeyFromUrl } from '../utils/fileUpload';

const router = Router();

// Upload document to cloud storage
// Upload document to cloud storage
router.post(
    '/upload',
    authorize('document.create', {
        // Resolve resource ownership from referenced SME/deal for owner-scoped checks.
        getOwnerId: async (req) => {
            const userRole = req.user?.role;
            if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || userRole === 'ADVISOR') {
                return req.user?.id;
            }

            const tenantId = req.user?.tenantId || 'default';
            const body = (req.body || {}) as Record<string, unknown>;
            const rawSmeId = typeof body.smeId === 'string' ? body.smeId.trim() : '';
            const rawDealId = typeof body.dealId === 'string' ? body.dealId.trim() : '';

            if (rawSmeId) {
                const sme = await prisma.sME.findFirst({
                    where: { id: rawSmeId, tenantId },
                    select: { userId: true }
                });
                return sme?.userId;
            }

            if (rawDealId) {
                const deal = await prisma.deal.findFirst({
                    where: { id: rawDealId, tenantId },
                    include: { sme: { select: { userId: true } } }
                });
                return deal?.sme?.userId;
            }

            return undefined;
        }
    }),
    upload.single('file'),
    async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { name, type, smeId, dealId } = req.body;
        const file = req.file;
        const userRole = req.user?.role;
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = userRole === 'SUPER_ADMIN';
        const isSmeRole = userRole === 'SME';

        const normalizedSmeId = typeof smeId === 'string' && smeId.trim() ? smeId.trim() : null;
        const normalizedDealId = typeof dealId === 'string' && dealId.trim() ? dealId.trim() : null;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        let resolvedSmeId: string | null = normalizedSmeId;
        let resolvedDealId: string | null = normalizedDealId;
        let effectiveTenantId = tenantId;

        if (normalizedSmeId) {
            const sme = await prisma.sME.findFirst({
                where: isSuperAdmin ? { id: normalizedSmeId } : { id: normalizedSmeId, tenantId },
                select: { id: true, tenantId: true, userId: true }
            });

            if (!sme) {
                return res.status(404).json({ error: 'SME not found' });
            }

            if (isSmeRole && sme.userId !== req.user?.id) {
                return res.status(403).json({ error: 'You can only upload documents for your own SME profile' });
            }

            resolvedSmeId = sme.id;
            effectiveTenantId = sme.tenantId;
        }

        if (normalizedDealId) {
            const deal = await prisma.deal.findFirst({
                where: isSuperAdmin ? { id: normalizedDealId } : { id: normalizedDealId, tenantId },
                include: {
                    sme: {
                        select: {
                            id: true,
                            userId: true
                        }
                    }
                }
            });

            if (!deal) {
                return res.status(404).json({ error: 'Deal not found' });
            }

            if (isSmeRole && deal.sme.userId !== req.user?.id) {
                return res.status(403).json({ error: 'You can only upload documents for your own SME deals' });
            }

            if (resolvedSmeId && deal.smeId !== resolvedSmeId) {
                return res.status(400).json({ error: 'smeId does not match the provided dealId' });
            }

            resolvedSmeId = resolvedSmeId || deal.smeId;
            resolvedDealId = deal.id;
            effectiveTenantId = deal.tenantId;
        }

        // Determine folder based on document type
        const folder = resolvedSmeId ? `sme/${resolvedSmeId}` : resolvedDealId ? `deal/${resolvedDealId}` : 'general';

        // Upload to cloud storage (S3/R2)
        const uploadResult = await uploadFile(file, folder);

        // Save document metadata to database
        const document = await prisma.document.create({
            data: {
                tenantId: effectiveTenantId,
                name: name || file.originalname,
                type: type || 'OTHER',
                url: uploadResult.url,
                size: uploadResult.size,
                mimeType: file.mimetype,
                smeId: resolvedSmeId,
                dealId: resolvedDealId,
                uploadedBy: req.user!.id
            }
        });

        return res.status(201).json({
            ...document,
            message: 'File uploaded successfully'
        });
    } catch (error: any) {
        console.error('Error uploading document:', error);
        return res.status(500).json({
            error: 'Failed to upload document',
            details: error.message
        });
    }
});

// Get document by ID with access control
// Get document by ID with access control
router.get('/:id', authorize('document.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId || 'default';
        const document = await prisma.document.findFirst({
            where: { id, tenantId },
            include: {
                sme: { select: { userId: true } },
                deal: { select: { sme: { select: { userId: true } } } }
            }
        });

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // SECURITY: Verify access rights
        const userId = req.user?.id;
        const userRole = req.user?.role;

        // Admins and Super Admins can access all documents
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

        // User uploaded the document
        const isUploader = document.uploadedBy === userId;

        // User owns the SME that the document belongs to
        const isSmeOwner = document.sme?.userId === userId;

        // User owns the SME associated with the deal
        const isDealSmeOwner = document.deal?.sme?.userId === userId;

        // Check if user is an investor in the deal
        let isInvestorInDeal = false;
        if (document.dealId && userRole === 'INVESTOR') {
            const investor = await prisma.investor.findFirst({
                where: { userId }
            });
            if (investor) {
                const dealInvestor = await prisma.dealInvestor.findFirst({
                    where: {
                        dealId: document.dealId,
                        investorId: investor.id,
                        status: { in: ['APPROVED', 'COMPLETED'] }
                    }
                });
                isInvestorInDeal = !!dealInvestor;
            }
        }

        if (!isAdmin && !isUploader && !isSmeOwner && !isDealSmeOwner && !isInvestorInDeal) {
            return res.status(403).json({ error: 'Access denied to this document' });
        }

        // Extract key safely from URL
        const key = extractKeyFromUrl(document.url);
        const presignedUrl = await getPresignedUrl(key, 3600);

        const { sme, deal, ...documentData } = document as any;
        return res.json({
            ...documentData,
            url: presignedUrl,
            originalUrl: document.url // Keep reference if needed
        });
    } catch (error) {
        console.error('Get document error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Get presigned URL for secure document download
// Get presigned URL for secure document download
router.get('/:id/download', authorize('document.download'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId || 'default';
        const document = await prisma.document.findFirst({
            where: { id, tenantId },
            include: {
                sme: { select: { userId: true } },
                deal: { select: { sme: { select: { userId: true } } } }
            }
        });

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Same access control as GET
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
        const isUploader = document.uploadedBy === userId;
        const isSmeOwner = document.sme?.userId === userId;
        const isDealSmeOwner = document.deal?.sme?.userId === userId;

        let isInvestorInDeal = false;
        if (document.dealId && userRole === 'INVESTOR') {
            const investor = await prisma.investor.findFirst({ where: { userId } });
            if (investor) {
                const dealInvestor = await prisma.dealInvestor.findFirst({
                    where: {
                        dealId: document.dealId,
                        investorId: investor.id,
                        status: { in: ['APPROVED', 'COMPLETED'] }
                    }
                });
                isInvestorInDeal = !!dealInvestor;
            }
        }

        if (!isAdmin && !isUploader && !isSmeOwner && !isDealSmeOwner && !isInvestorInDeal) {
            return res.status(403).json({ error: 'Access denied to this document' });
        }

        // Extract S3 key from URL
        const key = extractKeyFromUrl(document.url);

        // Generate presigned URL (valid for 1 hour)
        const presignedUrl = await getPresignedUrl(key, 3600);

        return res.json({
            url: presignedUrl,
            expiresIn: 3600,
            filename: document.name
        });
    } catch (error) {
        console.error('Download document error:', error);
        return res.status(500).json({ error: 'Failed to generate download URL' });
    }
});

// Delete document
// Delete document
router.delete('/:id', authorize('document.delete'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId || 'default';
        const document = await prisma.document.findFirst({
            where: { id, tenantId }
        });

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Only uploader, SME owner, or admin can delete
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
        const isUploader = document.uploadedBy === userId;

        if (!isAdmin && !isUploader) {
            return res.status(403).json({ error: 'Only the uploader or admin can delete this document' });
        }

        // Extract key safely from URL
        const key = extractKeyFromUrl(document.url);

        // Delete from cloud storage
        await deleteFile(key);

        // Delete from database
        await prisma.document.delete({
            where: { id, tenantId }
        });

        return res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Delete document error:', error);
        return res.status(500).json({ error: 'Failed to delete document' });
    }
});

// List documents with filters
router.get('/', authorize('document.list'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { smeId, dealId, type } = req.query;

        const where: any = {
            tenantId: req.user?.tenantId || 'default'
        };

        if (smeId) where.smeId = smeId as string;
        if (dealId) where.dealId = dealId as string;
        if (type) where.type = type as string;

        const documents = await prisma.document.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                url: true,
                type: true,
                size: true,
                mimeType: true,
                createdAt: true,
                smeId: true,
                dealId: true
            }
        });

        const formatted = await Promise.all(documents.map(async (doc: any) => {
            try {
                // If the document has a URL, we need to sign it
                const key = extractKeyFromUrl(doc.url);
                const signedUrl = await getPresignedUrl(key, 3600);
                return { ...doc, url: signedUrl };
            } catch (e) {
                return doc;
            }
        }));

        return res.json(formatted);
    } catch (error) {
        console.error('List documents error:', error);
        return res.status(500).json({ error: 'Failed to list documents' });
    }
});

// Get documents by deal ID (to match frontend api.ts expectation)
router.get('/deal/:dealId', authorize('document.list'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dealId } = req.params;
        const tenantId = req.user?.tenantId || 'default';

        const documents = await prisma.document.findMany({
            where: {
                dealId,
                tenantId
            },
            orderBy: { createdAt: 'desc' }
        });

        const formatted = await Promise.all(documents.map(async (doc: any) => {
            try {
                const key = extractKeyFromUrl(doc.url);
                const signedUrl = await getPresignedUrl(key, 3600);
                return { ...doc, url: signedUrl };
            } catch (e) {
                return doc;
            }
        }));

        return res.json({ documents: formatted });
    } catch (error) {
        console.error('Get documents by deal error:', error);
        return res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

export default router;
