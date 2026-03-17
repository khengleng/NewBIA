import axios from 'axios';
import * as crypto from 'crypto';

const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN;
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY;
const SUMSUB_LEVEL_NAME = process.env.SUMSUB_LEVEL_NAME || 'basic-kyc-level';
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY) {
    console.warn('⚠️ Sumsub credentials are missing in environment variables.');
}

/**
 * Sumsub API Utilities
 */
export const sumsub = {
    /**
     * Create an applicant in Sumsub
     */
    async createApplicant(externalUserId: string, levelName: string = SUMSUB_LEVEL_NAME) {
        const method = 'POST';
        const url = `/resources/applicants?levelName=${levelName}`;
        const body = {
            externalUserId,
        };

        const response = await this.makeRequest(method, url, body);
        return response.data;
    },

    /**
     * Generate an SDK Access Token for an applicant
     */
    /**
     * Generate an SDK Access Token for an applicant
     */
    async generateAccessToken(externalUserId: string, levelName: string = SUMSUB_LEVEL_NAME) {
        // Correct URL structure for Sumsub Access Token
        // POST /resources/accessTokens?userId=...&levelName=...&ttlInSecs=...
        const method = 'POST';
        const url = `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}&levelName=${encodeURIComponent(levelName)}`;

        // We do NOT pass a body for this request; query params are sufficient.
        // Important: 'this' context might be lost if destructured. 
        // Safer to refer to sumsub.makeRequest if kept in object, or better yet, use the internal helper if we refactor.
        // For now, assuming standard object usage:
        const response = await this.makeRequest(method, url);
        return response.data;
    },

    /**
     * Helper to sign and send requests to Sumsub
     */
    async makeRequest(method: string, url: string, body?: any) {
        if (!SUMSUB_APP_TOKEN || !SUMSUB_SECRET_KEY) {
            console.error('❌ Sumsub credentials missing! Check .env file.');
            throw new Error('Sumsub credentials missing');
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const requestBody = body ? JSON.stringify(body) : '';

        const signatureStr = timestamp + method.toUpperCase() + url + requestBody;
        const signature = crypto
            .createHmac('sha256', SUMSUB_SECRET_KEY)
            .update(signatureStr)
            .digest('hex');

        // console.log(`📡 Sumsub Request: ${method} ${SUMSUB_BASE_URL + url}`);

        try {
            return await axios({
                method,
                url: SUMSUB_BASE_URL + url,
                data: body || null, // Ensure explicit null if no body, though axios handles undefined
                headers: {
                    'Content-Type': 'application/json',
                    'X-App-Access-Ts': timestamp.toString(), // Ensure string
                    'X-App-Access-Sig': signature,
                    'X-App-Token': SUMSUB_APP_TOKEN,
                },
            });
        } catch (error: any) {
            // Log detailed Sumsub error response
            if (error.response) {
                console.error('❌ Sumsub API Error:', {
                    status: error.response.status,
                    data: error.response.data,
                    url: url
                });
            } else {
                console.error('❌ Sumsub Network/Unknown Error:', error.message);
            }
            throw error; // Re-throw to be caught by caller
        }
    }
};
