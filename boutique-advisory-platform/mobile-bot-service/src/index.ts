import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const dbUrl = process.env.DATABASE_URL || 'postgresql://placeholder:5432/placeholder';
if (!process.env.DATABASE_URL) {
    console.error('❌ CRITICAL: DATABASE_URL is not set for Mobile Bot. Database operations will fail.');
}
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: dbUrl
        }
    }
});
const port = process.env.PORT || 3005;
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0-unspecified';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-bia';

let bot: TelegramBot;
let isTokenValid = false;

async function initializeBot(customToken?: string) {
    // 1. Try to get token from DB if not provided
    let activeToken = customToken;
    if (!activeToken) {
        try {
            const coreTenantId = process.env.CORE_TENANT_ID || 'default';
            const tenant = await prisma.tenant.findUnique({ where: { id: coreTenantId } });
            const settings: any = tenant?.settings || {};
            activeToken = settings.telegramBotToken;
        } catch (e) {
            console.error('Error fetching token from DB:', e);
        }
    }

    // 2. Fallback to Env
    if (!activeToken) {
        activeToken = process.env.TELEGRAM_BOT_TOKEN || '';
    }

    // 3. Stop old bot if exists
    if (bot) {
        try {
            await (bot as any).stopPolling();
        } catch (e) { }
    }

    const disablePolling = process.env.DISABLE_POLLING === 'true';
    isTokenValid = !!(activeToken && activeToken.includes(':'));
    
    // Safety check for Canary: Only poll if intended
    const shouldPoll = isTokenValid && !disablePolling;

    bot = new TelegramBot(activeToken, { polling: shouldPoll });

    if (shouldPoll) {
        console.log(`🤖 Telegram Bot Initialized and Polling (v${SERVICE_VERSION})`);
        setupBotHandlers(bot);
    } else if (isTokenValid) {
        console.log(`⚠️ Telegram Bot running in Webhook/Notification-only mode (v${SERVICE_VERSION})`);
    } else {
        console.warn('⚠️ No valid Telegram Token found. Running in basic API mode.');
    }
}

app.use(express.json());
app.use(cors());

// Health Check for Railway
app.get('/health', (req, res) => res.json({
    ok: true,
    version: SERVICE_VERSION,
    botInstance: isTokenValid ? (process.env.DISABLE_POLLING === 'true' ? 'notification-only' : 'polling') : 'api-only',
    hasToken: isTokenValid
}));

/**
 * Reload Token from Admin UI
 */
app.post('/api/internal/reload-token', async (req, res) => {
    const { token } = req.body;
    console.log('🔄 Received Token Reload Request');
    await initializeBot(token);
    res.json({ success: true, status: isTokenValid ? 'online' : 'invalid_token' });
});

function setupBotHandlers(botInstance: TelegramBot) {
    botInstance.onText(/\/start ?(.*)/, async (msg, match) => handleStart(msg, match, botInstance));
    botInstance.onText(/\/portfolio/, async (msg) => handlePortfolio(msg, botInstance));
    botInstance.onText(/\/deals/, async (msg) => handleDeals(msg, botInstance));
    botInstance.onText(/\/link/, async (msg) => {
        botInstance.sendMessage(msg.chat.id, "🔗 *To link your account:*\n\nPlease log in to the BIA Web Portal and go to *Settings > Telegram* to generate a secure linking link.", { parse_mode: 'Markdown' });
    });
}

// ==================== BOT HANDLER LOGIC ====================

async function handleStart(msg: any, match: any, botInstance: TelegramBot) {
    const chatId = msg.chat.id;
    const startToken = match?.[1];

    if (startToken) {
        try {
            const decoded = jwt.verify(startToken, JWT_SECRET) as { userId: string, email: string };
            const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

            if (user) {
                const existingPrefs: any = user.preferences;
                const prefs = typeof existingPrefs === 'object' && existingPrefs !== null
                    ? { ...existingPrefs }
                    : {};
                prefs.telegramChatId = String(chatId);

                await prisma.user.update({
                    where: { id: user.id },
                    data: { preferences: prefs }
                });

                botInstance.sendMessage(chatId, `✅ *Account Linked Successfully!*\n\nWelcome, *${user.firstName}*! Your Telegram is now connected to ${decoded.email}.\n\nTry /portfolio to see your investments.`, { parse_mode: 'Markdown' });
                return;
            }
        } catch (e) {
            botInstance.sendMessage(chatId, "⚠️ *Invalid or expired link.*\nPlease generate a new link from the BIA Web Platform.", { parse_mode: 'Markdown' });
            return;
        }
    }

    botInstance.sendMessage(chatId, `
🚀 *Welcome to CamboBia Trading Bot* 🇰🇭

The official companion for the Boutique Advisory Platform.

*Available Commands:*
📊 /deals - Top investment opportunities
📈 /market - Secondary market statistics
💼 /portfolio - Your active holdings
👤 /link - Connect your platform account
    `, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "Open Web Platform", url: "https://trade.cambobia.com" }],
                [{ text: "Help & Support", callback_data: "help" }]
            ]
        }
    });
}

