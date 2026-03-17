/**
 * Due Diligence Routes - SME Scoring System (like OurCrowd)
 * 
 * Uses Prisma ORM for database persistence
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest, authorize } from '../middleware/authorize';
import { prisma, prismaReplica } from '../database';
import { shouldUseDatabase } from '../migration-manager';
import { RiskLevel, AssessmentStatus } from '@prisma/client';

const router = Router();

// Calculate overall score helper
function calculateOverallScore(scores: {
    financialScore: number;
    teamScore: number;
    marketScore: number;
    productScore: number;
    legalScore: number;
    operationalScore: number;
}): number {
    const weights = {
        financial: 0.25,
        team: 0.20,
        market: 0.20,
        product: 0.15,
        legal: 0.10,
        operational: 0.10
    };

    return Math.round(
        (scores.financialScore * weights.financial +
            scores.teamScore * weights.team +
            scores.marketScore * weights.market +
            scores.productScore * weights.product +
            scores.legalScore * weights.legal +
            scores.operationalScore * weights.operational) * 100
    ) / 100;
}

// Determine risk level helper
function determineRiskLevel(score: number, redFlagsCount: number): string {
    if (redFlagsCount > 2) return 'VERY_HIGH';
    if (redFlagsCount > 0 && score < 70) return 'HIGH';
    if (score >= 80) return 'LOW';
    if (score >= 60) return 'MEDIUM';
    return 'HIGH';
}

function getGrade(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    return 'D';
}

// Get all due diligence reports
router.get('/', authorize('due_diligence.list'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.json([]);
            return;
        }

        const { smeId, status, riskLevel } = req.query;

        const dueDiligences = await prismaReplica.dueDiligence.findMany({
            where: {
                ...(smeId ? { smeId: smeId as string } : {}),
                ...(status ? { status: status as AssessmentStatus } : {}),
                ...(riskLevel ? { riskLevel: riskLevel as RiskLevel } : {})
            },
            include: {
                sme: {
                    select: {
                        id: true,
                        name: true,
                        sector: true
                    }
                },
                advisor: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(dueDiligences);
    } catch (error) {
        console.error('Error fetching due diligences:', error);
        res.status(500).json({ error: 'Failed to fetch due diligences' });
    }
});

// Get due diligence by ID
router.get('/:id', authorize('due_diligence.read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(404).json({ error: 'Due diligence not found' });
            return;
        }

        const dd = await prismaReplica.dueDiligence.findUnique({
            where: { id: req.params.id },
            include: {
                sme: {
                    select: {
                        id: true,
                        name: true,
                        sector: true,
                        stage: true,
                        description: true
                    }
                },
                advisor: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!dd) {
            res.status(404).json({ error: 'Due diligence not found' });
            return;
        }

        res.json(dd);
    } catch (error) {
        console.error('Error fetching due diligence:', error);
        res.status(500).json({ error: 'Failed to fetch due diligence' });
    }
});

// Get due diligence for specific SME
router.get('/sme/:smeId', authorize('due_diligence.read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(404).json({ error: 'No completed due diligence found for this SME' });
            return;
        }

        const dd = await prismaReplica.dueDiligence.findFirst({
            where: {
                smeId: req.params.smeId
            },
            include: {
                sme: {
                    select: {
                        id: true,
                        name: true,
                        sector: true
                    }
                },
                advisor: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        if (!dd) {
            res.status(200).json(null);
            return;
        }

        res.json(dd);
    } catch (error) {
        console.error('Error fetching SME due diligence:', error);
        res.status(500).json({ error: 'Failed to fetch due diligence' });
    }
});

// Create new due diligence (Advisor/Admin only)
router.post('/', authorize('due_diligence.create'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const { smeId } = req.body;

        if (!smeId) {
            res.status(400).json({ error: 'SME ID is required' });
            return;
        }

        // Verify SME exists
        const sme = await prisma.sME.findUnique({ where: { id: smeId } });
        if (!sme) {
            res.status(404).json({ error: 'SME not found' });
            return;
        }

        // Get advisor ID for the current user (if advisor)
        const advisor = await prisma.advisor.findFirst({
            where: { userId: req.user?.id }
        });

        const dd = await prisma.dueDiligence.create({
            data: {
                smeId,
                advisorId: advisor?.id,
                status: 'PENDING'
            },
            include: {
                sme: {
                    select: {
                        id: true,
                        name: true,
                        sector: true
                    }
                },
                advisor: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        res.status(201).json(dd);
    } catch (error) {
        console.error('Error creating due diligence:', error);
        res.status(500).json({ error: 'Failed to create due diligence' });
    }
});

// Update due diligence scores (Advisor only)
router.put('/:id', authorize('due_diligence.update'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(503).json({ error: 'Database not available' });
            return;
        }

        const existing = await prisma.dueDiligence.findUnique({
            where: { id: req.params.id }
        });

        if (!existing) {
            res.status(404).json({ error: 'Due diligence not found' });
            return;
        }

        const {
            financialScore,
            teamScore,
            marketScore,
            productScore,
            legalScore,
            operationalScore,
            strengths,
            weaknesses,
            recommendations,
            redFlags,
            status
        } = req.body;

        // Calculate new scores
        const scores = {
            financialScore: financialScore ?? existing.financialScore,
            teamScore: teamScore ?? existing.teamScore,
            marketScore: marketScore ?? existing.marketScore,
            productScore: productScore ?? existing.productScore,
            legalScore: legalScore ?? existing.legalScore,
            operationalScore: operationalScore ?? existing.operationalScore
        };

        const overallScore = calculateOverallScore(scores);
        const newRedFlags = redFlags ?? existing.redFlags;
        const riskLevel = determineRiskLevel(overallScore, newRedFlags.length);

        const updateData: any = {
            ...scores,
            overallScore,
            riskLevel
        };

        if (strengths) updateData.strengths = strengths;
        if (weaknesses) updateData.weaknesses = weaknesses;
        if (recommendations) updateData.recommendations = recommendations;
        if (redFlags) updateData.redFlags = redFlags;

        if (status === 'COMPLETED') {
            updateData.status = 'COMPLETED';
            updateData.completedAt = new Date();
            // Set expiry to 1 year from completion
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            updateData.expiresAt = expiryDate;

            // Update SME score and status
            await prisma.sME.update({
                where: { id: existing.smeId },
                data: {
                    score: overallScore,
                    status: 'UNDER_REVIEW' // Move to reviewing status
                }
            });
        } else if (status) {
            updateData.status = status;
        }

        const dd = await prisma.dueDiligence.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                sme: {
                    select: {
                        id: true,
                        name: true,
                        sector: true
                    }
                },
                advisor: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        res.json(dd);
    } catch (error) {
        console.error('Error updating due diligence:', error);
        res.status(500).json({ error: 'Failed to update due diligence' });
    }
});

// Get score breakdown
router.get('/:id/breakdown', authorize('due_diligence.read'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.status(404).json({ error: 'Due diligence not found' });
            return;
        }

        const dd = await prismaReplica.dueDiligence.findUnique({
            where: { id: req.params.id }
        });

        if (!dd) {
            res.status(404).json({ error: 'Due diligence not found' });
            return;
        }

        const breakdown = {
            categories: [
                { name: 'Financial Health', score: dd.financialScore, weight: 25, maxScore: 100 },
                { name: 'Team & Leadership', score: dd.teamScore, weight: 20, maxScore: 100 },
                { name: 'Market Opportunity', score: dd.marketScore, weight: 20, maxScore: 100 },
                { name: 'Product/Service', score: dd.productScore, weight: 15, maxScore: 100 },
                { name: 'Legal & Compliance', score: dd.legalScore, weight: 10, maxScore: 100 },
                { name: 'Operations', score: dd.operationalScore, weight: 10, maxScore: 100 }
            ],
            overallScore: dd.overallScore,
            riskLevel: dd.riskLevel,
            grade: getGrade(dd.overallScore)
        };

        res.json(breakdown);
    } catch (error) {
        console.error('Error fetching breakdown:', error);
        res.status(500).json({ error: 'Failed to fetch breakdown' });
    }
});

// Get due diligence stats
router.get('/stats/overview', authorize('due_diligence.list'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!shouldUseDatabase()) {
            res.json({
                total: 0,
                completed: 0,
                pending: 0,
                inProgress: 0,
                averageScore: 0,
                riskDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, VERY_HIGH: 0 }
            });
            return;
        }

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
            res.status(403).json({ error: 'Tenant context required' });
            return;
        }

        const [total, completed, pending, inProgress] = await Promise.all([
            prismaReplica.dueDiligence.count({ where: { sme: { tenantId } } }),
            prismaReplica.dueDiligence.count({ where: { status: 'COMPLETED', sme: { tenantId } } }),
            prismaReplica.dueDiligence.count({ where: { status: 'PENDING', sme: { tenantId } } }),
            prismaReplica.dueDiligence.count({ where: { status: 'IN_PROGRESS', sme: { tenantId } } })
        ]);

        const completedDDs = await prismaReplica.dueDiligence.findMany({
            where: { status: 'COMPLETED', sme: { tenantId } },
            select: { overallScore: true, riskLevel: true }
        });

        const avgScore = completedDDs.length > 0
            ? completedDDs.reduce((sum, d) => sum + d.overallScore, 0) / completedDDs.length
            : 0;

        const riskDistribution = {
            LOW: completedDDs.filter(d => d.riskLevel === 'LOW').length,
            MEDIUM: completedDDs.filter(d => d.riskLevel === 'MEDIUM').length,
            HIGH: completedDDs.filter(d => d.riskLevel === 'HIGH').length,
            VERY_HIGH: completedDDs.filter(d => d.riskLevel === 'VERY_HIGH').length
        };

        res.json({
            total,
            completed,
            pending,
            inProgress,
            averageScore: Math.round(avgScore * 100) / 100,
            riskDistribution
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

export default router;
