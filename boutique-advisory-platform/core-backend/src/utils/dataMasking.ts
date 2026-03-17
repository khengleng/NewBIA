/**
 * Data Masking Utility
 * Masks sensitive data based on user roles and data type
 */

export interface MaskingConfig {
    role: string;
    fieldType: 'email' | 'phone' | 'financial' | 'personal' | 'document' | 'custom';
    preserveLength?: boolean;
}

/**
 * Mask email address
 * Example: john.doe@example.com -> j***@example.com
 */
export function maskEmail(email: string, showDomain: boolean = true): string {
    if (!email || !email.includes('@')) return '***@***';

    const [localPart, domain] = email.split('@');
    const maskedLocal = localPart.charAt(0) + '***';

    if (showDomain) {
        return `${maskedLocal}@${domain}`;
    }

    return `${maskedLocal}@***`;
}

/**
 * Mask phone number
 * Example: +855-12-345-678 -> +855-**-***-678
 */
export function maskPhone(phone: string): string {
    if (!phone) return '***-***-***';

    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    const length = cleaned.length;

    if (length < 4) return '***';

    // Keep first 3 and last 3 digits
    const start = cleaned.substring(0, 3);
    const end = cleaned.substring(length - 3);
    const middle = '*'.repeat(Math.min(length - 6, 6));

    return `${start}-${middle}-${end}`;
}

/**
 * Mask financial amounts
 * Example: 1000000 -> $1,XXX,XXX
 */
export function maskFinancial(amount: number | string, showFirstDigit: boolean = true): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (isNaN(numAmount)) return '$***,***';

    const formatted = numAmount.toLocaleString('en-US');

    if (showFirstDigit) {
        // Show only the first digit and magnitude
        const firstDigit = formatted.charAt(0);
        const magnitude = formatted.length;
        return `$${firstDigit}${'X'.repeat(magnitude - 1)}`;
    }

    return '$***,***';
}

/**
 * Mask percentage values
 * Example: 25.5 -> 2X.X%
 */
export function maskPercentage(percentage: number): string {
    const str = percentage.toString();
    if (str.length === 0) return 'XX%';

    return str.charAt(0) + 'X'.repeat(str.length - 1) + '%';
}

/**
 * Mask personal identification numbers
 * Example: 123-456-7890 -> ***-***-7890
 */
export function maskPersonalId(id: string): string {
    if (!id) return '***-***-***';

    const length = id.length;
    if (length < 4) return '***';

    // Show only last 4 characters
    const masked = '*'.repeat(length - 4);
    const visible = id.substring(length - 4);

    return masked + visible;
}

/**
 * Mask bank account number
 * Example: 1234567890 -> ******7890
 */
export function maskBankAccount(account: string): string {
    if (!account) return '***';

    const length = account.length;
    if (length < 4) return '***';

    return '*'.repeat(length - 4) + account.substring(length - 4);
}

/**
 * Mask document IDs/numbers
 * Example: DOC-2024-001234 -> DOC-****-**1234
 */
export function maskDocumentId(docId: string): string {
    if (!docId) return '***-***';

    const parts = docId.split('-');
    if (parts.length < 2) {
        // No separators, just mask middle
        const length = docId.length;
        if (length < 4) return '***';
        return docId.substring(0, 2) + '*'.repeat(length - 4) + docId.substring(length - 2);
    }

    // Mask middle parts
    return parts.map((part, index) => {
        if (index === 0) return part; // Keep first part
        if (index === parts.length - 1) {
            // Last part - show last 4 chars
            return '*'.repeat(Math.max(0, part.length - 4)) + part.substring(Math.max(0, part.length - 4));
        }
        return '*'.repeat(part.length);
    }).join('-');
}

/**
 * Mask string based on role and sensitivity
 */
export function maskSensitiveString(value: string, visibleChars: number = 4): string {
    if (!value) return '***';

    const length = value.length;
    if (length <= visibleChars) return '*'.repeat(length);

    return '*'.repeat(length - visibleChars) + value.substring(length - visibleChars);
}

/**
 * Determine if data should be masked based on user role
 */