async function handlePortfolio(msg: any, botInstance: TelegramBot) {
    const chatId = msg.chat.id;
    const users = await prisma.user.findMany({
        where: { preferences: { path: ['telegramChatId'], equals: String(chatId) } }
    });

    if (users.length === 0) {
        botInstance.sendMessage(chatId, "❌ *Account not linked.*\nUse /link to connect your BIA account first.", { parse_mode: 'Markdown' });
        return;
    }

    const user = users[0];
    const investor = await prisma.investor.findUnique({
        where: { userId: user.id },
        include: { dealInvestments: { include: { deal: true } } }
    });

    if (!investor || investor.dealInvestments.length === 0) {
        botInstance.sendMessage(chatId, `💼 *Portfolio Overview (${user.firstName})*\n\nNo active investments found yet.`, { parse_mode: 'Markdown' });
        return;
    }

    let summary = `💼 *Portfolio for ${user.firstName}*\n\n`;
    let totalInv = 0;
    investor.dealInvestments.forEach(inv => {
        summary += `🔹 *${inv.deal.title}*\n   Allocation: $${inv.amount.toLocaleString()}\n   Status: ${inv.status}\n\n`;
        totalInv += inv.amount;
    });

    summary += `💰 *Total Portfolio Value: $${totalInv.toLocaleString()}*`;
    botInstance.sendMessage(chatId, summary, { parse_mode: 'Markdown' });
}

async function handleDeals(msg: any, botInstance: TelegramBot) {
    const chatId = msg.chat.id;
    try {
        const deals = await prisma.deal.findMany({ where: { status: 'PUBLISHED' }, take: 5, include: { sme: true } });
        if (deals.length === 0) {
            botInstance.sendMessage(chatId, "📭 No active deals currently available.");
            return;
        }
        let response = "🔥 *Featured Deals:*\n\n";
        deals.forEach((d, idx) => {
            const smeName = (d as any).sme?.name || 'SME';
            response += `${idx + 1}. *${d.title}*\n🏢 SME: ${smeName}\n💰 Amount: $${d.amount.toLocaleString()}\n━━━━━━━━━━━━━━━\n`;
        });
        botInstance.sendMessage(chatId, response, { parse_mode: 'Markdown' });
    } catch (e) {
        botInstance.sendMessage(chatId, "⚠️ Error fetching deals.");
    }
}

// ==================== MOBILE API ENDPOINTS ====================

app.post('/api/mobile/register-push', async (req, res) => {
    try {
        const { userId, fcmToken, deviceType } = req.body;
        if (!userId || !fcmToken) return res.status(400).json({ error: 'Missing userId or fcmToken' });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const existingPrefs: any = user.preferences || {};
        const prefs = {
            ...existingPrefs,
            mobilePushToken: fcmToken,
            deviceType: deviceType || 'unknown',
            pushEnabled: true
        };

        await prisma.user.update({
            where: { id: userId },
            data: { preferences: prefs }
        });

        res.json({ success: true, message: 'Push token registered' });
    } catch (e) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/internal/notify', async (req, res) => {
    try {
        const { userId, userIds, broadcast, title, message } = req.body;
        const targetUserIds = broadcast ? (userIds || []) : [userId];

        for (const id of targetUserIds) {
            if (!id) continue;
            const user = await prisma.user.findUnique({ where: { id } });
            if (!user) continue;

            const prefs: any = user.preferences || {};

            if (prefs.telegramChatId && isTokenValid && bot) {
                try {
                    await bot.sendMessage(prefs.telegramChatId, `🔔 *${title}*\n\n${message}`, { parse_mode: 'Markdown' });
                } catch (e) {
                    console.error(`[Bot] Failed to send to ${id}:`, e);
                }
            }
        }
        res.json({ success: true, processed: targetUserIds.length });
    } catch (e) {
        res.status(500).json({ error: 'Notification failed' });
    }
});

const server = app.listen(port, async () => {
    console.log(`✅ Mobile Bot Service (v${SERVICE_VERSION}) listening on port ${port}`);
    await initializeBot();
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    
    if (bot) {
        try {
            console.log('Stopping Telegram polling...');
            await bot.stopPolling();
        } catch (e) {
            console.error('Error stopping bot:', e);
        }
    }

    server.close(async () => {
        console.log('HTTP server closed.');
        await prisma.$disconnect();
        console.log('Database disconnected.');
        process.exit(0);
    });

    // Forced exit after 10s
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
