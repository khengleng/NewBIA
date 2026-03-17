/**
 * Data Masking Middleware
 * Automatically masks sensitive data in API responses based on user role
 */

import { Request, Response, NextFunction } from 'express';
import { maskObject, maskArray, shouldMaskData } from '../utils/dataMasking';

/**
 * Extended request interface with user information
 */
export interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
        role: string;
        tenantId: string;
    };
}

/**
 * Middleware to mask sensitive data in responses
 */
export const maskResponseData = (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (data: any) {
        if (!req.user) {
            // No user, return as is (for public endpoints)
            return originalJson(data);
        }

        const userRole = req.user.role;
        const userId = req.user.userId;

        // Don't mask for SUPER_ADMIN
        if (userRole === 'SUPER_ADMIN') {
            return originalJson(data);
        }

        // Mask data based on structure
        const maskedData = maskResponseData.maskData(data, userRole, userId);

        return originalJson(maskedData);
    };

    next();
};

/**
 * Recursively mask data in response
 */
maskResponseData.maskData = function (data: any, userRole: string, userId: string): any {
    if (!data) return data;

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => {
            if (typeof item === 'object' && item !== null) {
                const isOwner = item.userId === userId || item.id === userId;
                return maskObject(item, userRole, isOwner);
            }
            return item;
        });
    }

    // Handle objects
    if (typeof data === 'object') {
        // Check if it's a paginated response
        if (data.data && Array.isArray(data.data)) {
            return {
                ...data,
                data: data.data.map((item: any) => {
                    const isOwner = item.userId === userId || item.id === userId;
                    return maskObject(item, userRole, isOwner);
                })
            };
        }

        // Check if it's a single resource
        const isOwner = data.userId === userId || data.id === userId;
        return maskObject(data, userRole, isOwner);
    }

    // Primitive values - return as is
    return data;
};

/**
 * Specific masking for SME data
 */
export const maskSMEData = (sme: any, userRole: string, userId: string): any => {
    const isOwner = sme.userId === userId;
    const config = shouldMaskData(userRole, undefined, isOwner);

    const masked = { ...sme };

    if (config.maskFinancial) {
        // Mask financial details
        if (masked.fundingRequired) {
            masked.fundingRequired = parseInt(masked.fundingRequired.toString().charAt(0)) * Math.pow(10, masked.fundingRequired.toString().length - 1);
        }
        if (masked.revenue) {
            masked.revenue = '***';
        }
        if (masked.valuation) {
            masked.valuation = '***';
        }
    }

    if (config.maskPersonal) {
        // Mask owner personal info
        if (masked.ownerNationalId) masked.ownerNationalId = '***-***-' + masked.ownerNationalId.slice(-4);
        if (masked.taxId) masked.taxId = '***-***-' + masked.taxId.slice(-4);
    }

    if (config.maskPhone && masked.contactNumber) {
        const phone = masked.contactNumber.toString();
        masked.contactNumber = phone.slice(0, 3) + '-***-' + phone.slice(-3);
    }

    if (config.maskEmail && masked.contactEmail) {
        const email = masked.contactEmail;
        const [local, domain] = email.split('@');
        masked.contactEmail = local.charAt(0) + '***@' + domain;
    }

    return masked;
};

/**
 * Specific masking for Investor data
 */
export const maskInvestorData = (investor: any, userRole: string, userId: string): any => {
    const isOwner = investor.userId === userId;
    const config = shouldMaskData(userRole, undefined, isOwner);

    const masked = { ...investor };

    if (config.maskFinancial) {
        // Mask portfolio values
        if (masked.portfolioValue) masked.portfolioValue = '***';
        if (masked.availableCapital) masked.availableCapital = '***';

        // Mask investment preferences
        if (masked.preferences && typeof masked.preferences === 'object') {
            if (masked.preferences.minInvestment) {
                masked.preferences = {
                    ...masked.preferences,
                    minInvestment: '***',
                    maxInvestment: '***'
                };
            }
        }
    }

    if (config.maskPersonal) {
        if (masked.nationalId) masked.nationalId = '***-***-' + masked.nationalId.slice(-4);
        if (masked.accreditationId) masked.accreditationId = '***';
    }

    if (config.maskPhone && masked.phone) {
        const phone = masked.phone.toString();
        masked.phone = phone.slice(0, 3) + '-***-' + phone.slice(-3);
    }

    if (config.maskEmail && masked.email) {
        const email = masked.email;
        const [local, domain] = email.split('@');
        masked.email = local.charAt(0) + '***@' + domain;
    }

    return masked;
};

/**
 * Specific masking for Deal data
 */
export const maskDealData = (deal: any, userRole: string, userId: string): any => {
    const isOwner = deal.createdBy === userId || deal.sme?.userId === userId;
    const config = shouldMaskData(userRole, undefined, isOwner);

    const masked = { ...deal };

    if (config.maskFinancial) {
        // Show approximate values only
        if (masked.amount) {
            const amount = parseInt(masked.amount.toString());
            const magnitude = Math.pow(10, amount.toString().length - 1);
            masked.amount = Math.floor(amount / magnitude) * magnitude;
            masked.amountApproximate = true;
        }

        if (masked.equity) {
            masked.equity = Math.floor(parseFloat(masked.equity) / 5) * 5; // Round to nearest 5%
            masked.equityApproximate = true;
        }

        if (masked.valuation) {
            masked.valuation = '***';
        }
    }

    return masked;
};

/**
 * Mask document metadata
 */
export const maskDocumentData = (document: any, userRole: string, userId: string): any => {
    const isOwner = document.uploadedBy === userId;
    const config = shouldMaskData(userRole, undefined, isOwner);

    const masked = { ...document };

    if (config.maskDocuments && !isOwner) {
        // Hide actual file paths/URLs for non-owners in certain roles
        if (userRole === 'SUPPORT') {
            masked.url = '[REDACTED]';
            masked.downloadUrl = '[REDACTED]';
        }
    }

    return masked;
};

export default {
    maskResponseData,
    maskSMEData,
    maskInvestorData,
    maskDealData,
    maskDocumentData
};
