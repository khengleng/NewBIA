import { z, ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ==================== SME Schemas ====================
export const updateSMESchema = z.object({
    name: z.string().min(1).max(255).optional(),
    sector: z.string().min(1).max(100).optional(),
    stage: z.enum(['SEED', 'GROWTH', 'EXPANSION', 'MATURE']).optional(),
    fundingRequired: z.number().positive().optional(),
    description: z.string().max(2000).optional(),
    website: z.string().url().optional().nullable(),
    location: z.string().max(255).optional(),
    status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CERTIFIED', 'REJECTED']).optional(),
});

export const createSMEOnboardingSchema = z.object({
    ownerFirstName: z.string().trim().min(1).max(100),
    ownerLastName: z.string().trim().min(1).max(100),
    ownerEmail: z.string().email(),
    ownerPassword: z.string().min(8).max(128).optional(),
    name: z.string().trim().min(1).max(255),
    sector: z.string().trim().min(1).max(100),
    stage: z.enum(['SEED', 'GROWTH', 'EXPANSION', 'MATURE']),
    fundingRequired: z.coerce.number().positive(),
    description: z.string().trim().max(5000).optional(),
    website: z.string().url().optional(),
    location: z.string().trim().max(255).optional(),
    onboardingMode: z.enum(['DIRECT', 'ON_BEHALF']).optional().default('DIRECT'),
    mandateDocumentUrl: z.string().url().optional(),
    mandateDocumentName: z.string().trim().max(255).optional(),
}).superRefine((val, ctx) => {
    if (val.onboardingMode === 'ON_BEHALF' && !val.mandateDocumentUrl) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['mandateDocumentUrl'],
            message: 'Mandate document URL is required for on-behalf onboarding',
        });
    }
});

// ==================== Investor Schemas ====================
export const updateInvestorSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    type: z.enum(['ANGEL', 'VENTURE_CAPITAL', 'PRIVATE_EQUITY', 'CORPORATE', 'INSTITUTIONAL']).optional(),
    kycStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
    preferences: z.record(z.string(), z.unknown()).optional(),
    portfolio: z.array(z.unknown()).optional(),
});

// ==================== Deal Schemas ====================
export const createDealSchema = z.object({
    smeId: z.string().min(1, 'SME ID is required'),
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().max(5000).optional(),
    amount: z.union([z.string(), z.number()]).transform(val => parseFloat(String(val))),
    equity: z.union([z.string(), z.number()]).transform(val => parseFloat(String(val))).optional().nullable(),
    successFee: z.union([z.string(), z.number()]).transform(val => parseFloat(String(val))).optional().nullable(),
});

export const updateDealSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(5000).optional(),
    amount: z.number().positive().optional(),
    equity: z.number().min(0).max(100).optional().nullable(),
    successFee: z.number().min(0).optional().nullable(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'NEGOTIATION', 'FUNDED', 'CLOSED', 'CANCELLED']).optional(),
});

export const tokenizeDealSchema = z.object({
    syndicateName: z.string().trim().min(1).max(255),
    syndicateDescription: z.string().trim().max(5000).optional(),
    leadInvestorId: z.string().min(1),
    targetAmount: z.coerce.number().positive().optional(),
    minInvestment: z.coerce.number().positive().optional(),
    maxInvestment: z.coerce.number().positive().optional().nullable(),
    managementFee: z.coerce.number().min(0).max(100).optional(),
    carryFee: z.coerce.number().min(0).max(100).optional(),
    tokenName: z.string().trim().min(1).max(100),
    tokenSymbol: z.string().trim().regex(/^[A-Za-z0-9]{2,12}$/),
    pricePerToken: z.coerce.number().positive(),
    totalTokens: z.coerce.number().positive(),
    closingDate: z.string().datetime().optional(),
}).superRefine((val, ctx) => {
    if (val.maxInvestment != null && val.minInvestment != null && val.maxInvestment < val.minInvestment) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['maxInvestment'],
            message: 'maxInvestment must be greater than or equal to minInvestment',
        });
    }
});