export function shouldMaskData(userRole: string, dataOwnerRole?: string, isOwner: boolean = false): {
    maskEmail: boolean;
    maskPhone: boolean;
    maskFinancial: boolean;
    maskPersonal: boolean;
    maskDocuments: boolean;
} {
    // SUPER_ADMIN sees everything
    if (userRole === 'SUPER_ADMIN') {
        return {
            maskEmail: false,
            maskPhone: false,
            maskFinancial: false,
            maskPersonal: false,
            maskDocuments: false,
        };
    }

    // ADMIN sees most things
    if (userRole === 'ADMIN') {
        return {
            maskEmail: false,
            maskPhone: false,
            maskFinancial: false,
            maskPersonal: true, // Mask personal IDs
            maskDocuments: false,
        };
    }

    // ADVISOR sees business data but not full personal data
    if (userRole === 'ADVISOR') {
        return {
            maskEmail: false,
            maskPhone: false,
            maskFinancial: false, // Can see financials for advisory
            maskPersonal: true,
            maskDocuments: false,
        };
    }

    // SUPPORT - read only, mask sensitive data
    if (userRole === 'SUPPORT') {
        return {
            maskEmail: true,
            maskPhone: true,
            maskFinancial: true,
            maskPersonal: true,
            maskDocuments: true,
        };
    }

    // SME and INVESTOR - see own data clearly, others masked
    if (userRole === 'SME' || userRole === 'INVESTOR') {
        if (isOwner) {
            // Own data - show everything
            return {
                maskEmail: false,
                maskPhone: false,
                maskFinancial: false,
                maskPersonal: false,
                maskDocuments: false,
            };
        }

        // Other users' data - mask sensitive info
        return {
            maskEmail: true,
            maskPhone: true,
            maskFinancial: true,
            maskPersonal: true,
            maskDocuments: true,
        };
    }

    // Default - mask everything
    return {
        maskEmail: true,
        maskPhone: true,
        maskFinancial: true,
        maskPersonal: true,
        maskDocuments: true,
    };
}

/**
 * Mask object fields based on configuration
 */
export function maskObject<T extends Record<string, unknown>>(
    obj: T,
    userRole: string,
    isOwner: boolean = false
): T {
    const config = shouldMaskData(userRole, undefined, isOwner);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const masked = { ...obj } as any;

    // Mask email fields
    if (config.maskEmail) {
        if (masked.email) masked.email = maskEmail(masked.email);
        if (masked.contactEmail) masked.contactEmail = maskEmail(masked.contactEmail);
    }

    // Mask phone fields
    if (config.maskPhone) {
        if (masked.phone) masked.phone = maskPhone(masked.phone);
        if (masked.mobile) masked.mobile = maskPhone(masked.mobile);
        if (masked.contactNumber) masked.contactNumber = maskPhone(masked.contactNumber);
    }

    // Mask financial fields
    if (config.maskFinancial) {
        if (masked.fundingRequired) masked.fundingRequired = maskFinancial(masked.fundingRequired);
        if (masked.amount) masked.amount = maskFinancial(masked.amount);
        if (masked.revenue) masked.revenue = maskFinancial(masked.revenue);
        if (masked.valuation) masked.valuation = maskFinancial(masked.valuation);
        if (masked.equity && typeof masked.equity === 'number') {
            masked.equity = maskPercentage(masked.equity);
        }
    }

    // Mask personal identification
    if (config.maskPersonal) {
        if (masked.nationalId) masked.nationalId = maskPersonalId(masked.nationalId);
        if (masked.taxId) masked.taxId = maskPersonalId(masked.taxId);
        if (masked.passportNumber) masked.passportNumber = maskPersonalId(masked.passportNumber);
        if (masked.accountNumber) masked.accountNumber = maskBankAccount(masked.accountNumber);
    }

    // Mask document IDs
    if (config.maskDocuments) {
        if (masked.documentId) masked.documentId = maskDocumentId(masked.documentId);
    }

    return masked as T;
}

/**
 * Mask array of objects
 */
export function maskArray<T extends Record<string, unknown>>(
    array: T[],
    userRole: string,
    ownerIdField: string = 'userId',
    currentUserId?: string
): T[] {
    return array.map(item => {
        const isOwner = currentUserId ? item[ownerIdField] === currentUserId : false;
        return maskObject(item, userRole, isOwner);
    });
}

/**
 * Audit log masking
 */
export function maskAuditLog(log: any, userRole: string): any {
    const masked = { ...log };

    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
        // Mask IP addresses
        if (masked.ipAddress) {
            const parts = masked.ipAddress.split('.');
            masked.ipAddress = `${parts[0]}.***.***.${parts[3] || '***'}`;
        }

        // Mask user agents
        if (masked.userAgent) {
            masked.userAgent = masked.userAgent.substring(0, 20) + '...';
        }
    }

    return masked;
}

/**
 * Export all masking functions
 */
export default {
    maskEmail,
    maskPhone,
    maskFinancial,
    maskPercentage,
    maskPersonalId,
    maskBankAccount,
    maskDocumentId,
    maskSensitiveString,
    shouldMaskData,
    maskObject,
    maskArray,
    maskAuditLog,
};
