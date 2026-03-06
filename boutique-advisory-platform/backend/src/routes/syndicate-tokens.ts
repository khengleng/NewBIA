/**
 * Syndicate Token Trading Routes
 * 
 * Handles listing and trading of syndicate tokens
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma, prismaReplica } from '../database';
import { shouldUseDatabase } from '../migration-manager';
import { io } from '../socket';
import { WalletService } from '../services/wallet';

const router = Router();

// Platform fee percentage
const PLATFORM_FEE = 0.01; // 1%

// Get all syndicate token listings
router.get('/listings', authorize('secondary_trading.list'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.json([]);
            return;
        }

        const { status, syndicateId, sellerId } = req.query;

        const where: any = {};
        if (status) where.status = status;
        if (syndicateId) where.syndicateId = syndicateId;
        if (sellerId) where.sellerId = sellerId;

        const listings = await prismaReplica.syndicateTokenListing.findMany({
            where,
            include: {
                seller: {
                    select: { id: true, name: true, type: true }
                },
                syndicate: {
                    select: {
                        id: true,
                        name: true,
                        tokenName: true,
                        tokenSymbol: true,
                        pricePerToken: true,
                        isTokenized: true
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
                where: { userId: req.user.id }
            });
            currentInvestorId = investor?.id;
        }

        const results = listings.map(l => ({
            ...l,
            isOwner: currentInvestorId ? l.sellerId === currentInvestorId : false
        }));

        res.json(results);
    } catch (error) {
        console.error('Error fetching syndicate token listings:', error);
        res.status(500).json({ error: 'Failed to fetch listings' });
    }
});

// Create syndicate token listing
router.post('/listings', authorize('secondary_trading.create_listing'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const { syndicateId, tokensAvailable, pricePerToken, minTokens, expiresAt } = req.body;

        // Only INVESTOR role can create listings
        if (req.user?.role !== 'INVESTOR') {
            res.status(403).json({ error: 'Only investors can list tokens' });
            return;
        }

        // Get investor ID
        const investor = await prisma.investor.findFirst({
            where: { userId: req.user?.id }
        });

        if (!investor) {
            res.status(404).json({ error: 'Investor profile not found' });
            return;
        }

        // Verify user is a member of the syndicate and has enough tokens
        const membership = await prisma.syndicateMember.findUnique({
            where: {
                syndicateId_investorId: {
                    syndicateId,
                    investorId: investor.id
                }
            },
            include: {
                syndicate: true
            }
        });

        if (!membership || membership.status !== 'APPROVED') {
            res.status(403).json({ error: 'You must be an approved member to list tokens' });
            return;
        }

        // Auto-repair/Resilient check for tokens
        let currentTokens = membership.tokens || 0;
        if (currentTokens === 0 && membership.syndicate.isTokenized && membership.syndicate.pricePerToken) {
            currentTokens = membership.amount / membership.syndicate.pricePerToken;
        }

        // Check existing active listings to prevent double-spending
        const activeListings = await prisma.syndicateTokenListing.findMany({
            where: {
                sellerId: investor.id,
                syndicateId,
                status: 'ACTIVE'
            }
        });

        const tokensLockedInListings = activeListings.reduce((sum, l) => sum + l.tokensAvailable, 0);
        const availableToSell = currentTokens - tokensLockedInListings;

        if (availableToSell < tokensAvailable) {
            res.status(400).json({
                error: `Insufficient tokens. You have ${currentTokens.toFixed(2)} tokens, but ${tokensLockedInListings.toFixed(2)} are already listed. Available: ${availableToSell.toFixed(2)}`
            });
            return;
        }

        // Create listing
        const listing = await prisma.syndicateTokenListing.create({
            data: {
                syndicateId,
                sellerId: investor.id,
                tokensAvailable,
                pricePerToken,
                minTokens: minTokens || 1,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                status: 'ACTIVE'
            },
            include: {
                seller: {
                    select: { id: true, name: true, type: true }
                },
                syndicate: {
                    select: {
                        id: true,
                        name: true,
                        tokenName: true,
                        tokenSymbol: true
                    }
                }
            }
        });

        // Real-time market update
        if (io) {
            io.emit('market_update', {
                type: 'NEW_SYNDICATE_LISTING',
                symbol: listing.syndicateId,
                listing
            });
        }

        res.status(201).json(listing);
    } catch (error) {
        console.error('Error creating listing:', error);
        res.status(500).json({ error: 'Failed to create listing' });
    }
});

// Cancel syndicate token listing
router.delete('/listings/:id', authorize('secondary_trading.update_listing'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const listing = await prisma.syndicateTokenListing.findUnique({
            where: { id: req.params.id }
        });

        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }

        // Check ownership
        const investor = await prisma.investor.findFirst({
            where: { userId: req.user?.id }
        });

        if (!investor || listing.sellerId !== investor.id) {
            res.status(403).json({ error: 'You can only cancel your own listings' });
            return;
        }

        if (listing.status !== 'ACTIVE') {
            res.status(400).json({ error: 'Only active listings can be cancelled' });
            return;
        }

        // Update status to CANCELLED instead of deleting
        const cancelled = await prisma.syndicateTokenListing.update({
            where: { id: req.params.id },
            data: { status: 'CANCELLED' }
        });

        res.json({ message: 'Listing cancelled successfully', listing: cancelled });
    } catch (error) {
        console.error('Error cancelling listing:', error);
        res.status(500).json({ error: 'Failed to cancel listing' });
    }
});

// Buy syndicate tokens
router.post('/buy', authorize('secondary_trading.buy'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const { listingId, tokens } = req.body;

        // Only INVESTOR role can buy tokens
        if (req.user?.role !== 'INVESTOR') {
            res.status(403).json({ error: 'Only investors can buy tokens' });
            return;
        }

        // Get buyer investor
        const buyer = await prisma.investor.findFirst({
            where: { userId: req.user?.id }
        });

        if (!buyer) {
            res.status(404).json({ error: 'Investor profile not found' });
            return;
        }

        // Get listing
        const listing = await prisma.syndicateTokenListing.findUnique({
            where: { id: listingId },
            include: {
                seller: true,
                syndicate: true
            }
        });

        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }

        if (listing.status !== 'ACTIVE') {
            res.status(400).json({ error: 'Listing is not active' });
            return;
        }

        if (tokens < listing.minTokens) {
            res.status(400).json({ error: `Minimum purchase is ${listing.minTokens} tokens` });
            return;
        }

        if (tokens > listing.tokensAvailable) {
            res.status(400).json({ error: 'Not enough tokens available' });
            return;
        }

        const totalAmount = tokens * listing.pricePerToken;
        const fee = totalAmount * PLATFORM_FEE;

        // Create trade
        const trade = await prisma.syndicateTokenTrade.create({
            data: {
                listingId,
                buyerId: buyer.id,
                sellerId: listing.sellerId,
                tokens,
                pricePerToken: listing.pricePerToken,
                totalAmount,
                fee,
                status: 'COMPLETED', // Auto-complete for now
                executedAt: new Date()
            },
            include: {
                buyer: {
                    select: { id: true, name: true }
                },
                seller: {
                    select: { id: true, name: true }
                },
                listing: {
                    include: {
                        syndicate: true
                    }
                }
            }
        });

        // Update listing
        await prisma.syndicateTokenListing.update({
            where: { id: listingId },
            data: {
                tokensAvailable: { decrement: tokens },
                status: listing.tokensAvailable - tokens === 0 ? 'SOLD' : 'ACTIVE'
            }
        });

        // Transfer tokens from seller to buyer
        // Get or create buyer's syndicate membership
        let buyerMembership = await prisma.syndicateMember.findUnique({
            where: {
                syndicateId_investorId: {
                    syndicateId: listing.syndicateId,
                    investorId: buyer.id
                }
            }
        });

        if (buyerMembership) {
            // Update existing membership
            await prisma.syndicateMember.update({
                where: {
                    syndicateId_investorId: {
                        syndicateId: listing.syndicateId,
                        investorId: buyer.id
                    }
                },
                data: {
                    tokens: { increment: tokens },
                    amount: { increment: totalAmount }
                }
            });
        } else {
            // Create new membership
            await prisma.syndicateMember.create({
                data: {
                    syndicateId: listing.syndicateId,
                    investorId: buyer.id,
                    amount: totalAmount,
                    tokens,
                    status: 'APPROVED' // Auto-approve secondary purchases
                }
            });
        }

        // Deduct tokens from seller
        await prisma.syndicateMember.update({
            where: {
                syndicateId_investorId: {
                    syndicateId: listing.syndicateId,
                    investorId: listing.sellerId
                }
            },
            data: {
                tokens: { decrement: tokens }
            }
        });

        // Transfer funds via Wallet System (Binance Standard)
        const buyerUser = await prisma.user.findUnique({ where: { id: req.user!.id } });
        const sellerUser = await prisma.user.findUnique({
            where: { id: listing.seller.userId }
        });

        if (buyerUser && sellerUser) {
            await WalletService.settleTrade(
                buyerUser.id,
                sellerUser.id,
                totalAmount,
                fee,
                trade.id,
                buyerUser.tenantId,
                prisma as any
            );
        }

        // Real-time market update
        if (io) {
            io.emit('market_update', {
                type: 'SYNDICATE_TRADE_EXECUTED',
                syndicateId: listing.syndicateId,
                trade
            });
        }

        res.status(201).json({
            message: 'Tokens purchased successfully',
            trade
        });
    } catch (error) {
        console.error('Error buying tokens:', error);
        res.status(500).json({ error: 'Failed to purchase tokens' });
    }
});

// Get my token trades
router.get('/trades/my', authorize('secondary_trading.list'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.json({ purchases: [], sales: [] });
            return;
        }

        const investor = await prismaReplica.investor.findFirst({
            where: { userId: req.user?.id }
        });

        if (!investor) {
            res.json({ purchases: [], sales: [] });
            return;
        }

        const purchases = await prismaReplica.syndicateTokenTrade.findMany({
            where: { buyerId: investor.id },
            include: {
                seller: { select: { id: true, name: true } },
                listing: {
                    include: {
                        syndicate: {
                            select: {
                                id: true,
                                name: true,
                                tokenSymbol: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const sales = await prismaReplica.syndicateTokenTrade.findMany({
            where: { sellerId: investor.id },
            include: {
                buyer: { select: { id: true, name: true } },
                listing: {
                    include: {
                        syndicate: {
                            select: {
                                id: true,
                                name: true,
                                tokenSymbol: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ purchases, sales });
    } catch (error) {
        console.error('Error fetching trades:', error);
        res.status(500).json({ error: 'Failed to fetch trades' });
    }
});

export default router;
