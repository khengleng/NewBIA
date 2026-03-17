import crypto from 'crypto';

// Use a consistent encryption key from environment in production
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
    console.warn('⚠️ WARNING: ENCRYPTION_KEY is not defined. Using a dummy key. Data encryption is insecure! Please set ENCRYPTION_KEY in production.');
}
const ACTIVE_KEY = ENCRYPTION_KEY || '0000000000000000000000000000000000000000000000000000000000000000';


const ALGORITHM = 'aes-256-gcm';

// Standard IV length for GCM is 12 bytes (96 bits)
const IV_LENGTH = 12;

/**
 * Encrypts a string using AES-256-GCM
 * Returns: IV:AuthTag:EncryptedData
 */
export function encrypt(text: string): string {
    if (!text) return text;

    // Generate a random IV for each encryption
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Buffer.from(ACTIVE_KEY, 'hex');

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Return IV:AuthTag:EncryptedData
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string using AES-256-GCM
 * Input format: IV:AuthTag:EncryptedData
 */
export function decrypt(text: string): string {
    if (!text || !text.includes(':')) return text;

    try {
        const parts = text.split(':');
        if (parts.length !== 3) {
            // Not a valid encrypted string format
            return text;
        }

        const [ivHex, authTagHex, encryptedHex] = parts;

        const key = Buffer.from(ACTIVE_KEY, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        // For GCM, update returns the plaintext
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        // Silent failure - assume it wasn't encrypted or key is wrong
        // This allows legacy (non-encrypted) data to flow through unmolested
        return text;
    }
}

/**
 * Helper to encrypt sensitive fields in an object
 */
export function encryptFields(obj: any, fields: string[]): any {
    if (!obj) return obj;
    const newObj = { ...obj };

    fields.forEach(field => {
        if (newObj[field] && typeof newObj[field] === 'string') {
            newObj[field] = encrypt(newObj[field]);
        }
    });

    return newObj;
}

/**
 * Helper to decrypt sensitive fields in an object
 */
export function decryptFields(obj: any, fields: string[]): any {
    if (!obj) return obj;
    const newObj = { ...obj };

    fields.forEach(field => {
        if (newObj[field] && typeof newObj[field] === 'string') {
            newObj[field] = decrypt(newObj[field]);
        }
    });

    return newObj;
}
