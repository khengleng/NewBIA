/**
 * Notifications Routes
 * 
 * Provides user notifications functionality and Web Push integration
 */

import { Router, Request, Response } from 'express';
import { prisma, prismaReplica } from '../database';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { shouldUseDatabase } from '../migration-manager';
import { NotificationType } from '@prisma/client';
import webpush from 'web-push';

const router = Router();

// Configure Web Push
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const isWebPushConfigured = Boolean(publicVapidKey && privateVapidKey);

// Email for VAPID contact
const vapidEmail = 'mailto:contact@cambobia.com';

try {
    if (isWebPushConfigured) {
        webpush.setVapidDetails(
            vapidEmail,
            publicVapidKey!,
            privateVapidKey!
        );
    }
} catch (error) {
    console.error('❌ Failed to initialize Web Push:', error);
}

// Helper to send push notification
async function sendPushToUser(userId: string, title: string, body: string, url?: string) {
    if (!shouldUseDatabase()) return;
    if (!isWebPushConfigured) return;

    try {
        // Get user subscriptions
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId }
        });

        if (subscriptions.length === 0) return;

        const payload = JSON.stringify({
            title,
            body,
            url,
            icon: '/icons/icon-192x192.png'
        });

        // Send to all user devices
        const promises = subscriptions.map(async (sub) => {
            try {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: sub.keys as any
                };
                await webpush.sendNotification(pushSubscription, payload);
            } catch (error: any) {
                // If 410 Gone or 404, remove subscription
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await prisma.pushSubscription.delete({
                        where: { id: sub.id }
                    });
                } else {
                    console.error('Error sending push to device:', error);
                }
            }
        });

        await Promise.all(promises);
    } catch (error) {
        console.error('Error in sendPushToUser:', error);
    }
}

// Create notification (Admin/Advisor only)
router.post('/', authorize('notification.broadcast'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { userId, type, title, message, actionUrl } = req.body;

        if (!shouldUseDatabase()) {
            const newNotification = {
                id: `notif_${Date.now()}`,
                userId,
                type: type || 'SYSTEM',
                title,
                message,
                read: false,
                actionUrl: actionUrl || null,
                createdAt: new Date().toISOString()
            };
            res.status(201).json(newNotification);
            return;
        }

        // Validate notification type
        let notifType: NotificationType = NotificationType.SYSTEM;
        if (type && Object.values(NotificationType).includes(type as NotificationType)) {
            notifType = type as NotificationType;
        }

        const { getTenantId } = await import('../utils/tenant-utils');
        const tenantId = getTenantId(req);

        const notification = await prisma.notification.create({
            data: {
                tenantId: tenantId,
                userId, // Target user
                type: notifType,
                title,
                message,
                actionUrl: actionUrl || null,
            }
        });

        // Trigger Web Push in background
        sendPushToUser(userId, title, message, actionUrl).catch(err =>
            console.error('Failed to send push for new notification:', err)
        );

        res.status(201).json(notification);
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

// Get user notifications
router.get('/', authorize('notification.list'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    console.log(`[Notifications] GET request received for user: ${req.user?.id}`);
    try {
        if (!shouldUseDatabase()) {
            // For now, return sample notifications
            const notifications = [
                {
                    id: 'notif_1',
                    type: 'info',
                    title: 'Welcome to Boutique Advisory',
                    message: 'Start exploring investment opportunities and connect with SMEs.',
                    read: false,
                    createdAt: new Date().toISOString()
                }
            ];

            res.json({
                notifications,
                unreadCount: 1
            });
            return;
        }

        const { getTenantId } = await import('../utils/tenant-utils');
        const tenantId = getTenantId(req);

        // Use Replica for reading notifications (High traffic endpoint)
        const notifications = await prismaReplica.notification.findMany({
            where: {
                userId: req.user?.id,
                tenantId: tenantId
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 50 // Limit to recent 50
        });

        const unreadCount = await prismaReplica.notification.count({
            where: {
                userId: req.user?.id,
                tenantId: tenantId,
                read: false
            }
        });

        res.json({
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark notification as read
router.put('/:id/read', authorize('notification.update', {
    getOwnerId: async (req) => req.user?.id
}), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.json({ success: true, message: 'Notification marked as read (mock)' });
            return;
        }

        const notificationId = req.params.id;

        // Use Primary for write update
        await prisma.notification.update({
            where: {
                id: notificationId,
                userId: req.user?.id // Security: ensure user owns notification
            },
            data: {
                read: true
            }
        });

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// Mark all as read
router.put('/read-all', authorize('notification.update', {
    getOwnerId: async (req) => req.user?.id
}), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.json({ success: true, message: 'All notifications marked as read (mock)' });
            return;
        }

        // Use Primary for batch update
        await prisma.notification.updateMany({
            where: {
                userId: req.user?.id,
                tenantId: req.user?.tenantId || 'default',
                read: false
            },
            data: {
                read: true
            }
        });

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
});

// Web Push Subscription
router.post('/subscribe', authorize('notification.read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const subscription = req.body;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            res.status(400).json({ error: 'Invalid subscription object' });
            return;
        }



        if (shouldUseDatabase() && req.user) {
            // Upsert subscription (update keys if endpoint exists for user)
            await prisma.pushSubscription.upsert({
                where: {
                    userId_endpoint: {
                        userId: req.user.id,
                        endpoint: subscription.endpoint
                    }
                },
                update: {
                    keys: subscription.keys,
                    updatedAt: new Date()
                },
                create: {
                    tenantId: req.user.tenantId || 'default',
                    userId: req.user.id,
                    endpoint: subscription.endpoint,
                    keys: subscription.keys
                }
            });

        }

        res.status(201).json({ message: 'Push subscription successful' });
    } catch (error) {
        console.error('Error subscribing to push:', error);
        res.status(500).json({ error: 'Failed to subscribe to push notifications' });
    }
});

// Web Push Unsubscribe
router.post('/unsubscribe', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            res.status(400).json({ error: 'Endpoint required' });
            return;
        }



        if (shouldUseDatabase() && req.user) {
            await prisma.pushSubscription.deleteMany({
                where: {
                    userId: req.user.id,
                    endpoint: endpoint
                }
            });

        }

        res.json({ message: 'Push unsubscribe successful' });
    } catch (error) {
        console.error('Error unsubscribing from push:', error);
        res.status(500).json({ error: 'Failed to unsubscribe' });
    }
});

// Send Test Notification (Self)
router.post('/test', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const title = 'Test Notification';
        const message = 'This is a test message sent at ' + new Date().toLocaleTimeString();

        await sendPushToUser(req.user.id, title, message);

        res.json({ message: 'Test notification queued' });
    } catch (error) {
        console.error('Error sending test push:', error);
        res.status(500).json({ error: 'Failed to send test push' });
    }
});

export default router;
