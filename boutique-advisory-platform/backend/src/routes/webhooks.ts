import { Router, Request, Response } from 'express';
import { prisma } from '../database';
import * as crypto from 'crypto';
import { KYCStatus } from '@prisma/client';
import { settleSecondaryTrade } from '../services/secondary-trade-settlement';

const router = Router();

// Sumsub Webhook Handler (Public)
router.post('/sumsub', async (req: Request, res: Response) => {
    try {
        const signature = req.headers['x-payload-digest'];
        const algo = req.headers['x-payload-digest-alg']; // usually 'HMAC_SHA256_HEX'
        const body = req.body;
        const secret = process.env.SUMSUB_SECRET_KEY;

        // Log webhook receipt in production only if debugging needed, but for now just silence or minimize
        // console.log('[WEBHOOK] Sumsub received');

        if (!secret) {
            console.error('❌ Sumsub secret key missing in backend env');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // 1. Verify Signature
        if (!signature || typeof signature !== 'string') {
            console.warn('⚠️ Missing or invalid Sumsub signature header');
            return res.status(401).json({ error: 'Unauthorized: Missing signature' });
        }

        const calculatedSignature = crypto
            .createHmac('sha256', secret)
            .update(req.rawBody || JSON.stringify(body))
            .digest('hex');

        if (!req.rawBody) {
            console.warn('⚠️ Sumsub webhook: rawBody not found, falling back to JSON.stringify (unsafe)');
        }

        // Note: For robust implementation in Express, we should ideally use the raw request body. 
        // If this fails, we may need to adjust app.ts to capture rawBody.

        // Let's assume for this "improvement" task we just implement the logic, but if we can't get raw body easily here without changing app.ts, 
        // we might have issues. However, `JSON.stringify` is a common approximation if the robust raw body isn't available.
        // Let's stick to the structure but acknowledge the raw body constraint.

        // Actually, to be safe without changing app.ts (which I can't seeing right now), let's implement it but log if mismatch.
        // But preventing the "Unauthorized" return if we aren't 100% sure about raw body might be safer for a 'fix', 
        // yet technically we SHOULD return 401. I'll implement the check.

        // Wait, I should import crypto if it's not imported. it is not imported in webhooks.ts

        // ... proceeding with logic ...

        // Security: Use timingSafeEqual to prevent timing attacks
        const digest = Buffer.from(signature, 'utf8');
        const checksum = Buffer.from(calculatedSignature, 'utf8');

        if (digest.length !== checksum.length || !crypto.timingSafeEqual(digest, checksum)) {
            console.warn('⚠️ Invalid Sumsub signature. Calculated:', calculatedSignature, 'Received:', signature);
            // UNCOMMENT TO ENFORCE: 
            return res.status(401).json({ error: 'Unauthorized: Invalid signature' });
        }

        const { externalUserId, type, reviewStatus, reviewResult } = body;

        if (type === 'applicantStatusChanged') {
            let kycStatus: KYCStatus = KYCStatus.PENDING;

            if (reviewStatus === 'completed') {
                if (reviewResult?.reviewAnswer === 'GREEN') {
                    kycStatus = KYCStatus.VERIFIED;
                } else if (reviewResult?.reviewAnswer === 'RED') {
                    kycStatus = KYCStatus.REJECTED;
                }
            } else if (reviewStatus === 'pending') {
                kycStatus = KYCStatus.UNDER_REVIEW;
            }

            // console.log(`[WEBHOOK] Updating KYC status for ${externalUserId} to ${kycStatus}`);

            // externalUserId is our userId
            await prisma.investor.update({
                where: { userId: externalUserId },
                data: { kycStatus }
            });
        }

        return res.json({ ok: true });
    } catch (error) {
        console.error('Sumsub Webhook Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ABA PayWay Callback (Public)
router.post('/aba', async (req: Request, res: Response) => {
    try {
        const { tran_id, status, hash } = req.body;
        // console.log('[WEBHOOK] ABA Callback received', req.body.tran_id);

        // SECURITY: Verify ABA Hash to prevent forged payment successes
        const { verifyAbaCallback } = require('../utils/aba');
        if (!verifyAbaCallback(req.body)) {
            console.warn('⚠️ Rejected unverified ABA callback for transaction:', tran_id);
            return res.status(401).json({ status: 1, description: 'Invalid hash' });
        }

        // Status "0" usually means success in ABA PayWay
        const paymentStatus = status === '0' ? 'COMPLETED' : 'FAILED';

        // Using any cast to avoid TS errors if model update isn't refreshed in IDE
        const db = prisma as any;

        // Find by providerTxId/provider and reject ambiguous matches.
        const matchingPayments = await db.payment.findMany({
            where: { provider: 'ABA', providerTxId: tran_id },
            orderBy: { createdAt: 'desc' },
            take: 2
        });

        if (matchingPayments.length > 1) {
            console.error('❌ Ambiguous ABA callback: multiple payments found for providerTxId', tran_id);
            return res.status(409).json({ status: 1, description: 'Ambiguous transaction reference' });
        }

        const payment = matchingPayments[0];

        if (payment) {
            // Idempotency: do not re-apply terminal updates.
            const mutableStatuses = new Set(['PENDING', 'PROCESSING']);
            if (!mutableStatuses.has(payment.status)) {
                // console.log(`[WEBHOOK] Ignoring ABA callback for terminal payment ${payment.id} (status=${payment.status})`);
                return res.json({ status: 0, description: 'Already processed' });
            }

            await db.payment.update({
                where: { id: payment.id }, // Update by internal UUID
                data: {
                    status: paymentStatus,
                    metadata: {
                        ...(payment.metadata || {}),
                        abaCallback: req.body,
                        lastCallbackAt: new Date().toISOString()
                    }
                }
            });

            if (paymentStatus === 'COMPLETED') {
                if (payment.bookingId) {
                    const booking = await db.booking.findFirst({
                        where: { id: payment.bookingId, tenantId: payment.tenantId },
                        select: { id: true }
                    });
                    if (booking) {
                        await db.booking.update({
                            where: { id: booking.id },
                            data: { status: 'CONFIRMED' }
                        });
                    } else {
                        console.warn(`⚠️ Booking ${payment.bookingId} not found in tenant ${payment.tenantId}`);
                    }
                }
                if (payment.dealInvestorId) {
                    const dealInvestor = await db.dealInvestor.findFirst({
                        where: { id: payment.dealInvestorId, deal: { tenantId: payment.tenantId } },
                        select: { id: true }
                    });
                    if (dealInvestor) {
                        await db.dealInvestor.update({
                            where: { id: dealInvestor.id },
                            data: { status: 'COMPLETED' }
                        });
                    } else {
                        console.warn(`⚠️ DealInvestor ${payment.dealInvestorId} not found in tenant ${payment.tenantId}`);
                    }
                }

                const metadata = (payment.metadata || {}) as Record<string, unknown>;
                const secondaryTradeId = typeof metadata.secondaryTradeId === 'string'
                    ? metadata.secondaryTradeId
                    : null;

                if (secondaryTradeId) {
                    try {
                        await db.$transaction(async (tx: any) => {
                            await settleSecondaryTrade(tx, secondaryTradeId, payment.tenantId);
                            await tx.payment.update({
                                where: { id: payment.id },
                                data: {
                                    metadata: {
                                        ...(metadata || {}),
                                        settlementStatus: 'SETTLED',
                                        settledAt: new Date().toISOString(),
                                        settlementSource: 'ABA_WEBHOOK'
                                    }
                                }
                            });
                        });
                    } catch (settlementError) {
                        console.error('❌ Failed to settle secondary trade after ABA callback:', settlementError);
                        await db.payment.update({
                            where: { id: payment.id },
                            data: {
                                metadata: {
                                    ...(metadata || {}),
                                    settlementStatus: 'SETTLEMENT_ERROR',
                                    settlementError: settlementError instanceof Error ? settlementError.message : 'Unknown settlement error',
                                    settlementErrorAt: new Date().toISOString()
                                }
                            }
                        });
                    }
                }
            }
        } else {
            console.error('❌ Payment not found for transaction:', tran_id);
        }

        return res.json({ status: 0, description: 'Success' });
    } catch (error) {
        console.error('ABA Callback Error:', error);
        return res.status(500).json({ status: 1, description: 'Internal Error' });
    }
});

export default router;
