import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const APP_NAME = 'Boutique Advisory';

/**
 * Generate a temporary MFA secret for a user
 */
export const generateMfaSecret = (email: string) => {
    const secret = speakeasy.generateSecret({
        length: 20,
        name: `${APP_NAME} (${email})`,
        issuer: APP_NAME
    });

    return {
        ascii: secret.ascii,
        hex: secret.hex,
        base32: secret.base32,
        otpauth_url: secret.otpauth_url
    };
};

/**
 * Generate a QR code data URL from the setup URL
 */
export const generateQrCode = async (otpauthUrl: string): Promise<string> => {
    try {
        return await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw new Error('Failed to generate QR code');
    }
};

/**
 * Verify a time-based token against a secret
 */
export const verifyMfaToken = (secret: string, token: string, window: number = 2): boolean => {
    // Basic verification
    const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window // Allow time drift (2 steps = +/- 60 seconds)
    });

    return verified;
};

/**
 * Generate a list of backup codes
 */
export const generateBackupCodes = (count: number = 10): string[] => {
    const codes: string[] = [];
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';

    for (let i = 0; i < count; i++) {
        let code = '';
        for (let j = 0; j < 10; j++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        codes.push(code);
    }

    return codes;
};
