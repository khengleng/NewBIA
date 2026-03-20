import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set for WebSockets');
    // We don't exit here to allow the rest of the server to potentially function or log errors, 
    // but socket initialization will effectively fail verification for all clients.
}

export let io: Server;

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.warn('⚠️ [Socket] Using temporary placeholder for JWT_SECRET. Authentication will fail.');
        return 'temporary-placeholder-do-not-use-in-production';
    }
    return secret;
}

export function verifySocketAuthToken(token: string): any {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    if (decoded?.isPreAuth) {
        throw new Error('Authentication error: Two-factor authentication required');
    }

    return decoded;
}

export function initSocket(server: HttpServer) {
    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.cambobia.com';
    const tradingFrontendUrl = process.env.TRADING_FRONTEND_URL || 'https://trade.cambobia.com';
    const allowedOrigins = [
        frontendUrl,
        frontendUrl.replace(/\/$/, ''),
        'https://cambobia.com',
        'https://www.cambobia.com',
        'https://trade.cambobia.com',
        'https://trade-backend.railway.internal',
        tradingFrontendUrl,
        tradingFrontendUrl.replace(/\/$/, ''),
    ];

    if (!isProduction) {
        allowedOrigins.push(
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://localhost:3003',
            'http://localhost:3005'
        );
    }

    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                // Requests without an Origin header can still be valid for non-browser
                // clients and certain same-origin/proxy scenarios.
                if (!origin) {
                    return callback(null, true);
                }

                if (allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    console.warn('Blocked by Socket CORS:', origin);
                    callback(new Error('Not allowed by CORS'), false);
                }
            },
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    // Authentication Middleware for Sockets
    io.use((socket, next) => {
        let token = socket.handshake.auth.token;

        // If no token in auth, check cookies
        if (!token && socket.handshake.headers.cookie) {
            const cookieHeader = socket.handshake.headers.cookie;
            const match =
                cookieHeader.match(/(?:^|;\s*)tr_token=([^;]+)/) ||
                cookieHeader.match(/(?:^|;\s*)tr_accessToken=([^;]+)/) ||
                cookieHeader.match(/(?:^|;\s*)token=([^;]+)/) ||
                cookieHeader.match(/(?:^|;\s*)accessToken=([^;]+)/);
            if (match) token = match[1];
        }

        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        try {
            (socket as any).user = verifySocketAuthToken(token);
            next();
        } catch (error: any) {
            return next(new Error(error?.message || 'Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const user = (socket as any).user;
        console.log(`👤 User connected: ${user.email} (${socket.id})`);

        // Join user-specific room for targeted notifications
        socket.join(`user_${user.userId}`);

        // Join role-specific rooms
        socket.join(`role_${user.role}`);

        socket.on('disconnect', () => {
            console.log(`👤 User disconnected: ${user.email}`);
        });

        // Handle joining conversation rooms
        socket.on('join_conversation', (conversationId: string) => {
            (async () => {
                try {
                    const { prisma } = await import('./database');
                    const conversation = await (prisma as any).conversation.findUnique({
                        where: { id: conversationId },
                        include: { participants: true }
                    });

                    const inTenant = conversation?.tenantId === user.tenantId;
                    const isParticipant = !!conversation?.participants?.some((p: any) => p.userId === user.userId);
                    if (!conversation || !inTenant || !isParticipant) {
                        socket.emit('error_message', { error: 'Access denied to conversation room' });
                        return;
                    }

                    socket.join(`conversation_${conversationId}`);
                    console.log(`💬 User ${user.email} joined conversation ${conversationId}`);
                } catch (error) {
                    console.error('join_conversation auth check failed:', error);
                    socket.emit('error_message', { error: 'Failed to join conversation' });
                }
            })();
        });

        // Handle leaving conversation rooms
        socket.on('leave_conversation', (conversationId: string) => {
            socket.leave(`conversation_${conversationId}`);
        });

        // Handle sending messages
        socket.on('send_message', async (data: {
            conversationId: string;
            content: string;
            type?: string;
            attachments?: any[]
        }) => {
            try {
                // Find all participants for this conversation
                const { prisma } = await import('./database');
                const conversation = await (prisma as any).conversation.findUnique({
                    where: { id: data.conversationId },
                    include: { participants: true }
                });

                if (!conversation) return;
                const inTenant = conversation.tenantId === user.tenantId;
                const isParticipant = conversation.participants.some((p: any) => p.userId === user.userId);
                if (!inTenant || !isParticipant) {
                    socket.emit('error_message', { error: 'Access denied to conversation' });
                    return;
                }

                const messagePayload = {
                    conversationId: data.conversationId,
                    content: data.content,
                    type: data.type || 'TEXT',
                    attachments: data.attachments || [],
                    senderId: user.userId,
                    senderName: user.firstName,
                    createdAt: new Date().toISOString()
                };

                // Broadcast to all other participants in their personal rooms
                // We fetch participant details to ensure we don't send to DELETED users
                const participants = await (prisma as any).user.findMany({
                    where: {
                        id: { in: conversation.participants.map((p: any) => p.userId) },
                        status: 'ACTIVE'
                    }
                });

                participants.forEach((p: any) => {
                    if (p.id === user.userId) return; // Skip sender to avoid duplicates
                    io.to(`user_${p.id}`).emit('new_message', messagePayload);
                });

                console.log(`📡 Message broadcast to ${conversation.participants.length} participants in conversation ${data.conversationId}`);
            } catch (error) {
                console.error('Error broadcasting message:', error);
            }
        });
    });

    return io;
}

// Helper to send notifications
export function sendNotification(userId: string, notification: any) {
    if (io) {
        io.to(`user_${userId}`).emit('notification', notification);
    }
}

// Helper to broadcast system alerts
export function broadcastSystemAlert(message: string) {
    if (io) {
        io.emit('system_alert', { message, timestamp: new Date() });
    }
}
