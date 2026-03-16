import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import jwt from 'jsonwebtoken';
import { prisma } from '../database';
import axios from 'axios';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-bia';

/**
 * Generate a temporary linking token for Telegram Bot
 */
router.post('/bot/link-token', authorize('profile.update'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

        const token = jwt.sign(
            {
                userId: req.user.id,
                email: req.user.email
            },
            JWT_SECRET,
            { expiresIn: '10m' }
        );

        const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'CamboBiaBot';
        const deepLink = `https://t.me/${botUsername}?start=${token}`;

        res.json({
            token,
            deepLink,
            expiresIn: 600
        });
        return;
    } catch (error) {
        console.error('Error generating bot link token:', error);
        res.status(500).json({ error: 'Failed to generate linking token' });
        return;
    }
});

/**
 * Unlink Telegram
 */
router.post('/bot/unlink', authorize('profile.update'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) {
            const prefs = typeof user.preferences === 'object' ? (user.preferences as any) : {};
            delete prefs.telegramChatId;

            await prisma.user.update({
                where: { id: user.id },
                data: { preferences: prefs }
            });
        }

        res.json({ success: true, message: 'Telegram unlinked' });
        return;
    } catch (error) {
        res.status(500).json({ error: 'Failed to unlink Telegram' });
        return;
    }
});

/**
 * Proxy Push Registration to Mobile Bot Service
 */
router.post('/register-push', authorize('profile.update'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const botUrl = process.env.MOBILE_BOT_URL;
        if (!botUrl) {
            console.warn('⚠️ MOBILE_BOT_URL not set, skipping remote registration');
            return res.status(200).json({ success: true, message: 'Mock registration (URL not set)' });
        }

        const response = await axios.post(`${botUrl}/api/mobile/register-push`, req.body);
        res.status(response.status).json(response.data);
        return;
    } catch (error: any) {
        console.error('Error proxying push registration:', error.message);
        res.status(error.response?.status || 500).json({ error: 'Push registration proxy failed' });
        return;
    }
});

export default router;
