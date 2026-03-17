
import express, { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';

import { createAbaTransaction, verifyAbaCallback, generateAbaQr } from '../utils/aba'; // Update import
import { prisma } from '../database';
import { logAuditEvent } from '../utils/security';

const router = Router();

async function logBillingAction(params: {
    req: AuthenticatedRequest;
    action: string;
    paymentId: string;
    success: boolean;
    details?: Record<string, unknown>;
    errorMessage?: string;
}) {
    const { req, action, paymentId, success, details, errorMessage } = params;
    await logAuditEvent({
        userId: req.user?.id || 'unknown',
        action,
        resource: 'PAYMENT',
        resourceId: paymentId,
        details: {
            tenantId: req.user?.tenantId || 'default',
            ...details
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success,
        errorMessage
    });
}

function resolveInvoiceMonth(monthParam?: string) {
    const now = new Date();
    const monthString = (monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).trim();
    const [yearStr, monthStr] = monthString.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    if (!year || !month || month < 1 || month > 12) {
        return null;
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return { monthString: `${year}-${String(month).padStart(2, '0')}`, start, end };
}

function resolvePaymentReturnUrl(returnUrl?: string) {
    if (typeof returnUrl === 'string' && returnUrl.trim()) {
        return returnUrl.trim();
    }

    const configuredBase = (process.env.FRONTEND_URL || process.env.APP_URL || 'https://www.cambobia.com').trim();
    const normalizedBase = configuredBase.replace(/\/+$/, '');
    return `${normalizedBase}/payments/success`;
}

// ==================== MOCK PAYMENTS / LEGACY ====================

router.post('/create-payment-intent', authorize('payment.create'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { amount } = req.body;


        return res.json({
            clientSecret: 'mock_client_secret_' + Date.now(),
            paymentIntentId: 'mock_pi_' + Date.now(),
            mock: true,
            message: 'Stripe has been removed. Using internal mock payment flow.'
        });
    } catch (error: any) {
        console.error('Payment error:', error);
        return res.status(500).json({ error: 'Failed to create payment intent' });
    }
});



// ==================== ABA PAYWAY ====================

// 1. Create Transaction (Initiate Payment)
router.post('/aba/create-transaction', authorize('payment.create'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { amount, bookingId, dealInvestorId, items, returnUrl } = req.body;
        const user = req.user!;
        const tenantId = user.tenantId || 'default';
        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        const isTenantAdmin = user.role === 'ADMIN';

        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }
        const parsedAmount = Number.parseFloat(String(amount));
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }

        const normalizedBookingId = typeof bookingId === 'string' && bookingId.trim() ? bookingId.trim() : null;
        const normalizedDealInvestorId = typeof dealInvestorId === 'string' && dealInvestorId.trim() ? dealInvestorId.trim() : null;

        if (normalizedBookingId) {
            const booking = await prisma.booking.findFirst({
                where: isSuperAdmin ? { id: normalizedBookingId } : { id: normalizedBookingId, tenantId },
                select: { id: true, userId: true }
            });
            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }
            if (!isSuperAdmin && !isTenantAdmin && booking.userId !== user.id) {
                return res.status(403).json({ error: 'You can only pay for your own booking' });
            }
        }

        if (normalizedDealInvestorId) {
            const investment = await prisma.dealInvestor.findFirst({
                where: isSuperAdmin ? { id: normalizedDealInvestorId } : { id: normalizedDealInvestorId, deal: { tenantId } },
                include: { investor: { select: { userId: true } } }
            });
            if (!investment) {
                return res.status(404).json({ error: 'Investment not found' });
            }
            if (!isSuperAdmin && !isTenantAdmin && investment.investor.userId !== user.id) {
                return res.status(403).json({ error: 'You can only pay for your own investment' });
            }
        }

        // Generate Short Transaction ID for ABA (Max 20 chars, e.g. 19 chars)
        const shortTranId = Date.now().toString() + Math.floor(100000 + Math.random() * 900000).toString();

        // Create Payment record
        const payment = await (prisma as any).payment.create({
            data: {
                tenantId,
                userId: user.id,
                amount: parsedAmount,
                currency: 'USD',
                method: 'ABA_PAYWAY',
                provider: 'ABA',
                providerTxId: shortTranId, // Store ABA ID
                status: 'PENDING',
                bookingId: normalizedBookingId,
                dealInvestorId: normalizedDealInvestorId,
                description: `ABA Payment by ${user.email}`,
            }
        });

        // Generate ABA Request Data
        const abaRequest = createAbaTransaction(
            shortTranId,
            amount,
            items || [{ name: 'Advisory Service', quantity: 1, price: amount }],
            {
                firstName: user.email.split('@')[0], // Fallback if no specific name
                lastName: '',
                email: user.email,
                phone: '012000000' // Use fallback phone for now
            },
            'abapay_khqr', // Default to KHQR
            resolvePaymentReturnUrl(returnUrl)
        );

        return res.json({
            paymentId: payment.id,
            abaUrl: process.env.ABA_PAYWAY_API_URL,
            abaRequest
        });

    } catch (error: any) {
        console.error('ABA Create Transaction Error:', error);
        if (error?.message?.includes('ABA PayWay is not configured')) {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// 2. ABA Callback/Webhook (Moved to webhooks.ts)
// The callback logic resides in src/routes/webhooks.ts to allow public access.

// 3. Check Status (Authenticated)
router.get('/aba/status/:id', authorize('payment.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const user = req.user!;
        const tenantId = user.tenantId || 'default';
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        const payment = await (prisma as any).payment.findFirst({
            where: isSuperAdmin ? { id } : { id, tenantId }
        });

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Ownership check (tenant admin or super admin may view within scope)
        const isTenantAdmin = user.role === 'ADMIN';
        if (payment.userId !== user.id && !isTenantAdmin && !isSuperAdmin) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        return res.json({ status: payment.status });
    } catch (error) {
        console.error('ABA Status Check Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// 4. Generate QR (Direct API)
router.post('/aba/generate-qr', authorize('payment.create'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { amount, bookingId, dealInvestorId, items } = req.body;
        const user = req.user!;
        const tenantId = user.tenantId || 'default';
        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        const isTenantAdmin = user.role === 'ADMIN';

        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }
        const parsedAmount = Number.parseFloat(String(amount));
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Amount must be a positive number' });
        }

        const normalizedBookingId = typeof bookingId === 'string' && bookingId.trim() ? bookingId.trim() : null;
        const normalizedDealInvestorId = typeof dealInvestorId === 'string' && dealInvestorId.trim() ? dealInvestorId.trim() : null;

        if (normalizedBookingId) {
            const booking = await prisma.booking.findFirst({
                where: isSuperAdmin ? { id: normalizedBookingId } : { id: normalizedBookingId, tenantId },
                select: { id: true, userId: true }
            });
            if (!booking) {
                return res.status(404).json({ error: 'Booking not found' });
            }
            if (!isSuperAdmin && !isTenantAdmin && booking.userId !== user.id) {
                return res.status(403).json({ error: 'You can only pay for your own booking' });
            }
        }

        if (normalizedDealInvestorId) {
            const investment = await prisma.dealInvestor.findFirst({
                where: isSuperAdmin ? { id: normalizedDealInvestorId } : { id: normalizedDealInvestorId, deal: { tenantId } },
                include: { investor: { select: { userId: true } } }
            });
            if (!investment) {
                return res.status(404).json({ error: 'Investment not found' });
            }
            if (!isSuperAdmin && !isTenantAdmin && investment.investor.userId !== user.id) {
                return res.status(403).json({ error: 'You can only pay for your own investment' });
            }
        }

        // Generate Short Transaction ID
        const shortTranId = Date.now().toString() + Math.floor(100000 + Math.random() * 900000).toString();

        // Create Payment record
        const payment = await (prisma as any).payment.create({
            data: {
                tenantId,
                userId: user.id,
                amount: parsedAmount,
                currency: 'USD',
                method: 'KHQR',
                provider: 'ABA',
                providerTxId: shortTranId,
                status: 'PENDING',
                bookingId: normalizedBookingId,
                dealInvestorId: normalizedDealInvestorId,
                description: `ABA QR Payment by ${user.email}`,
            }
        });

        // Call ABA API
        const userData = user as any;
        const qrResult = await generateAbaQr(
            shortTranId,
            parsedAmount,
            {
                firstName: userData.firstName || userData.email.split('@')[0],
                lastName: userData.lastName || 'User',
                email: userData.email,
                phone: userData.phone
            },
            items
        );

        if (qrResult && (qrResult as any).qrString) {
            return res.json({
                success: true,
                paymentId: payment.id,
                ...qrResult
            });
        } else {
            const errorInfo = qrResult as any;
            console.error('Failed to generate QR Code. ABA Info:', errorInfo);

            await (prisma as any).payment.update({
                where: { id: payment.id },
                data: {
                    status: 'FAILED',
                    description: `ABA Error: ${errorInfo?.raw?.description || 'Unknown Error'}`
                }
            });

            return res.status(400).json({
                error: 'ABA Payment Gateway Error',
                status: errorInfo?.raw?.status,
                description: errorInfo?.raw?.description || 'The payment gateway rejected the request. Check your Merchant ID and API Key.',
                message: errorInfo?.message // Internal message from axios if any
            });
        }

    } catch (error: any) {
        console.error('ABA Generate QR Route Error:', error.message);
        if (error?.message?.includes('ABA PayWay is not configured')) {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({
            error: 'Server Error',
            message: error.message,
            details: error.response?.data || 'No additional details'
        });
    }
});

// ==================== ADMIN BILLING OPERATIONS ====================

router.get('/admin/overview', authorize('billing.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const scope = isSuperAdmin ? {} : { tenantId };

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [completedThisMonth, pendingPayments, failedLast30d, refundedLast30d, processingPayments] = await Promise.all([
            prisma.payment.aggregate({
                where: {
                    ...scope,
                    status: 'COMPLETED',
                    createdAt: { gte: monthStart }
                },
                _sum: { amount: true },
                _count: true
            }),
            prisma.payment.aggregate({
                where: {
                    ...scope,
                    status: 'PENDING'
                },
                _sum: { amount: true },
                _count: true
            }),
            prisma.payment.aggregate({
                where: {
                    ...scope,
                    status: 'FAILED',
                    createdAt: { gte: last30d }
                },
                _sum: { amount: true },
                _count: true
            }),
            prisma.payment.aggregate({
                where: {
                    ...scope,
                    status: 'REFUNDED',
                    createdAt: { gte: last30d }
                },
                _sum: { amount: true },
                _count: true
            }),
            prisma.payment.aggregate({
                where: {
                    ...scope,
                    status: 'PROCESSING'
                },
                _sum: { amount: true },
                _count: true
            })
        ]);

        const completedCount = completedThisMonth._count || 0;
        const failedCount = failedLast30d._count || 0;
        const successRate = completedCount + failedCount > 0
            ? Number(((completedCount / (completedCount + failedCount)) * 100).toFixed(1))
            : 100;

        return res.json({
            metrics: {
                monthlyRevenue: completedThisMonth._sum.amount || 0,
                monthlyCompletedCount: completedCount,
                pendingAmount: pendingPayments._sum.amount || 0,
                pendingCount: pendingPayments._count || 0,
                processingAmount: processingPayments._sum.amount || 0,
                processingCount: processingPayments._count || 0,
                failedAmountLast30d: failedLast30d._sum.amount || 0,
                failedCountLast30d: failedCount,
                refundedAmountLast30d: refundedLast30d._sum.amount || 0,
                refundedCountLast30d: refundedLast30d._count || 0,
                successRate
            }
        });
    } catch (error) {
        console.error('Admin billing overview error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/admin/invoices', authorize('billing.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const range = resolveInvoiceMonth(req.query.month as string | undefined);

        if (!range) {
            return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
        }

        const whereBase: any = {
            createdAt: { gte: range.start, lt: range.end }
        };
        if (!isSuperAdmin) whereBase.tenantId = tenantId;

        const [completedRows, pendingRows, refundedRows] = await Promise.all([
            prisma.payment.groupBy({
                by: ['userId'],
                where: { ...whereBase, status: 'COMPLETED' },
                _sum: { amount: true },
                _count: true
            }),
            prisma.payment.groupBy({
                by: ['userId'],
                where: { ...whereBase, status: { in: ['PENDING', 'PROCESSING'] } },
                _sum: { amount: true },
                _count: true
            }),
            prisma.payment.groupBy({
                by: ['userId'],
                where: { ...whereBase, status: 'REFUNDED' },
                _sum: { amount: true },
                _count: true
            })
        ]);

        const invoiceMap = new Map<string, any>();
        const ensureInvoice = (userId: string) => {
            if (!invoiceMap.has(userId)) {
                invoiceMap.set(userId, {
                    userId,
                    month: range.monthString,
                    invoiceNumber: `INV-${range.monthString.replace('-', '')}-${userId.slice(0, 6).toUpperCase()}`,
                    completedAmount: 0,
                    pendingAmount: 0,
                    refundedAmount: 0,
                    completedCount: 0,
                    pendingCount: 0,
                    refundedCount: 0
                });
            }
            return invoiceMap.get(userId);
        };

        completedRows.forEach((row) => {
            const invoice = ensureInvoice(row.userId);
            invoice.completedAmount = row._sum.amount || 0;
            invoice.completedCount = row._count || 0;
        });
        pendingRows.forEach((row) => {
            const invoice = ensureInvoice(row.userId);
            invoice.pendingAmount = row._sum.amount || 0;
            invoice.pendingCount = row._count || 0;
        });
        refundedRows.forEach((row) => {
            const invoice = ensureInvoice(row.userId);
            invoice.refundedAmount = row._sum.amount || 0;
            invoice.refundedCount = row._count || 0;
        });

        const userIds = Array.from(invoiceMap.keys());
        const users = userIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, email: true, firstName: true, lastName: true }
            })
            : [];
        const usersById = new Map(users.map((u) => [u.id, u]));

        const invoices = Array.from(invoiceMap.values())
            .map((invoice) => {
                const customer = usersById.get(invoice.userId);
                const amountDue = Number((invoice.completedAmount - invoice.refundedAmount).toFixed(2));
                const hasPending = invoice.pendingAmount > 0;
                return {
                    ...invoice,
                    amountDue,
                    status: hasPending ? 'PENDING' : amountDue > 0 ? 'ISSUED' : 'SETTLED',
                    customer: customer || null
                };
            })
            .sort((a, b) => b.amountDue - a.amountDue);

        return res.json({
            month: range.monthString,
            invoices
        });
    } catch (error) {
        console.error('Admin invoice list error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/admin/invoices/:userId', authorize('billing.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const range = resolveInvoiceMonth(req.query.month as string | undefined);
        const userId = req.params.userId;

        if (!range) {
            return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
        }

        const where: any = {
            userId,
            createdAt: { gte: range.start, lt: range.end }
        };
        if (!isSuperAdmin) where.tenantId = tenantId;

        const [customer, lineItems] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, firstName: true, lastName: true, tenantId: true }
            }),
            prisma.payment.findMany({
                where,
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true,
                    amount: true,
                    currency: true,
                    status: true,
                    method: true,
                    provider: true,
                    providerTxId: true,
                    description: true,
                    createdAt: true
                }
            })
        ]);

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        if (!isSuperAdmin && customer.tenantId !== tenantId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const completed = lineItems.filter((item) => item.status === 'COMPLETED').reduce((sum, item) => sum + item.amount, 0);
        const refunded = lineItems.filter((item) => item.status === 'REFUNDED').reduce((sum, item) => sum + item.amount, 0);
        const pending = lineItems.filter((item) => item.status === 'PENDING' || item.status === 'PROCESSING').reduce((sum, item) => sum + item.amount, 0);

        return res.json({
            invoice: {
                invoiceNumber: `INV-${range.monthString.replace('-', '')}-${userId.slice(0, 6).toUpperCase()}`,
                month: range.monthString,
                customer: {
                    id: customer.id,
                    email: customer.email,
                    name: `${customer.firstName} ${customer.lastName}`.trim()
                },
                summary: {
                    completedAmount: Number(completed.toFixed(2)),
                    refundedAmount: Number(refunded.toFixed(2)),
                    pendingAmount: Number(pending.toFixed(2)),
                    amountDue: Number((completed - refunded).toFixed(2))
                },
                lineItems
            }
        });
    } catch (error) {
        console.error('Admin invoice detail error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/admin/transactions', authorize('billing.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const status = (req.query.status as string | undefined)?.toUpperCase();
        const search = (req.query.search as string | undefined)?.trim();
        const page = Math.max(parseInt(req.query.page as string || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit as string || '25', 10), 1), 100);
        const skip = (page - 1) * limit;

        const where: any = {};
        if (!isSuperAdmin) where.tenantId = tenantId;
        if (status && ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED'].includes(status)) {
            where.status = status;
        }
        if (search) {
            where.OR = [
                { providerTxId: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { user: { email: { contains: search, mode: 'insensitive' } } }
            ];
        }

        const [transactions, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: {
                    user: {
                        select: { id: true, email: true, firstName: true, lastName: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip
            }),
            prisma.payment.count({ where })
        ]);

        return res.json({
            transactions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            }
        });
    } catch (error) {
        console.error('Admin list transactions error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/admin/transactions/:id/retry', authorize('billing.manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const paymentId = req.params.id;

        const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (!isSuperAdmin && payment.tenantId !== tenantId) return res.status(403).json({ error: 'Forbidden' });
        if (!['FAILED', 'CANCELLED'].includes(payment.status)) {
            return res.status(400).json({ error: 'Only FAILED or CANCELLED payments can be retried' });
        }

        const currentMetadata = (payment.metadata as any) || {};
        const retryCount = Number(currentMetadata.retryCount || 0) + 1;

        const updated = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'PROCESSING',
                metadata: {
                    ...currentMetadata,
                    retryCount,
                    lastRetryAt: new Date().toISOString(),
                    retriedBy: req.user?.id
                } as any
            }
        });

        await logBillingAction({
            req,
            action: 'PAYMENT_RETRY',
            paymentId,
            success: true,
            details: {
                previousStatus: payment.status,
                newStatus: updated.status,
                retryCount
            }
        });

        return res.json({
            message: 'Payment moved to PROCESSING for retry',
            payment: updated
        });
    } catch (error) {
        console.error('Admin retry payment error:', error);
        await logBillingAction({
            req,
            action: 'PAYMENT_RETRY',
            paymentId: req.params.id,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/admin/transactions/:id/refund', authorize('billing.manage'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const paymentId = req.params.id;
        const reason = (req.body?.reason as string | undefined)?.trim() || 'Manual refund';

        const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (!isSuperAdmin && payment.tenantId !== tenantId) return res.status(403).json({ error: 'Forbidden' });
        if (payment.status !== 'COMPLETED') {
            return res.status(400).json({ error: 'Only COMPLETED payments can be refunded' });
        }

        const currentMetadata = (payment.metadata as any) || {};
        const updated = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'REFUNDED',
                metadata: {
                    ...currentMetadata,
                    refundedAt: new Date().toISOString(),
                    refundReason: reason,
                    refundedBy: req.user?.id,
                    refundedAmount: payment.amount
                } as any
            }
        });

        await logBillingAction({
            req,
            action: 'PAYMENT_REFUND',
            paymentId,
            success: true,
            details: {
                previousStatus: payment.status,
                newStatus: updated.status,
                reason
            }
        });

        return res.json({
            message: 'Payment marked as refunded',
            payment: updated
        });
    } catch (error) {
        console.error('Admin refund payment error:', error);
        await logBillingAction({
            req,
            action: 'PAYMENT_REFUND',
            paymentId: req.params.id,
            success: false,
            details: {
                reason: req.body?.reason
            },
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/admin/fund-operations/overview', authorize('billing.read'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const scope = isSuperAdmin ? {} : { tenantId };

        const [primaryInvestments, secondaryTrades, unresolvedTransferCases] = await Promise.all([
            prisma.payment.aggregate({
                where: {
                    ...scope,
                    dealInvestorId: { not: null }
                },
                _sum: { amount: true },
                _count: true
            }),
            prisma.payment.findMany({
                where: {
                    ...scope,
                    metadata: {
                        path: ['category'],
                        equals: 'SECONDARY_TRADE_BUY'
                    }
                },
                select: {
                    amount: true,
                    status: true,
                    metadata: true
                },
                take: 1000
            }),
            prisma.adminCase.count({
                where: {
                    ...scope,
                    relatedEntityType: 'SECONDARY_TRADE',
                    status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] }
                }
            })
        ]);

        let operatorPending = 0;
        let operatorSettled = 0;
        let operatorFailed = 0;
        for (const payment of secondaryTrades) {
            const metadata = (payment.metadata as Record<string, unknown>) || {};
            const settlementStatus = String(metadata.settlementStatus || '');
            if (payment.status === 'FAILED' || settlementStatus === 'FAILED' || settlementStatus === 'SETTLEMENT_ERROR') {
                operatorFailed += payment.amount;
            } else if (settlementStatus === 'SETTLED') {
                operatorSettled += payment.amount;
            } else {
                operatorPending += payment.amount;
            }
        }

        return res.json({
            investmentFund: {
                totalPrimaryInvestmentAmount: primaryInvestments._sum.amount || 0,
                primaryInvestmentCount: primaryInvestments._count || 0
            },
            operatorAccount: {
                pendingClearingAmount: Number(operatorPending.toFixed(2)),
                settledAmount: Number(operatorSettled.toFixed(2)),
                failedOrExceptionAmount: Number(operatorFailed.toFixed(2))
            },
            customerOperations: {
                unresolvedTransferCases
            }
        });
    } catch (error) {
        console.error('Fund operations overview error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/admin/fund-operations/transfer-issues', authorize('case.list'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenantId = req.user?.tenantId || 'default';
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const where: any = {
            ...(isSuperAdmin ? {} : { tenantId }),
            relatedEntityType: 'SECONDARY_TRADE'
        };

        const cases = await prisma.adminCase.findMany({
            where,
            include: {
                requester: { select: { id: true, email: true, firstName: true, lastName: true } },
                assignee: { select: { id: true, email: true, firstName: true, lastName: true } }
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
            take: 200
        });

        return res.json({ cases });
    } catch (error) {
        console.error('Fund transfer issues listing error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
