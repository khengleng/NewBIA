import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import axios from 'axios';
import { prisma } from '../database';

const router = Router();

/**
 * Get Bot Status & Statistics
 */
router.get('/stats', authorize('admin.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const botUrl = process.env.MOBILE_BOT_URL;
        if (!botUrl) {
            return res.status(200).json({
                status: 'NOT_CONFIGURED',
                message: 'MOBILE_BOT_URL environment variable is not set.'
            });
        }

        // Get count of linked users
        const allUsers = await prisma.user.findMany({
            select: { preferences: true }
        });
        const linkedUsersCount = allUsers.filter(u => {
            const prefs = u.preferences as any;
            return prefs && prefs.telegramChatId;
        }).length;

        // Ping the bot service for its health
        let serviceHealth = 'offline';
        try {
            const healthCheck = await axios.get(`${botUrl}/health`, { timeout: 3000 });
            if (healthCheck.data.ok) serviceHealth = 'online';
        } catch (e) {
            serviceHealth = 'unreachable';
        }

        // Get current config from Tenant settings
        const coreTenantId = process.env.CORE_TENANT_ID || 'default';
        const tenant = await prisma.tenant.findUnique({ where: { id: coreTenantId } });
        const settings: any = tenant?.settings || {};

        res.json({
            status: 'ok',
            serviceHealth,
            linkedUsersCount,
            botUsername: process.env.TELEGRAM_BOT_USERNAME || 'CamboBiaBot',
            hasCustomToken: !!settings.telegramBotToken
        });
        return;
    } catch (error) {
        console.error('Error fetching bot stats:', error);
        res.status(500).json({ error: 'Failed to fetch bot statistics' });
        return;
    }
});

/**
 * Broadcast Message to all linked Telegram users
 */
router.post('/broadcast', authorize('admin.update'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { message, title } = req.body;
        if (!message) return res.status(400).json({ error: 'Message content is required' });

        const botUrl = process.env.MOBILE_BOT_URL;
        if (!botUrl) return res.status(500).json({ error: 'Bot Service not configured' });

        // Get all users with telegramChatId
        const allUsers = await prisma.user.findMany({
            select: { id: true, preferences: true }
        });

        const linkedUsers = allUsers.filter(u => {
            const prefs = u.preferences as any;
            return prefs && prefs.telegramChatId;
        });

        if (linkedUsers.length === 0) {
            return res.json({ success: true, message: 'No linked users to broadcast to.' });
        }

        // Send broadcast request to Bot Service
        const response = await axios.post(`${botUrl}/api/internal/notify`, {
            broadcast: true,
            title: title || 'Admin Broadcast',
            message: message,
            userIds: linkedUsers.map(u => u.id)
        });

        res.json({
            success: true,
            recipients: linkedUsers.length,
            botResponse: response.data
        });
        return;
    } catch (error: any) {
        console.error('Error in bot broadcast:', error.message);
        res.status(500).json({ error: 'Broadcast failed' });
        return;
    }
});

/**
 * Update Bot Configuration
 */
router.post('/config', authorize('admin.update'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token is required' });

        const coreTenantId = process.env.CORE_TENANT_ID || 'default';
        const tenant = await prisma.tenant.findUnique({ where: { id: coreTenantId } });
        const settings: any = tenant?.settings || {};

        // Update settings with new token
        settings.telegramBotToken = token;

        await prisma.tenant.update({
            where: { id: coreTenantId },
            data: { settings }
        });

        // Notify bot service to reload if possible
        const botUrl = process.env.MOBILE_BOT_URL;
        if (botUrl) {
            try {
                await axios.post(`${botUrl}/api/internal/reload-token`, { token });
            } catch (e) {
                console.warn('Bot service could not be notified to reload immediately');
            }
        }

        res.json({ success: true, message: 'Bot token updated successfully' });
        return;
    } catch (error) {
        console.error('Error updating bot config:', error);
        res.status(500).json({ error: 'Failed to update configuration' });
        return;
    }
});

export default router;
