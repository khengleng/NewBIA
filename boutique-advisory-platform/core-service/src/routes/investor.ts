import { Router, Response } from 'express';
import { prisma } from '../database';
import { validateBody, updateInvestorSchema } from '../middleware/validation';
import { authorize, AuthenticatedRequest } from '../middleware/authorize';

import { sumsub } from '../utils/sumsub';

import { encrypt, decrypt } from '../utils/encryption';

const router = Router();

// Get all investors
router.get('/', authorize('investor.list'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const tenantId = req.user?.tenantId;

    let query: any = {
      where: {
        tenantId: tenantId,
        status: { not: 'DELETED' }
      },
      include: {
        user: true,
        dealInvestments: {
          include: {
            deal: true
          }
        }
      }
    };

    // RBAC: SME only see investors interested in their deals
    if (userRole === 'SME') {
      const sme = await prisma.sME.findUnique({ where: { userId: userId } });
      if (sme) {
        query.where.dealInvestments = {
          some: {
            deal: {
              smeId: sme.id
            }
          }
        };
      } else {
        return res.json([]);
      }
    }

    const investors = await prisma.investor.findMany(query);

    // Sanitize sensitive preferences from list view
    const sanitizedInvestors = investors.map(inv => {
      const prefs: any = inv.preferences || {};
      // Remove sensitive PII from list view
      const { idNumber, ...safePrefs } = prefs;
      return { ...inv, preferences: safePrefs };
    });

    return res.json(sanitizedInvestors);
  } catch (error) {
    console.error('Get investors error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current investor profile - Auto-create if role matches but record missing
router.get('/profile', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const tenantId = req.user?.tenantId || 'default';

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let investor = await prisma.investor.findUnique({
      where: { userId },
      include: { user: true }
    });

    if (!investor) {
      if (role === 'INVESTOR') {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(401).json({ error: 'User not found' });

        investor = await prisma.investor.create({
          data: {
            userId,
            tenantId,
            name: `${user.firstName} ${user.lastName}`.trim(),
            type: 'ANGEL',
            kycStatus: 'PENDING'
          },
          include: { user: true }
        });
      } else {
        return res.status(404).json({ error: 'Investor record not found for this role.' });
      }
    }

    // Decrypt sensitive data
    const prefs: any = investor.preferences || {};
    if (prefs.idNumber) {
      prefs.idNumber = decrypt(prefs.idNumber);
    }

    return res.json({ investor: { ...investor, preferences: prefs }, user: investor.user });
  } catch (error) {
    console.error('Get investor profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get investor portfolio analytics (REAL DATA)
router.get('/portfolio/stats', authorize('investor.read', { getOwnerId: (req) => req.user?.id }), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const tenantId = req.user?.tenantId || 'default';

    // Get investor profile
    let investor = await prisma.investor.findUnique({
      where: { userId }
    });

    if (!investor) {
      const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
      if (!isAdmin) {
        return res.status(404).json({ error: 'Investor profile not found' });
      }

      // Admin/Super Admin fallback: return tenant-wide aggregate portfolio.
      const [dealInvestments, syndicateInvestments, launchpadCommitments] = await Promise.all([
        prisma.dealInvestor.findMany({
          where: {
            deal: { tenantId },
            status: { in: ['COMPLETED', 'APPROVED'] }
          },
          include: {
            deal: {
              include: {
                sme: true
              }
            }
          }
        }),
        prisma.syndicateMember.findMany({
          where: {
            syndicate: { deal: { tenantId } },
            status: 'APPROVED'
          },
          include: {
            syndicate: {
              include: {
                deal: {
                  include: {
                    sme: true
                  }
                }
              }
            }
          }
        }),
        prisma.launchpadCommitment.findMany({
          where: { tenantId },
          include: {
            offering: {
              include: {
                deal: { include: { sme: true } }
              }
            }
          }
        })
      ]);

      const dealAum = dealInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const syndicateAum = syndicateInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const launchpadAum = launchpadCommitments.reduce((sum, inv) => sum + (inv.committedAmount || 0), 0);
      const totalAum = dealAum + syndicateAum + launchpadAum;

      const allInvestments = [
        ...dealInvestments.map(i => ({ date: i.createdAt, amount: i.amount, sector: i.deal?.sme?.sector })),
        ...syndicateInvestments.map(i => ({ date: i.joinedAt, amount: i.amount, sector: i.syndicate?.deal?.sme?.sector || 'Syndicate' })),
        ...launchpadCommitments.map(i => ({ date: i.createdAt, amount: i.committedAmount, sector: i.offering?.deal?.sme?.sector || 'Launchpad' }))
      ];

      const startDate = allInvestments.length > 0
        ? allInvestments.reduce((earliest, inv) => inv.date < earliest ? inv.date : earliest, new Date())
        : new Date();

      const sectorMap = new Map<string, number>();
      allInvestments.forEach(inv => {
        const sector = inv.sector || 'General';
        const current = sectorMap.get(sector) || 0;
        sectorMap.set(sector, current + (inv.amount || 0));
      });

      const sectors = Array.from(sectorMap.entries()).map(([sector, amount]) => {
        const percentage = totalAum > 0 ? (amount / totalAum) * 100 : 0;
        return {
          sector,
          allocation: parseFloat(percentage.toFixed(1)),
          value: amount,
          color: getColorForSector(sector)
        };
      }).sort((a, b) => b.value - a.value);

      const topDeals = dealInvestments
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 50)
        .map(inv => ({
          id: inv.dealId,
          parentId: inv.dealId,
          investmentId: inv.id,
          type: 'DEAL' as const,
          name: inv.deal?.sme?.name || inv.deal?.title || 'Unknown Company',
          sector: inv.deal?.sme?.sector || 'General',
          allocation: totalAum > 0 ? parseFloat(((inv.amount / totalAum) * 100).toFixed(1)) : 0,
          value: inv.amount,
          shares: inv.amount,
          returns: 0,
          color: getColorForSector(inv.deal?.sme?.sector || 'General')
        }));

      return res.json({
        summary: {
          totalAum,
          activePositions: dealInvestments.length + syndicateInvestments.length + launchpadCommitments.length,
          realizedRoi: 0,
          totalPerformance: 0,
          startDate,
          kycStatus: 'VERIFIED',
          role: userRole
        },
        sectors,
        items: topDeals
      });
    }

    // 1. Get all completed/approved investments (Deals & Syndicates & Launchpad)
    const [dealInvestments, syndicateInvestments, launchpadCommitments] = await Promise.all([
      prisma.dealInvestor.findMany({
        where: {
          investorId: investor.id,
          status: { in: ['COMPLETED', 'APPROVED'] }
        },
        include: {
          deal: {
            include: {
              sme: true
            }
          }
        }
      }),
      prisma.syndicateMember.findMany({
        where: {
          investorId: investor.id,
          status: 'APPROVED'
        },
        include: {
          syndicate: {
            include: {
              deal: {
                include: {
                  sme: true
                }
              }
            }
          }
        }
      }),
      prisma.launchpadCommitment.findMany({
        where: {
          investorId: investor.id
        },
        include: {
          offering: {
            include: {
              deal: { include: { sme: true } }
            }
          }
        }
      })
    ]);

    if (dealInvestments.length === 0 && syndicateInvestments.length === 0 && launchpadCommitments.length === 0) {
      return res.json({
        summary: {
          totalAum: 0,
          activePositions: 0,
          realizedRoi: 0,
          startDate: new Date(),
          kycStatus: investor.kycStatus,
          role: userRole
        },
        sectors: [],
        items: []
      });
    }

    // 2. Calculate Portfolio Metrics
    const dealAum = dealInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const syndicateAum = syndicateInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const launchpadAum = launchpadCommitments.reduce((sum, inv) => sum + (inv.committedAmount || 0), 0);
    const totalAum = dealAum + syndicateAum + launchpadAum;
    const activePositions = dealInvestments.length + syndicateInvestments.length + launchpadCommitments.length;

    // Find the earliest investment date
    const allInvestments = [
      ...dealInvestments.map(i => ({ date: i.createdAt, amount: i.amount, sector: i.deal?.sme?.sector })),
      ...syndicateInvestments.map(i => ({ date: i.joinedAt, amount: i.amount, sector: i.syndicate?.deal?.sme?.sector || 'Syndicate' })),
      ...launchpadCommitments.map(i => ({ date: i.createdAt, amount: i.committedAmount, sector: i.offering?.deal?.sme?.sector || 'Launchpad' }))
    ];

    const startDate = allInvestments.reduce((earliest, inv) => {
      return inv.date < earliest ? inv.date : earliest;
    }, new Date());

    // 3. Calculate Sector Allocation
    const sectorMap = new Map<string, number>();

    allInvestments.forEach(inv => {
      const sector = inv.sector || 'General';
      const current = sectorMap.get(sector) || 0;
      sectorMap.set(sector, current + (inv.amount || 0));
    });

    const sectors = Array.from(sectorMap.entries()).map(([sector, amount]) => {
      const percentage = totalAum > 0 ? (amount / totalAum) * 100 : 0;

      return {
        sector,
        allocation: parseFloat(percentage.toFixed(1)),
        value: amount,
        color: getColorForSector(sector)
      };
    }).sort((a, b) => b.value - a.value);

    // 4. Format individual portfolio items (Real Production Data - no simulation)
    const dealItems = dealInvestments.map((inv) => {
      const percentage = totalAum > 0 ? (inv.amount / totalAum) * 100 : 0;

      return {
        id: inv.dealId,
        parentId: inv.dealId,
        investmentId: inv.id,
        type: 'DEAL',
        name: inv.deal?.sme?.name || inv.deal?.title || 'Unknown Company',
        sector: inv.deal?.sme?.sector || 'General',
        allocation: parseFloat(percentage.toFixed(1)),
        value: inv.amount,
        shares: inv.amount, // For deals, 1 share = $1 principal for now
        returns: 0, // Real dividends/growth track will go here
        color: getColorForSector(inv.deal?.sme?.sector || 'General')
      };
    });

    const syndicateItems = syndicateInvestments.map((inv) => {
      const percentage = totalAum > 0 ? (inv.amount / totalAum) * 100 : 0;

      // Auto-fix tokens if missing for the portfolio result
      let tokens = inv.tokens || 0;
      if (tokens === 0 && inv.syndicate?.isTokenized && inv.syndicate?.pricePerToken) {
        tokens = inv.amount / inv.syndicate.pricePerToken;
      }

      return {
        id: inv.syndicateId,
        parentId: inv.syndicateId,
        investmentId: inv.id,
        type: 'SYNDICATE' as const,
        name: inv.syndicate?.name || 'Syndicate',
        sector: inv.syndicate?.deal?.sme?.sector || 'Syndicate',
        allocation: parseFloat(percentage.toFixed(1)),
        value: inv.amount,
        shares: tokens, // Use tokens as the "sellable" unit
        returns: 0,
        color: getColorForSector(inv.syndicate?.deal?.sme?.sector || 'Syndicate')
      };
    });

    const launchpadItems = launchpadCommitments.map((inv) => {
      const percentage = totalAum > 0 ? (inv.committedAmount / totalAum) * 100 : 0;
      return {
        id: inv.offeringId,
        parentId: inv.offeringId,
        investmentId: inv.id,
        type: 'LAUNCHPAD' as const,
        name: inv.offering?.deal?.sme?.name || 'Launchpad Deal',
        sector: inv.offering?.deal?.sme?.sector || 'Launchpad',
        allocation: parseFloat(percentage.toFixed(1)),
        value: inv.committedAmount,
        shares: inv.committedAmount,
        returns: 0,
        color: getColorForSector(inv.offering?.deal?.sme?.sector || 'Launchpad')
      };
    });

    const portfolioItems = [...dealItems, ...syndicateItems, ...launchpadItems];

    // 5. Calculate Realized ROI & Total Performance
    const completedSales = await prisma.secondaryTrade.findMany({
      where: {
        sellerId: investor.id,
        status: 'COMPLETED'
      }
    });

    let realizedRoi = 0;
    if (completedSales.length > 0) {
      const totalRevenue = completedSales.reduce((sum, trade) => sum + trade.totalAmount, 0);
      const totalCostBasis = completedSales.reduce((sum, trade) => sum + trade.shares, 0);
      const totalFees = completedSales.reduce((sum, trade) => sum + trade.fee, 0);
      if (totalCostBasis > 0) {
        realizedRoi = parseFloat(((totalRevenue - totalCostBasis - totalFees) / totalCostBasis * 100).toFixed(2));
      }
    }

    // Weighted average of unrealized returns for the summary
    const totalUnrealizedGain = portfolioItems.reduce((sum, item) => sum + (item.value * (item.returns / 100)), 0);
    const totalPerformance = totalAum > 0 ? parseFloat(((totalUnrealizedGain / totalAum) * 100).toFixed(2)) : 0;

    return res.json({
      summary: {
        totalAum,
        activePositions,
        realizedRoi,
        totalPerformance,
        startDate,
        kycStatus: investor.kycStatus,
        role: userRole
      },
      sectors: sectors,
      items: portfolioItems
    });

  } catch (error: any) {
    console.error('Get portfolio stats error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message, stack: error.stack });
  }
});

// Get investor by ID
router.get('/:id', authorize('investor.read', {
  getOwnerId: async (req) => {
    const investor = await prisma.investor.findUnique({
      where: { id: req.params.id },
      select: { userId: true }
    });
    return investor?.userId;
  }
}), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const tenantId = req.user?.tenantId || 'default';

    const investor = await prisma.investor.findFirst({
      where: { id, tenantId },
      include: {
        user: true,
        dealInvestments: true
      }
    });

    if (!investor) {
      return res.status(404).json({ error: 'Investor not found' });
    }

    // Explicit ownership check for INVESTOR role
    const isOwner = investor.userId === userId;
    if (userRole === 'INVESTOR' && !isOwner) {
      return res.status(403).json({ error: 'Access denied: You can only view your own investor profile' });
    }

    // Decrypt sensitive data only for owner or admin
    const prefs: any = investor.preferences || {};
    if (prefs.idNumber) {
      // Only decrypt if authorized to see detailed PII
      if (isOwner || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
        prefs.idNumber = decrypt(prefs.idNumber);
      } else {
        // Mask it for others
        prefs.idNumber = '********';
      }
    }

    return res.json({ ...investor, preferences: prefs });
  } catch (error) {
    console.error('Get investor error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update investor - with input validation
router.put('/:id', authorize('investor.update', {
  getOwnerId: async (req) => {
    const investor = await prisma.investor.findUnique({
      where: { id: req.params.id },
      select: { userId: true }
    });
    return investor?.userId;
  }
}), validateBody(updateInvestorSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const updateData = req.body;

    const tenantId = req.user?.tenantId || 'default';

    // Check if investor exists
    const existingInvestor = await prisma.investor.findFirst({ where: { id, tenantId } });
    if (!existingInvestor) {
      return res.status(404).json({ error: 'Investor not found' });
    }

    // Ownership check
    if (userRole === 'INVESTOR' && existingInvestor.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: You can only update your own investor profile' });
    }

    // Encrypt sensitive fields if updated
    if (updateData.preferences) {
      if (updateData.preferences.idNumber) {
        updateData.preferences.idNumber = encrypt(updateData.preferences.idNumber);
      }
    }

    const investor = await prisma.investor.update({
      where: { id, tenantId },
      data: updateData,
      include: {
        user: true
      }
    });

    // Don't return encrypted PII directly, decrypt it back for response
    const prefs: any = investor.preferences || {};
    if (prefs.idNumber) {
      prefs.idNumber = decrypt(prefs.idNumber);
    }

    return res.json({ ...investor, preferences: prefs });
  } catch (error) {
    console.error('Update investor error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify Investor KYC (Manual override by Admin/Advisor)
router.post('/:id/kyc', authorize('investor.verify'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tenantId = req.user?.tenantId || 'default';

    // Check if investor exists
    const existingInvestor = await prisma.investor.findFirst({ where: { id, tenantId } });
    if (!existingInvestor) {
      return res.status(404).json({ error: 'Investor not found' });
    }

    // Update status
    const updatedInvestor = await prisma.investor.update({
      where: { id, tenantId },
      data: {
        kycStatus: 'VERIFIED',
        status: 'ACTIVE'
      } as any
    });

    return res.json({ message: 'Investor KYC verified successfully', investor: updatedInvestor });
  } catch (error) {
    console.error('Verify Investor KYC error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit KYC details
router.post('/kyc-submit', async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { fullName, nationality, idNumber, investorType } = req.body;

    const investor = await prisma.investor.findUnique({ where: { userId } });
    if (!investor) {
      return res.status(404).json({ error: 'Investor not found' });
    }

    const updatedInvestor = await prisma.investor.update({
      where: { id: investor.id },
      data: {
        type: investorType,
        kycStatus: 'PENDING', // Moves to pending review
        preferences: {
          ...(investor.preferences as any),
          nationality,
          idNumber: encrypt(idNumber), // Always encrypt PII at rest
          fullName
        } as any
      }
    });

    return res.json({ message: 'KYC submitted', investor: updatedInvestor });
  } catch (error) {
    console.error('KYC submission error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});




// Create Sumsub SDK Access Token
router.post('/kyc-token', authorize('investor.update', { getOwnerId: (req) => req.user?.id }), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!process.env.SUMSUB_APP_TOKEN || !process.env.SUMSUB_SECRET_KEY) {
      return res.status(503).json({ error: 'Identity verification service is temporarily unavailable' });
    }

    const investor = await prisma.investor.findUnique({ where: { userId } });
    if (!investor) {
      return res.status(404).json({ error: 'Investor profile not found for this account' });
    }

    const levelName = process.env.SUMSUB_LEVEL_NAME || 'basic-kyc-level';
    const tokenData = await sumsub.generateAccessToken(userId, levelName);

    return res.json({
      token: tokenData.token,
      userId: userId
    });
  } catch (error) {
    console.error('Sumsub KYC Token Error:', error);
    return res.status(500).json({ error: 'Failed to generate Sumsub verification token' });
  }
});

function getColorForSector(sector: string): string {
  const colors: any = {
    'Technology': 'bg-blue-500',
    'Fintech': 'bg-indigo-500',
    'Agriculture': 'bg-green-500',
    'Energy': 'bg-yellow-500',
    'Healthcare': 'bg-red-500',
    'Logistics': 'bg-purple-500',
    'Real Estate': 'bg-teal-500',
    'Education': 'bg-pink-500',
    'Manufacturing': 'bg-orange-500'
  };
  return colors[sector] || 'bg-gray-500';
}

// Delete Investor
router.delete('/:id', authorize('investor.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tenantId = req.user?.tenantId || 'default';

    const existingInvestor = await prisma.investor.findFirst({
      where: { id, tenantId },
      include: { user: true }
    });
    if (!existingInvestor) {
      return res.status(404).json({ error: 'Investor not found' });
    }

    const timestamp = Date.now();
    const deletedEmail = `deleted_${timestamp}_${existingInvestor.user.email}`;

    await prisma.investor.update({
      where: { id, tenantId },
      data: {
        status: 'DELETED' as any,
        user: {
          update: {
            status: 'DELETED' as any,
            email: deletedEmail
          }
        }
      }
    });

    return res.status(200).json({ message: 'Investor soft deleted successfully' });
  } catch (error: any) {
    console.error('Soft Delete Investor error:', error);
    return res.status(500).json({ error: 'Failed to delete Investor' });
  }
});

export default router;
