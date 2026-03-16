/**
 * Secondary Trading Routes - Share Trading (like StartEngine)
 * 
 * Uses Prisma ORM for database persistence
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma, prismaReplica } from '../database';
import { shouldUseDatabase } from '../migration-manager';
import { createAbaTransaction } from '../utils/aba';
import { settleSecondaryTrade } from '../services/secondary-trade-settlement';
import { isTradingOperatorRole } from '../lib/roles';
import { io } from '../socket';

const router = Router();

function requireTenantId(req: AuthenticatedRequest, res: Response): string | undefined {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
        res.status(403).json({ error: 'Tenant context required' });
        return undefined;
    }
    return tenantId;
}

async function requireInvestor(req: AuthenticatedRequest, tenantId: string, res: Response) {
    const investor = await prisma.investor.findFirst({
        where: { userId: req.user?.id, tenantId }
    });

    if (!investor) {
        res.status(404).json({ error: 'Investor profile not found' });
        return undefined;
    }

    return investor;
}

async function getInvestor(req: AuthenticatedRequest, tenantId: string) {
    return prisma.investor.findFirst({
        where: { userId: req.user?.id, tenantId }
    });
}

// Platform fee percentage
const PLATFORM_FEE = 0.01; // 1%

function resolvePaymentReturnUrl(returnUrl?: string) {
    if (typeof returnUrl === 'string' && returnUrl.trim()) {
        return returnUrl.trim();
    }

    const configuredBase = (process.env.FRONTEND_URL || process.env.APP_URL || 'https://trade.cambobia.com').trim();
    const normalizedBase = configuredBase.replace(/\/+$/, '');
    return `${normalizedBase}/secondary-trading`;
}

// Get all active listings
router.get('/listings', authorize('secondary_trading.list'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.json([]);
            return;
        }

        const { status, dealId, sellerId, minPrice, maxPrice } = req.query;

        const where: any = {
            tenantId,
            seller: {
                status: { not: 'DELETED' }
            }
        };
        if (status) where.status = status;
        if (sellerId) where.sellerId = sellerId;
        if (minPrice) where.pricePerShare = { ...where.pricePerShare, gte: parseFloat(minPrice as string) };
        if (maxPrice) where.pricePerShare = { ...where.pricePerShare, lte: parseFloat(maxPrice as string) };

        const listings = await prismaReplica.secondaryListing.findMany({
            where,
            include: {
                seller: {
                    select: { id: true, name: true, type: true }
                },
                dealInvestor: {
                    include: {
                        deal: {
                            include: {
                                sme: {
                                    select: {
                                        id: true,
                                        name: true,
                                        sector: true,
                                        stage: true,
                                        score: true,
                                        certified: true
                                    }
                                }
                            }
                        }
                    }
                },
                trades: true
            },
            orderBy: { listedAt: 'desc' }
        });

        // Current user's investor ID
        let currentInvestorId: string | undefined;
        if (req.user) {
            const investor = await prismaReplica.investor.findFirst({
                where: { userId: req.user.id, tenantId }
            });
            currentInvestorId = investor?.id;
        }

        // Map to format that frontend expects
        const formattedListings = listings.map(l => ({
            ...l,
            deal: l.dealInvestor?.deal || { title: 'Unknown Deal', sme: { name: 'N/A' } },
            returnPercentage: 0,
            originalPricePerShare: 0,
            isOwner: currentInvestorId ? l.sellerId === currentInvestorId : false
        }));

        res.json(formattedListings);
    } catch (error) {
        console.error('Error fetching listings:', error);
        res.status(500).json({ error: 'Failed to fetch listings' });
    }
});

// Trader profile/preferences (investor only)
router.get('/trader-profile', authorize('secondary_trading.read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.json({
                profile: {
                    riskLevel: 'MEDIUM',
                    investmentHorizon: 'MID',
                    strategy: 'VALUE',
                    maxPositionSize: 10,
                    preferredSectors: [],
                    notifications: {
                        priceAlerts: true,
                        executionUpdates: true,
                        marketAnnouncements: true
                    }
                }
            });
            return;
        }

        const role = req.user?.role;
        const isOperator = isTradingOperatorRole(role);
        if (isOperator) {
            res.json({
                mode: 'OPERATOR',
                operator: {
                    userId: req.user?.id,
                    role,
                    tenantId
                },
                profile: {
                    riskLevel: 'MEDIUM',
                    investmentHorizon: 'MID',
                    strategy: 'VALUE',
                    maxPositionSize: 10,
                    preferredSectors: [],
                    notifications: {
                        priceAlerts: true,
                        executionUpdates: true,
                        marketAnnouncements: true
                    },
                    watchlistCount: 0
                }
            });
            return;
        }

        const investor = await getInvestor(req, tenantId);
        if (!investor) {
            res.json({
                mode: 'READ_ONLY',
                profile: {
                    riskLevel: 'MEDIUM',
                    investmentHorizon: 'MID',
                    strategy: 'VALUE',
                    maxPositionSize: 10,
                    preferredSectors: [],
                    notifications: {
                        priceAlerts: false,
                        executionUpdates: false,
                        marketAnnouncements: true
                    },
                    watchlistCount: 0
                },
                message: 'Trader profile is available for investor accounts only.'
            });
            return;
        }

        const prefs = (investor.preferences as Record<string, unknown>) || {};
        const tradingProfile = (prefs.tradingProfile as Record<string, unknown>) || {};
        const watchlist = Array.isArray(prefs.watchlist) ? (prefs.watchlist as unknown[]) : [];

        res.json({
            mode: 'TRADER',
            investor: {
                id: investor.id,
                name: investor.name,
                type: investor.type,
                kycStatus: investor.kycStatus
            },
            profile: {
                riskLevel: String(tradingProfile.riskLevel || 'MEDIUM'),
                investmentHorizon: String(tradingProfile.investmentHorizon || 'MID'),
                strategy: String(tradingProfile.strategy || 'VALUE'),
                maxPositionSize: Number(tradingProfile.maxPositionSize ?? 10),
                preferredSectors: Array.isArray(tradingProfile.preferredSectors)
                    ? tradingProfile.preferredSectors.map(v => String(v)).slice(0, 10)
                    : [],
                notifications: {
                    priceAlerts: Boolean((tradingProfile.notifications as any)?.priceAlerts ?? true),
                    executionUpdates: Boolean((tradingProfile.notifications as any)?.executionUpdates ?? true),
                    marketAnnouncements: Boolean((tradingProfile.notifications as any)?.marketAnnouncements ?? true)
                },
                watchlistCount: watchlist.length
            }
        });
    } catch (error) {
        console.error('Error fetching trader profile:', error);
        res.status(500).json({ error: 'Failed to fetch trader profile' });
    }
});

router.put('/trader-profile', authorize('secondary_trading.buy'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const role = req.user?.role;
        if (isTradingOperatorRole(role)) {
            res.status(403).json({ error: 'Operator accounts do not use trader profile settings' });
            return;
        }

        const investor = await getInvestor(req, tenantId);
        if (!investor) {
            res.status(403).json({ error: 'Only investor accounts can update trader profile settings' });
            return;
        }

        const body = req.body || {};
        const existingPrefs = (investor.preferences as Record<string, unknown>) || {};
        const existingTrading = (existingPrefs.tradingProfile as Record<string, unknown>) || {};
        const existingNotifications = (existingTrading.notifications as Record<string, unknown>) || {};

        const nextTradingProfile = {
            ...existingTrading,
            riskLevel: ['LOW', 'MEDIUM', 'HIGH'].includes(String(body.riskLevel)) ? String(body.riskLevel) : String(existingTrading.riskLevel || 'MEDIUM'),
            investmentHorizon: ['SHORT', 'MID', 'LONG'].includes(String(body.investmentHorizon)) ? String(body.investmentHorizon) : String(existingTrading.investmentHorizon || 'MID'),
            strategy: ['VALUE', 'GROWTH', 'MOMENTUM', 'INCOME', 'MIXED'].includes(String(body.strategy)) ? String(body.strategy) : String(existingTrading.strategy || 'VALUE'),
            maxPositionSize: Math.max(1, Math.min(100, Number(body.maxPositionSize ?? existingTrading.maxPositionSize ?? 10))),
            preferredSectors: Array.isArray(body.preferredSectors)
                ? body.preferredSectors.map((v: unknown) => String(v)).filter(Boolean).slice(0, 10)
                : (Array.isArray(existingTrading.preferredSectors) ? existingTrading.preferredSectors : []),
            notifications: {
                ...existingNotifications,
                priceAlerts: body.notifications?.priceAlerts !== undefined ? Boolean(body.notifications.priceAlerts) : Boolean(existingNotifications.priceAlerts ?? true),
                executionUpdates: body.notifications?.executionUpdates !== undefined ? Boolean(body.notifications.executionUpdates) : Boolean(existingNotifications.executionUpdates ?? true),
                marketAnnouncements: body.notifications?.marketAnnouncements !== undefined ? Boolean(body.notifications.marketAnnouncements) : Boolean(existingNotifications.marketAnnouncements ?? true)
            }
        };

        await prisma.investor.update({
            where: { id: investor.id },
            data: {
                preferences: {
                    ...existingPrefs,
                    tradingProfile: nextTradingProfile
                } as any
            }
        });

        res.json({ message: 'Trader profile updated', profile: nextTradingProfile });
    } catch (error) {
        console.error('Error updating trader profile:', error);
        res.status(500).json({ error: 'Failed to update trader profile' });
    }
});

// Watchlist (investor-owned)
router.get('/watchlist', authorize('secondary_trading.read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.json({ listingIds: [], listings: [] });
            return;
        }

        const role = req.user?.role;
        if (isTradingOperatorRole(role)) {
            res.json({
                mode: 'OPERATOR',
                listingIds: [],
                listings: []
            });
            return;
        }

        const investor = await getInvestor(req, tenantId);
        if (!investor) {
            res.json({
                mode: 'READ_ONLY',
                listingIds: [],
                listings: []
            });
            return;
        }

        const prefs = (investor.preferences as Record<string, unknown>) || {};
        const rawIds = Array.isArray(prefs.watchlist) ? (prefs.watchlist as unknown[]) : [];
        const listingIds = rawIds.map(v => String(v)).filter(Boolean).slice(0, 100);

        if (listingIds.length === 0) {
            res.json({ listingIds: [], listings: [] });
            return;
        }

        const listings = await prismaReplica.secondaryListing.findMany({
            where: {
                tenantId,
                id: { in: listingIds },
                status: 'ACTIVE'
            },
            include: {
                seller: { select: { id: true, name: true, type: true } },
                dealInvestor: {
                    include: {
                        deal: {
                            include: {
                                sme: {
                                    select: {
                                        id: true,
                                        name: true,
                                        sector: true,
                                        stage: true,
                                        score: true,
                                        certified: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { listedAt: 'desc' }
        });

        const formattedListings = listings.map(l => ({
            ...l,
            deal: l.dealInvestor?.deal || { title: 'Unknown Deal', sme: { name: 'N/A' } },
            returnPercentage: 0,
            originalPricePerShare: 0,
            isOwner: l.sellerId === investor.id
        }));

        res.json({ listingIds, listings: formattedListings });
    } catch (error) {
        console.error('Error fetching watchlist:', error);
        res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
});

router.put('/watchlist', authorize('secondary_trading.buy'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        if (isTradingOperatorRole(req.user?.role)) {
            res.status(403).json({ error: 'Operator accounts do not have personal watchlists' });
            return;
        }

        const investor = await getInvestor(req, tenantId);
        if (!investor) {
            res.status(403).json({ error: 'Only investor accounts can update watchlists' });
            return;
        }

        const rawIds = Array.isArray(req.body?.listingIds) ? req.body.listingIds : [];
        const listingIds = rawIds.map((v: unknown) => String(v)).filter(Boolean).slice(0, 100);
        const uniqueIds = Array.from(new Set(listingIds));

        const prefs = (investor.preferences as Record<string, unknown>) || {};
        await prisma.investor.update({
            where: { id: investor.id },
            data: {
                preferences: {
                    ...prefs,
                    watchlist: uniqueIds
                } as any
            }
        });

        res.json({ message: 'Watchlist updated', listingIds: uniqueIds });
    } catch (error) {
        console.error('Error updating watchlist:', error);
        res.status(500).json({ error: 'Failed to update watchlist' });
    }
});

// Public market tape for trading dashboard
router.get('/trades/recent', authorize('secondary_trading.list'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.json({ trades: [] });
            return;
        }

        const limit = Math.max(1, Math.min(100, Number(req.query.limit || 30)));
        const trades = await prismaReplica.secondaryTrade.findMany({
            where: {
                status: 'COMPLETED',
                listing: { tenantId }
            },
            include: {
                listing: {
                    include: {
                        dealInvestor: {
                            include: {
                                deal: {
                                    include: {
                                        sme: {
                                            select: {
                                                id: true,
                                                name: true,
                                                sector: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { executedAt: 'desc' },
            take: limit
        });

        const formatted = trades.map(t => ({
            id: t.id,
            listingId: t.listingId,
            pricePerShare: t.pricePerShare,
            shares: t.shares,
            totalAmount: t.totalAmount,
            executedAt: t.executedAt,
            deal: t.listing?.dealInvestor?.deal
                ? {
                    id: t.listing.dealInvestor.deal.id,
                    title: t.listing.dealInvestor.deal.title,
                    sme: t.listing.dealInvestor.deal.sme
                }
                : null
        }));

        res.json({ trades: formatted });
    } catch (error) {
        console.error('Error fetching recent trades:', error);
        res.status(500).json({ error: 'Failed to fetch recent trades' });
    }
});

// Get listing by ID
router.get('/listings/:id', authorize('secondary_trading.read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }

        const listing = await prismaReplica.secondaryListing.findFirst({
            where: { id: req.params.id, tenantId },
            include: {
                trades: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }

        res.json(listing);
    } catch (error) {
        console.error('Error fetching listing:', error);
        res.status(500).json({ error: 'Failed to fetch listing' });
    }
});

// Create listing
router.post('/listings', authorize('secondary_trading.create_listing'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const {
            dealInvestorId,
            sharesAvailable,
            pricePerShare,
            minPurchase,
            expiresAt
        } = req.body;

        if (!sharesAvailable || sharesAvailable <= 0) {
            res.status(400).json({ error: 'Shares available must be greater than 0' });
            return;
        }

        if (pricePerShare === undefined || pricePerShare < 0) {
            res.status(400).json({ error: 'Price per share must be non-negative' });
            return;
        }

        // Only INVESTOR role can create listings
        if (req.user?.role !== 'INVESTOR') {
            res.status(403).json({ error: 'Only investors can create listings' });
            return;
        }

        // Get investor ID for the current user
        const investor = await prisma.investor.findFirst({
            where: { userId: req.user?.id, tenantId }
        });

        if (!investor) {
            res.status(403).json({ error: 'Only investors can create listings' });
            return;
        }

        // Verify the deal investment exists and deal is closed
        const dealInvestor = await prisma.dealInvestor.findFirst({
            where: { id: dealInvestorId, deal: { tenantId } },
            include: { deal: true }
        });

        if (!dealInvestor || dealInvestor.investorId !== investor.id) {
            res.status(400).json({ error: 'Invalid deal investment' });
            return;
        }

        // Enforce: Deal must be CLOSED or FUNDED to trade secondary shares
        const allowedStatuses = ['CLOSED', 'FUNDED'];
        if (!allowedStatuses.includes(dealInvestor.deal.status)) {
            res.status(400).json({
                error: `Secondary trading is not allowed. Deal status is ${dealInvestor.deal.status}, but must be CLOSED or FUNDED.`
            });
            return;
        }

        // Check active listings to prevent double-listing
        const activeListings = await prisma.secondaryListing.findMany({
            where: {
                dealInvestorId,
                tenantId,
                status: 'ACTIVE'
            }
        });

        const sharesLockedInListings = activeListings.reduce((sum, l) => sum + l.sharesAvailable, 0);
        const availableToSell = dealInvestor.amount - sharesLockedInListings;

        if (availableToSell < sharesAvailable) {
            console.warn(`❌ Insufficient shares: Has ${dealInvestor.amount}, Locked ${sharesLockedInListings}, Available ${availableToSell}, Requested ${sharesAvailable}`);
            res.status(400).json({
                error: `Insufficient shares. You have ${dealInvestor.amount.toFixed(2)} shares, but ${sharesLockedInListings.toFixed(2)} are already listed. Available: ${availableToSell.toFixed(2)}`,
                debug: {
                    totalShares: dealInvestor.amount,
                    lockedInListings: sharesLockedInListings,
                    available: availableToSell,
                    requested: sharesAvailable
                }
            });
            return;
        }

        const listing = await prisma.secondaryListing.create({
            data: {
                tenantId,
                sellerId: investor.id,
                dealInvestorId,
                sharesAvailable,
                pricePerShare,
                minPurchase: minPurchase || 1,
                status: 'ACTIVE',
                expiresAt: expiresAt ? new Date(expiresAt) : null
            }
        });

        // Real-time market update: New Listing
        if (io) {
            io.emit('market_update', {
                type: 'NEW_LISTING',
                symbol: listing.id,
                listing: {
                    ...listing,
                    deal: dealInvestor.deal
                }
            });
        }

        res.status(201).json(listing);
    } catch (error) {
        console.error('Error creating listing:', error);
        res.status(500).json({ error: 'Failed to create listing' });
    }
});

// Update listing
router.put('/listings/:id', authorize('secondary_trading.update_listing'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const existing = await prisma.secondaryListing.findFirst({
            where: { id: req.params.id, tenantId }
        });

        if (!existing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }

        // Check ownership
        const investor = await prisma.investor.findFirst({
            where: { userId: req.user?.id, tenantId }
        });

        const isOwner = investor && existing.sellerId === investor.id;
        const isAdmin = isTradingOperatorRole(req.user?.role);

        if (!isOwner && !isAdmin) {
            res.status(403).json({ error: 'Not authorized to update this listing' });
            return;
        }

        const { pricePerShare, sharesAvailable, minPurchase, status } = req.body;

        const updateData: any = {};
        if (pricePerShare) updateData.pricePerShare = pricePerShare;
        if (sharesAvailable !== undefined) updateData.sharesAvailable = sharesAvailable;
        if (minPurchase) updateData.minPurchase = minPurchase;
        if (status) updateData.status = status;

        const listing = await prisma.secondaryListing.update({
            where: { id: req.params.id },
            data: updateData
        });

        res.json(listing);
    } catch (error) {
        console.error('Error updating listing:', error);
        res.status(500).json({ error: 'Failed to update listing' });
    }
});

// Cancel listing (seller only)
router.delete('/listings/:id', authorize('secondary_trading.update_listing'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const listing = await prisma.secondaryListing.findFirst({
            where: { id: req.params.id, tenantId }
        });

        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }

        // Check ownership
        const investor = await prisma.investor.findFirst({
            where: { userId: req.user?.id, tenantId }
        });

        if (!investor || listing.sellerId !== investor.id) {
            res.status(403).json({ error: 'You can only cancel your own listings' });
            return;
        }

        if (listing.status !== 'ACTIVE') {
            res.status(400).json({ error: 'Only active listings can be cancelled' });
            return;
        }

        // Update status to CANCELLED instead of deleting (for audit trail)
        const cancelled = await prisma.secondaryListing.update({
            where: { id: req.params.id },
            data: { status: 'CANCELLED' }
        });

        res.json({ message: 'Listing cancelled successfully', listing: cancelled });
    } catch (error) {
        console.error('Error cancelling listing:', error);
        res.status(500).json({ error: 'Failed to cancel listing' });
    }
});

// Buy shares (create trade)
router.post('/listings/:id/buy', authorize('secondary_trading.buy'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const { shares } = req.body;

        // Only INVESTOR role can buy shares
        if (req.user?.role !== 'INVESTOR') {
            res.status(403).json({ error: 'Only investors can buy shares' });
            return;
        }

        // Get buyer investor ID
        const buyer = await prisma.investor.findFirst({
            where: { userId: req.user?.id, tenantId }
        });

        if (!buyer) {
            res.status(403).json({ error: 'Only investors can buy shares' });
            return;
        }

        const listing = await prisma.secondaryListing.findFirst({
            where: { id: req.params.id, tenantId }
        });

        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }

        if (listing.status !== 'ACTIVE') {
            res.status(400).json({ error: 'Listing is not active' });
            return;
        }

        if (buyer.id === listing.sellerId) {
            res.status(400).json({ error: 'Cannot buy your own shares' });
            return;
        }

        if (shares < listing.minPurchase) {
            res.status(400).json({ error: `Minimum purchase is ${listing.minPurchase} shares` });
            return;
        }

        if (shares > listing.sharesAvailable) {
            res.status(400).json({ error: 'Not enough shares available' });
            return;
        }

        const totalAmount = shares * listing.pricePerShare;
        const fee = totalAmount * PLATFORM_FEE;
        const grossAmount = Number((totalAmount + fee).toFixed(2));
        const shortTranId = `${Date.now()}${Math.floor(100000 + Math.random() * 900000)}`;

        // Create trade in processing state while awaiting payment settlement.
        const trade = await prisma.secondaryTrade.create({
            data: {
                listingId: listing.id,
                buyerId: buyer.id,
                sellerId: listing.sellerId,
                shares,
                pricePerShare: listing.pricePerShare,
                totalAmount,
                fee,
                status: 'PROCESSING'
            }
        });

        // Update listing
        const newSharesAvailable = listing.sharesAvailable - shares;
        await prisma.secondaryListing.update({
            where: { id: listing.id },
            data: {
                sharesAvailable: newSharesAvailable,
                status: newSharesAvailable === 0 ? 'SOLD' : 'ACTIVE'
            }
        });

        const payment = await prisma.payment.create({
            data: {
                tenantId,
                userId: req.user!.id,
                amount: grossAmount,
                currency: 'USD',
                method: 'ABA_PAYWAY',
                provider: 'ABA',
                providerTxId: shortTranId,
                status: 'PENDING',
                description: `Secondary trade purchase (${trade.id})`,
                metadata: {
                    category: 'SECONDARY_TRADE_BUY',
                    secondaryTradeId: trade.id,
                    listingId: listing.id,
                    sellerInvestorId: listing.sellerId,
                    buyerInvestorId: buyer.id,
                    platformFee: fee,
                    sellerPayout: Number((totalAmount - fee).toFixed(2)),
                    operatorAccount: 'CAMBOBIA_OPERATOR_CLEARING',
                    settlementStatus: 'AWAITING_PAYMENT'
                }
            }
        });

        let abaRequest: ReturnType<typeof createAbaTransaction> | null = null;
        try {
            const emailName = (req.user?.email || 'Investor').split('@')[0];
            abaRequest = createAbaTransaction(
                shortTranId,
                grossAmount,
                [
                    {
                        name: `Secondary trade ${trade.id}`,
                        quantity: 1,
                        price: grossAmount
                    }
                ],
                {
                    firstName: emailName,
                    lastName: '',
                    email: req.user?.email || 'unknown@example.com',
                    phone: '012000000'
                },
                'abapay_khqr',
                resolvePaymentReturnUrl(req.body.returnUrl)
            );
        } catch (paymentError) {
            console.warn('ABA transaction payload generation failed, trade remains pending payment:', paymentError);
        }

        // DEMO MODE: Auto-execute if requested
        if (req.body.simulate_payment) {
            await prisma.$transaction(async (tx) => {
                await tx.payment.update({
                    where: { id: payment.id },
                    data: {
                        status: 'COMPLETED',
                        metadata: {
                            ...((payment.metadata as Record<string, unknown>) || {}),
                            settlementStatus: 'SETTLED',
                            settledAt: new Date().toISOString(),
                            settlementSource: 'SIMULATION'
                        } as any
                    }
                });

                await settleSecondaryTrade(tx, trade.id, tenantId);
            });

            // Refetch updated trade
            const completedTrade = await prisma.secondaryTrade.findUnique({ where: { id: trade.id } });

            res.status(201).json({
                trade: completedTrade,
                paymentId: payment.id,
                message: 'Trade executed immediately (Simulation Mode)'
            });
            return;
        }

        res.status(201).json({
            trade,
            paymentId: payment.id,
            paymentIntentId: payment.providerTxId,
            clientSecret: `aba_${payment.providerTxId || payment.id}`,
            abaUrl: process.env.ABA_PAYWAY_API_URL || null,
            abaRequest,
            settlement: {
                operatorAccount: 'CAMBOBIA_OPERATOR_CLEARING',
                status: 'AWAITING_PAYMENT'
            }
        });
    } catch (error) {
        console.error('Error creating trade:', error);
        res.status(500).json({ error: 'Failed to create trade' });
    }
});

// Get trades for current user
router.get('/trades/my', authorize('secondary_trading.read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.json({ asBuyer: [], asSeller: [] });
            return;
        }

        const investor = await prisma.investor.findFirst({
            where: { userId: req.user?.id, tenantId }
        });

        if (!investor) {
            res.json({ asBuyer: [], asSeller: [] });
            return;
        }

        const [purchases, sales] = await Promise.all([
            prismaReplica.secondaryTrade.findMany({
                where: { buyerId: investor.id, listing: { tenantId } },
                include: {
                    listing: {
                        include: {
                            dealInvestor: {
                                include: {
                                    deal: {
                                        include: {
                                            sme: { select: { id: true, name: true } }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    seller: { select: { id: true, name: true } },
                    buyer: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prismaReplica.secondaryTrade.findMany({
                where: { sellerId: investor.id, listing: { tenantId } },
                include: {
                    listing: {
                        include: {
                            dealInvestor: {
                                include: {
                                    deal: {
                                        include: {
                                            sme: { select: { id: true, name: true } }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    seller: { select: { id: true, name: true } },
                    buyer: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        res.json({ purchases, sales });
    } catch (error) {
        console.error('Error fetching trades:', error);
        res.status(500).json({ error: 'Failed to fetch trades' });
    }
});

// Execute trade (admin only or webhook)
router.post('/trades/:id/execute', authorize('secondary_trading.execute'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const tradeId = req.params.id;

        await prisma.$transaction(async (tx) => {
            await settleSecondaryTrade(tx, tradeId, tenantId);
        });

        res.json({ message: 'Trade executed successfully' });
    } catch (error: any) {
        console.error('Error executing trade:', error);
        res.status(500).json({ error: error.message || 'Failed to execute trade' });
    }
});

// Confirm payment and settle trade from operator side.
router.post('/trades/:id/payment/confirm', authorize('billing.manage'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const tradeId = req.params.id;
        const { paymentId, providerTxId, markFailed, reason } = req.body || {};

        const trade = await prisma.secondaryTrade.findUnique({
            where: { id: tradeId },
            include: { listing: true }
        });

        if (!trade || trade.listing.tenantId !== tenantId) {
            res.status(404).json({ error: 'Trade not found' });
            return;
        }

        const payment = await prisma.payment.findFirst({
            where: {
                tenantId,
                ...(paymentId ? { id: String(paymentId) } : {}),
                ...(providerTxId ? { providerTxId: String(providerTxId) } : {}),
                metadata: {
                    path: ['secondaryTradeId'],
                    equals: tradeId
                }
            }
        });

        if (!payment) {
            res.status(404).json({ error: 'Linked payment not found' });
            return;
        }

        if (markFailed) {
            const failedPayment = await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'FAILED',
                    metadata: {
                        ...((payment.metadata as Record<string, unknown>) || {}),
                        settlementStatus: 'FAILED',
                        failedAt: new Date().toISOString(),
                        failureReason: String(reason || 'Marked failed by operator')
                    } as any
                }
            });

            await prisma.secondaryTrade.update({
                where: { id: tradeId },
                data: { status: 'FAILED' }
            });

            res.json({ message: 'Payment marked as failed', payment: failedPayment });
            return;
        }

        const result = await prisma.$transaction(async (tx) => {
            const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });
            if (!currentPayment) throw new Error('Payment not found');

            const completedPayment = currentPayment.status === 'COMPLETED'
                ? currentPayment
                : await tx.payment.update({
                    where: { id: currentPayment.id },
                    data: { status: 'COMPLETED' }
                });

            const settledTrade = await settleSecondaryTrade(tx, tradeId, tenantId);

            const updatedPayment = await tx.payment.update({
                where: { id: completedPayment.id },
                data: {
                    metadata: {
                        ...((completedPayment.metadata as Record<string, unknown>) || {}),
                        settlementStatus: 'SETTLED',
                        settledAt: new Date().toISOString(),
                        settledBy: req.user?.id
                    } as any
                }
            });

            return { settledTrade, updatedPayment };
        });

        res.json({
            message: 'Payment confirmed and trade settled',
            trade: result.settledTrade,
            payment: result.updatedPayment
        });
    } catch (error: any) {
        console.error('Error confirming secondary trade payment:', error);
        res.status(500).json({ error: error.message || 'Failed to confirm payment' });
    }
});

// Customer support intake for wrong transfer and settlement issues.
router.post('/trades/:id/report-issue', authorize('secondary_trading.read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const tradeId = req.params.id;
        const category = String(req.body?.category || 'WRONG_TRANSFER').trim();
        const subject = String(req.body?.subject || `Secondary trade issue ${tradeId}`).trim();
        const description = String(req.body?.description || '').trim();

        if (description.length < 20) {
            res.status(400).json({ error: 'Description must be at least 20 characters' });
            return;
        }

        const trade = await prisma.secondaryTrade.findUnique({
            where: { id: tradeId },
            include: {
                listing: {
                    include: { dealInvestor: true }
                },
                buyer: true,
                seller: true
            }
        });

        if (!trade || trade.listing.tenantId !== tenantId) {
            res.status(404).json({ error: 'Trade not found' });
            return;
        }

        const actorInvestor = await prisma.investor.findFirst({
            where: { userId: req.user?.id, tenantId }
        });
        const isParty = actorInvestor && (actorInvestor.id === trade.buyerId || actorInvestor.id === trade.sellerId);
        const isAdmin = isTradingOperatorRole(req.user?.role);
        if (!isParty && !isAdmin) {
            res.status(403).json({ error: 'Only trade participants can file trade issues' });
            return;
        }

        const ticket = await prisma.supportTicket.create({
            data: {
                tenantId,
                requesterId: req.user!.id,
                subject: `[TRADE:${tradeId}] ${subject}`,
                description,
                category: 'TRADING',
                priority: category === 'WRONG_TRANSFER' ? 'HIGH' : 'MEDIUM',
                slaHours: 8,
                responseDueAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
                metadata: {
                    tradeId,
                    category,
                    buyerInvestorId: trade.buyerId,
                    sellerInvestorId: trade.sellerId
                }
            }
        });

        const adminCase = await prisma.adminCase.create({
            data: {
                tenantId,
                type: 'SUPPORT',
                title: `Trade issue: ${category}`,
                description,
                priority: category === 'WRONG_TRANSFER' ? 'HIGH' : 'MEDIUM',
                requesterUserId: req.user!.id,
                createdById: req.user!.id,
                sourceTicketId: ticket.id,
                relatedEntityType: 'SECONDARY_TRADE',
                relatedEntityId: tradeId,
                dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                metadata: {
                    category,
                    tradeId
                }
            }
        });

        let dispute: { id: string } | null = null;
        if (['WRONG_TRANSFER', 'PAYMENT_REVERSAL', 'PAYMENT_NOT_RECEIVED'].includes(category)) {
            dispute = await prisma.dispute.create({
                data: {
                    tenantId,
                    dealId: trade.listing.dealInvestor.dealId,
                    initiatorId: req.user!.id,
                    reason: `Secondary trade transfer issue: ${category}`,
                    description: `[trade:${tradeId}] ${description}`,
                    status: 'OPEN'
                },
                select: { id: true }
            });
        }

        res.status(201).json({
            message: 'Issue submitted to support and operations',
            ticket,
            case: adminCase,
            dispute
        });
    } catch (error) {
        console.error('Error filing trade issue:', error);
        res.status(500).json({ error: 'Failed to file trade issue' });
    }
});

router.get('/support/my', authorize('secondary_trading.read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.json({ tickets: [] });
            return;
        }

        const tickets = await prisma.supportTicket.findMany({
            where: {
                tenantId,
                requesterId: req.user?.id,
                category: 'TRADING'
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.json({ tickets });
    } catch (error) {
        console.error('Error fetching trade support tickets:', error);
        res.status(500).json({ error: 'Failed to fetch support tickets' });
    }
});

router.get('/operator-account/summary', authorize('billing.read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.json({
                unsettledAmount: 0,
                settledAmount: 0,
                failedAmount: 0,
                unsettledCount: 0,
                settledCount: 0,
                failedCount: 0
            });
            return;
        }

        const payments = await prisma.payment.findMany({
            where: {
                tenantId,
                metadata: {
                    path: ['category'],
                    equals: 'SECONDARY_TRADE_BUY'
                }
            },
            select: {
                id: true,
                amount: true,
                status: true,
                metadata: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 1000
        });

        let unsettledAmount = 0;
        let settledAmount = 0;
        let failedAmount = 0;
        let unsettledCount = 0;
        let settledCount = 0;
        let failedCount = 0;

        for (const payment of payments) {
            const metadata = (payment.metadata as Record<string, unknown>) || {};
            const settlementStatus = String(metadata.settlementStatus || '');
            if (payment.status === 'FAILED' || settlementStatus === 'FAILED') {
                failedAmount += payment.amount;
                failedCount += 1;
                continue;
            }
            if (settlementStatus === 'SETTLED') {
                settledAmount += payment.amount;
                settledCount += 1;
                continue;
            }
            unsettledAmount += payment.amount;
            unsettledCount += 1;
        }

        res.json({
            unsettledAmount: Number(unsettledAmount.toFixed(2)),
            settledAmount: Number(settledAmount.toFixed(2)),
            failedAmount: Number(failedAmount.toFixed(2)),
            unsettledCount,
            settledCount,
            failedCount
        });
    } catch (error) {
        console.error('Error fetching operator account summary:', error);
        res.status(500).json({ error: 'Failed to fetch operator account summary' });
    }
});

// Get trading stats
router.get('/stats', authorize('secondary_trading.list'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const tenantId = requireTenantId(req, res);
        if (!tenantId) return;

        if (!shouldUseDatabase()) {
            res.json({
                totalListings: 0,
                activeListings: 0,
                totalTrades: 0,
                totalVolume: 0,
                totalFees: 0
            });
            return;
        }

        const [totalListings, activeListings, totalTrades, volumeResult, feeResult, listingValueResult] = await Promise.all([
            prismaReplica.secondaryListing.count({ where: { tenantId } }),
            prismaReplica.secondaryListing.count({ where: { status: 'ACTIVE', tenantId } }),
            prismaReplica.secondaryTrade.count({ where: { status: 'COMPLETED', listing: { tenantId } } }),
            prismaReplica.secondaryTrade.aggregate({
                where: { status: 'COMPLETED', listing: { tenantId } },
                _sum: { totalAmount: true }
            }),
            prismaReplica.secondaryTrade.aggregate({
                where: { status: 'COMPLETED', listing: { tenantId } },
                _sum: { fee: true }
            }),
            prismaReplica.secondaryListing.findMany({
                where: { status: 'ACTIVE', tenantId },
                select: { pricePerShare: true, sharesAvailable: true }
            })
        ]);

        const totalListingValue = listingValueResult.reduce((sum, l) => sum + (l.pricePerShare * l.sharesAvailable), 0);

        // Volume in last 24h
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dayVolume = await prismaReplica.secondaryTrade.aggregate({
            where: { status: 'COMPLETED', executedAt: { gte: yesterday }, listing: { tenantId } },
            _sum: { totalAmount: true }
        });

        res.json({
            totalListings,
            activeListings,
            totalTrades,
            totalListingValue: totalListingValue || 0,
            totalVolume: volumeResult._sum.totalAmount || 0,
            totalFees: feeResult._sum.fee || 0,
            avgReturn: 0, // In production, this would be derived from actual trade history
            last24hVolume: dayVolume._sum.totalAmount || 0
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

export default router;
