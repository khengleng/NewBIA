import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/jwt-auth';
import { prisma } from '../database';
import { upload } from '../middleware/upload';
import { uploadFile } from '../utils/fileUpload';

const router = Router();

// Start a conversation (Idempotent)
router.post('/start', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { recipientId, initialMessage, dealId } = req.body;
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId || 'default';

        if (!userId || !recipientId) {
            return res.status(400).json({ error: 'Recipient ID is required' });
        }

        // Verify recipient is ACTIVE
        const recipient = await prisma.user.findFirst({ where: { id: recipientId, tenantId } });
        if (!recipient || recipient.status !== 'ACTIVE') {
            return res.status(404).json({ error: 'Recipient not found or account is inactive' });
        }



        // Check if conversation already exists between these two within the same tenant.
        const existingConv = await (prisma as any).conversation.findFirst({
            where: {
                tenantId,
                AND: [
                    { participants: { some: { userId: userId } } },
                    { participants: { some: { userId: recipientId } } }
                ]
            },
            include: {
                participants: {
                    include: { user: true }
                }
            }
        });

        if (existingConv) {

            // specific logic: if initialMessage provided, send it
            if (initialMessage) {
                await (prisma as any).message.create({
                    data: {
                        conversationId: existingConv.id,
                        senderId: userId,
                        content: initialMessage,
                        read: false
                    }
                });
            }
            return res.json(existingConv);
        }

        // Create new conversation

        const newConv = await (prisma as any).conversation.create({
            data: {
                tenantId,
                dealId: dealId || undefined,
                participants: {
                    create: [
                        { userId: userId },
                        { userId: recipientId }
                    ]
                }
            },
            include: {
                participants: {
                    include: { user: true }
                }
            }
        });

        // Send initial message if provided
        if (initialMessage) {
            await (prisma as any).message.create({
                data: {
                    conversationId: newConv.id,
                    senderId: userId,
                    content: initialMessage,
                    read: false
                }
            });
        }

        return res.status(201).json(newConv);
    } catch (error) {
        console.error('Error starting conversation:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Get conversations for current user
router.get('/conversations', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant context required' });
        }

        const conversations = await (prisma as any).conversation.findMany({
            where: {
                tenantId,
                participants: {
                    some: { userId }
                }
            },
            include: {
                participants: {
                    include: {
                        user: {
                            select: { id: true, firstName: true, lastName: true, role: true, email: true }
                        }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Format for frontend
        const formatted = conversations.map((c: any) => {
            const lastMsg = c.messages[0];

            // Basic mock of "participantDetails" structure expected by frontend
            const participantDetails = c.participants.map((p: any) => ({
                id: p.userId,
                name: `${p.user.firstName} ${p.user.lastName}`,
                type: p.user.role
            }));

            return {
                id: c.id,
                participants: c.participants.map((p: any) => p.userId),
                participantDetails,
                dealId: c.dealId,
                lastMessage: lastMsg ? lastMsg.content : '',
                lastMessageAt: lastMsg ? lastMsg.createdAt : c.createdAt,
                unreadCount: { [userId || '']: 0 },
                createdAt: c.createdAt
            };
        });

        return res.json(formatted);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload message attachment
router.post('/upload', upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const uploadedFile = await uploadFile(req.file, 'messages');

        // Generate signed URL immediately for private buckets
        const { getPresignedUrl } = await import('../utils/fileUpload');
        const signedUrl = await getPresignedUrl(uploadedFile.key, 3600);

        return res.json({
            name: req.file.originalname,
            url: signedUrl,
            key: uploadedFile.key, // Return key for database storage
            type: req.file.mimetype,
            size: req.file.size
        });
    } catch (error: any) {
        console.error('Error uploading message file:', error);
        return res.status(500).json({
            error: 'Upload failed',
            details: error.message || 'Unknown error during file upload',
            code: 'UPLOAD_ERROR'
        });
    }
});

// Get messages for a specific conversation
router.get('/conversations/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant context required' });
        }

        // Verify participation
        const conversation = await (prisma as any).conversation.findUnique({
            where: { id },
            include: {
                participants: true
            }
        });

        if (!conversation || conversation.tenantId !== tenantId || !conversation.participants.some((p: any) => p.userId === userId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const messages = await (prisma as any).message.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: 'asc' },
            include: {
                sender: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                }
            }
        });

        const { getPresignedUrl, extractKeyFromUrl } = await import('../utils/fileUpload');

        const formatted = await Promise.all(messages.map(async (m: any) => {
            let attachments = m.attachments;

            // If we have attachments, generate presigned URLs for private storage
            if (Array.isArray(attachments) && attachments.length > 0) {
                attachments = await Promise.all(attachments.map(async (attr: any) => {
                    if (attr.url && (attr.url.includes('storage.googleapis.com') || attr.url.includes('s3'))) {
                        try {
                            // Prefer using the stored key, fallback to safe extraction from URL
                            const key = attr.key || extractKeyFromUrl(attr.url);
                            const signedUrl = await getPresignedUrl(key, 3600);
                            return { ...attr, url: signedUrl };
                        } catch (e) {
                            return attr;
                        }
                    }
                    return attr;
                }));
            }

            return {
                id: m.id,
                conversationId: m.conversationId,
                senderId: m.senderId,
                senderName: `${m.sender.firstName} ${m.sender.lastName}`,
                senderType: m.sender.role,
                content: m.content,
                type: m.type,
                attachments,
                read: m.read,
                createdAt: m.createdAt
            };
        }));

        return res.json({ messages: formatted });
    } catch (error) {
        console.error('Error fetching messages:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Send a message
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { conversationId, content, type, attachments } = req.body;
        const userId = req.user?.id;
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
            return res.status(403).json({ error: 'Tenant context required' });
        }

        // Verify participation first
        const conversation = await (prisma as any).conversation.findUnique({
            where: { id: conversationId },
            include: { participants: true }
        });

        if (!conversation || conversation.tenantId !== tenantId || !conversation.participants.some((p: any) => p.userId === userId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const newMessage = await (prisma as any).message.create({
            data: {
                conversationId,
                senderId: userId,
                content: content || '',
                type: type || 'TEXT',
                attachments: attachments || undefined,
                read: false
            },
            include: {
                sender: true
            }
        });

        // Update conversation timestamp
        await (prisma as any).conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() }
        });

        return res.json({
            id: newMessage.id,
            conversationId: newMessage.conversationId,
            senderId: newMessage.senderId,
            senderName: `${newMessage.sender.firstName} ${newMessage.sender.lastName}`,
            senderType: newMessage.sender.role,
            content: newMessage.content,
            type: newMessage.type,
            attachments: newMessage.attachments,
            read: newMessage.read,
            createdAt: newMessage.createdAt
        });
    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
