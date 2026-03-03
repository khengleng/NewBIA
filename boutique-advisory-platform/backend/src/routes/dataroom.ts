import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma } from '../database';
import { upload } from '../middleware/upload';
import { uploadFile, deleteFile, getPresignedUrl, extractKeyFromUrl } from '../utils/fileUpload';

const router = Router();

// Get datarooms (grouped by deal)
router.get('/', authorize('dataroom.list'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = userRole === 'SUPER_ADMIN';
        const isAdmin = userRole === 'ADMIN';

        // Get deals with documents
        const deals = await (prisma as any).deal.findMany({
            where: isSuperAdmin
                ? {}
                : (isAdmin
                    ? { tenantId }
                    : {
                        tenantId,
                        OR: [
                            { sme: { userId } }, // User owns the SME
                            { investors: { some: { investor: { userId } } } } // User is investor
                        ]
                    }),
            include: {
                documents: true,
                sme: true,
                investors: {
                    include: {
                        investor: true
                    }
                }
            }
        });

        // Group by deal the datarooms
        const formattedDatarooms = await Promise.all(deals.map(async (deal: any) => {
            // Check if user is investor in this deal
            const isInvestor = deal.investors.some((inv: any) => inv.investor.userId === userId);
            const isOwner = deal.sme.userId === userId;
            const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

            if (!isInvestor && !isOwner && !isAdmin) return null;

            // Group documents by base name to show versions
            const docsByName = new Map<string, any[]>();
            deal.documents.forEach((doc: any) => {
                const key = doc.name;
                if (!docsByName.has(key)) docsByName.set(key, []);
                docsByName.get(key)!.push(doc);
            });

            const documents = await Promise.all(Array.from(docsByName.entries()).map(async ([name, versions]) => {
                versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                const latest = versions[0];

                // Sign latest URL safely
                let signedUrl = latest.url;
                try {
                    const key = extractKeyFromUrl(latest.url);
                    signedUrl = await getPresignedUrl(key, 3600);
                } catch (e) {
                    console.warn(`[GCS] Failed to sign dataroom URL: ${latest.url}`);
                }

                return {
                    id: latest.id,
                    name: latest.name,
                    category: latest.type,
                    size: `${(latest.size / 1024 / 1024).toFixed(2)} MB`,
                    uploadedBy: latest.uploadedBy,
                    uploadedAt: latest.createdAt.toISOString(),
                    accessCount: 0,
                    lastAccessedBy: null,
                    lastAccessedAt: null,
                    versions: versions.length,
                    url: signedUrl
                };
            }));

            return {
                id: deal.id,
                dealName: deal.title,
                smeName: deal.sme.companyName,
                documentCount: documents.length,
                lastUpdate: deal.updatedAt.toISOString(),
                status: deal.status,
                documents
            };
        }));

        return res.json(formattedDatarooms.filter(d => d !== null));
    } catch (error: any) {
        console.error('List dataroom error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Upload document to dataroom
router.post('/upload', authorize('dataroom.upload', {
    getOwnerId: async (req) => {
        const userRole = req.user?.role;
        if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
            return req.user?.id;
        }

        const dealId = String(req.body?.dealId || '');
        if (!dealId) return undefined;
        const tenantId = req.user?.tenantId || 'default';
        const deal = await (prisma as any).deal.findFirst({
            where: { id: dealId, tenantId },
            include: { sme: { select: { userId: true } } }
        });
        return deal?.sme?.userId;
    }
}), upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dealId, name, type } = req.body;
        const file = req.file;
        const userRole = req.user?.role;
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = userRole === 'SUPER_ADMIN';
        const isAdmin = userRole === 'ADMIN';

        if (!file || !dealId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify access to deal
        const deal = await (prisma as any).deal.findFirst({
            where: isSuperAdmin ? { id: dealId } : { id: dealId, tenantId },
            include: { sme: true }
        });

        if (!deal) return res.status(404).json({ error: 'Deal not found' });
        const canUpload = isSuperAdmin || isAdmin || userRole === 'ADVISOR' || deal.sme.userId === req.user?.id;
        if (!canUpload) {
            return res.status(403).json({ error: 'Unauthorized to upload to this dataroom' });
        }

        // Upload to folder: deal/{id}/dataroom
        const uploadResult = await uploadFile(file, `deal/${dealId}/dataroom`);

        // Create document entry
        const document = await (prisma as any).document.create({
            data: {
                tenantId: deal.tenantId,
                name: name || file.originalname,
                type: type || 'OTHER',
                url: uploadResult.url,
                size: uploadResult.size,
                mimeType: file.mimetype,
                dealId: dealId,
                uploadedBy: req.user!.id
            }
        });

        // Sign the URL immediately for the response
        const key = extractKeyFromUrl(document.url);
        const signedUrl = await getPresignedUrl(key, 3600);

        return res.status(201).json({
            ...document,
            url: signedUrl,
            message: 'File added to dataroom'
        });
    } catch (error: any) {
        console.error('Dataroom upload error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Get single dataroom details
router.get('/:dealId', authorize('dataroom.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { dealId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = userRole === 'SUPER_ADMIN';

        const deal = await (prisma as any).deal.findFirst({
            where: isSuperAdmin ? { id: dealId } : { id: dealId, tenantId },
            include: {
                documents: true,
                sme: true,
                investors: {
                    include: {
                        investor: true
                    }
                }
            }
        });

        if (!deal) return res.status(404).json({ error: 'Data room not found' });

        // Verify access
        const isInvestor = deal.investors.some((inv: any) => inv.investor.userId === userId);
        const isOwner = deal.sme.userId === userId;
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

        if (!isInvestor && !isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Access denied to this data room' });
        }

        // Group documents by name to handle versioning
        const docsByName = new Map<string, any[]>();
        deal.documents.forEach((doc: any) => {
            const key = doc.name;
            if (!docsByName.has(key)) docsByName.set(key, []);
            docsByName.get(key)!.push(doc);
        });

        const documents = await Promise.all(Array.from(docsByName.entries()).map(async ([name, versions]) => {
            // Sort by date newest first
            versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const latest = versions[0];

            // Sign URLs for all versions safely
            const previousVersions = await Promise.all(versions.slice(1).map(async (v) => {
                // Sign version URL
                let vSignedUrl = v.url;
                try {
                    const vKey = extractKeyFromUrl(v.url);
                    vSignedUrl = await getPresignedUrl(vKey, 3600);
                } catch (vError) {
                    console.warn(`[GCS] Failed to sign version URL: ${v.url}`);
                }

                return {
                    id: v.id,
                    version: 'Previous',
                    uploadedBy: v.uploadedBy,
                    uploadedAt: v.createdAt.toISOString(),
                    size: `${(v.size / 1024 / 1024).toFixed(2)} MB`,
                    url: vSignedUrl
                };
            }));

            // Sign latest URL safely
            let latestSignedUrl = latest.url;
            try {
                const lKey = extractKeyFromUrl(latest.url);
                latestSignedUrl = await getPresignedUrl(lKey, 3600);
            } catch (lError) {
                console.warn(`[GCS] Failed to sign latest URL: ${latest.url}`);
            }

            return {
                id: latest.id,
                name: latest.name,
                category: latest.type,
                size: `${(latest.size / 1024 / 1024).toFixed(2)} MB`,
                uploadedBy: latest.uploadedBy,
                uploadedAt: latest.createdAt.toISOString(),
                versions: previousVersions,
                url: latestSignedUrl,
                status: 'current'
            };
        }));

        return res.json({
            id: deal.id,
            name: deal.title,
            sme: deal.sme.companyName,
            documents
        });
    } catch (error: any) {
        console.error('Get dataroom error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Delete document from dataroom
router.delete('/:documentId', authorize('dataroom.delete', {
    getOwnerId: async (req) => {
        const userRole = req.user?.role;
        if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
            return req.user?.id;
        }

        const documentId = String(req.params?.documentId || '');
        if (!documentId) return undefined;
        const tenantId = req.user?.tenantId || 'default';
        const doc = await (prisma as any).document.findUnique({
            where: { id: documentId },
            include: { deal: { include: { sme: { select: { userId: true } } } } }
        });
        if (!doc || doc.tenantId !== tenantId) return undefined;
        return doc?.deal?.sme?.userId;
    }
}), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { documentId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = userRole === 'SUPER_ADMIN';

        const document = await (prisma as any).document.findFirst({
            where: isSuperAdmin
                ? { id: documentId }
                : { id: documentId, tenantId },
            include: { deal: { include: { sme: true } } }
        });

        if (!document) return res.status(404).json({ error: 'Document not found' });
        if (!document.deal) return res.status(400).json({ error: 'Document is not part of a dataroom deal' });

        // Verify ownership/admin
        const isOwner = document.deal.sme.userId === userId;
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Unauthorized to delete from this data room' });
        }

        // Delete from GCS
        try {
            const key = extractKeyFromUrl(document.url);
            await deleteFile(key);
        } catch (e) {
            console.warn('Failed to delete file from cloud storage:', e);
        }

        // Delete from database
        await (prisma as any).document.delete({
            where: { id: documentId }
        });

        return res.json({ message: 'Document deleted from data room' });
    } catch (error: any) {
        console.error('Delete dataroom file error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

export default router;