// ==================== Auth Schemas ====================
export const registerSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['SME', 'INVESTOR', 'ADVISOR', 'ADMIN']),
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    tenantId: z.string().optional().default('default'),
    sector: z.string().optional(),
    fundingRequired: z.number().optional(),
    investorType: z.enum(['ANGEL', 'VENTURE_CAPITAL', 'PRIVATE_EQUITY', 'CORPORATE', 'INSTITUTIONAL']).optional(),
    specialization: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional(),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

// ==================== Validation Middleware ====================
export function validateBody<T extends ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            const zodError = result.error as ZodError;
            const errorMessages = zodError.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message
            }));

            res.status(400).json({
                error: 'Validation failed',
                details: errorMessages
            });
            return;
        }

        // Replace body with validated/transformed data
        req.body = result.data;
        next();
    };
}

export function validateParams<T extends ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.params);

        if (!result.success) {
            const zodError = result.error as ZodError;
            res.status(400).json({
                error: 'Invalid parameters',
                details: zodError.issues
            });
            return;
        }

        next();
    };
}

// Common ID parameter schema
export const idParamSchema = z.object({
    id: z.string().min(1, 'ID is required'),
});

// ==================== Community Schemas ====================
export const createPostSchema = z.object({
    title: z.string().min(1, 'Title is required').max(255),
    content: z.string().min(1, 'Content is required').max(10000),
    category: z.enum(['GENERAL', 'ANNOUNCEMENT', 'DEAL_UPDATE', 'INVESTOR_INSIGHT', 'SME_NEWS', 'QUESTION', 'SUCCESS_STORY']).optional(),
    smeId: z.string().optional(),
    dealId: z.string().optional(),
    syndicateId: z.string().optional(),
});

export const updatePostSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    content: z.string().min(1).max(10000).optional(),
    category: z.enum(['GENERAL', 'ANNOUNCEMENT', 'DEAL_UPDATE', 'INVESTOR_INSIGHT', 'SME_NEWS', 'QUESTION', 'SUCCESS_STORY']).optional(),
    isPinned: z.boolean().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN', 'DELETED']).optional(),
});

// ==================== Syndicate Schemas ====================
export const createSyndicateSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().max(5000).optional(),
    targetAmount: z.number().positive('Target amount must be positive'),
    minInvestment: z.number().positive().optional().default(1000),
    maxInvestment: z.number().positive().optional().nullable(),
    managementFee: z.number().min(0).max(100).optional().default(2.0),
    carryFee: z.number().min(0).max(100).optional().default(20.0),
    dealId: z.string().optional(),
    closingDate: z.string().datetime().optional(),
});

export const joinSyndicateSchema = z.object({
    amount: z.number().positive('Investment amount must be positive'),
});

// ==================== Secondary Trading Schemas ====================
export const createListingSchema = z.object({
    dealInvestorId: z.string().min(1, 'Deal investor ID is required'),
    sharesAvailable: z.number().positive('Shares must be positive'),
    pricePerShare: z.number().positive('Price must be positive'),
    minPurchase: z.number().positive().optional().default(1),
    expiresAt: z.string().datetime().optional(),
});

export const buySharesSchema = z.object({
    shares: z.number().positive('Shares must be positive'),
});

// ==================== Due Diligence Schemas ====================
export const createDueDiligenceSchema = z.object({
    smeId: z.string().min(1, 'SME ID is required'),
});

export const updateDueDiligenceSchema = z.object({
    financialScore: z.number().min(0).max(100).optional(),
    teamScore: z.number().min(0).max(100).optional(),
    marketScore: z.number().min(0).max(100).optional(),
    productScore: z.number().min(0).max(100).optional(),
    legalScore: z.number().min(0).max(100).optional(),
    operationalScore: z.number().min(0).max(100).optional(),
    strengths: z.array(z.string()).optional(),
    weaknesses: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
    redFlags: z.array(z.string()).optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED']).optional(),
});
