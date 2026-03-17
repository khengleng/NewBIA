/**
 * Two-Factor Authentication (2FA) Support
 * Implements TOTP (Time-based One-Time Password) for enhanced security
 */

import crypto from 'crypto';

// TOTP Configuration
const TOTP_PERIOD = 30; // 30 seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'sha1';

/**
 * Generate a random secret for TOTP
 * Returns base32-encoded secret for compatibility with authenticator apps
 */
export function generateTotpSecret(): string {
    const buffer = crypto.randomBytes(20);
    return base32Encode(buffer);
}

/**
 * Generate a TOTP code for a given secret and time
 */
export function generateTotpCode(secret: string, time: number = Date.now()): string {
    const counter = Math.floor(time / 1000 / TOTP_PERIOD);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));

    const decodedSecret = base32Decode(secret);
    const hmac = crypto.createHmac(TOTP_ALGORITHM, decodedSecret);
    hmac.update(counterBuffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, TOTP_DIGITS);
    return otp.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Verify a TOTP code
 * Allows for 1 period drift in either direction for clock skew tolerance
 */
export function verifyTotpCode(secret: string, code: string, window: number = 1): boolean {
    const now = Date.now();

    for (let i = -window; i <= window; i++) {
        const time = now + (i * TOTP_PERIOD * 1000);
        const expectedCode = generateTotpCode(secret, time);

        // Constant-time comparison to prevent timing attacks
        if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expectedCode))) {
            return true;
        }
    }

    return false;
}

/**
 * Generate a QR code URL for authenticator apps
 */
export function generateTotpQrUrl(
    secret: string,
    email: string,
    issuer: string = 'BoutiqueAdvisory'
): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    const encodedSecret = encodeURIComponent(secret);

    const otpauthUrl = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${encodedSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;

    // Return URL that can be used with QR code library
    return otpauthUrl;
}

/**
 * Generate backup codes for 2FA recovery
 */
export function generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
        // Generate 8-character alphanumeric codes
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
}

/**
 * Hash a backup code for secure storage
 */
export function hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code.replace('-', '')).digest('hex');
}

// Base32 encoding/decoding helpers
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
    let result = '';
    let bits = 0;
    let value = 0;

    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;

        while (bits >= 5) {
            result += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
            bits -= 5;
        }
    }

    if (bits > 0) {
        result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
    }

    return result;
}

function base32Decode(str: string): Buffer {
    const cleanStr = str.toUpperCase().replace(/=+$/, '');
    const bytes: number[] = [];
    let bits = 0;
    let value = 0;

    for (let i = 0; i < cleanStr.length; i++) {
        const idx = BASE32_ALPHABET.indexOf(cleanStr[i]);
        if (idx === -1) continue;

        value = (value << 5) | idx;
        bits += 5;

        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }

    return Buffer.from(bytes);
}

export default {
    generateTotpSecret,
    generateTotpCode,
    verifyTotpCode,
    generateTotpQrUrl,
    generateBackupCodes,
    hashBackupCode
};
