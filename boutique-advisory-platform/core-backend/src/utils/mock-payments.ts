/**
 * Mock Payment & Identity Utilities
 * This file replaces the actual Stripe integration to simplify the platform 
 * and remove external dependencies.
 */

/**
 * KYC & Identity Utilities
 */
export const kyc = {
    /**
     * Create a Mock VerificationSession
     */
    async createVerificationSession(userId: string) {
        console.log('ℹ️  Mock KYC Session initiated for user:', userId);
        return {
            id: 'vs_mock_' + Date.now(),
            url: 'http://localhost:3000/kyc/mock-callback', // Mock URL
            status: 'requires_input',
            client_secret: 'vs_mock_secret_' + Date.now()
        };
    },

    async getVerificationSession(sessionId: string) {
        return {
            id: sessionId,
            status: 'verified',
            metadata: { userId: 'mock-user' }
        };
    }
};

/**
 * Escrow & Payment Utilities (Mocked)
 */
export const payments = {
    /**
     * Create a Mock Escrow PaymentIntent
     */
    async createEscrowIntent(amount: number, currency: string = 'usd', metadata: any) {
        console.log('ℹ️  Mock Payment Intent created:', { amount, currency, metadata });
        return {
            id: 'pi_mock_' + Date.now(),
            client_secret: 'pi_mock_secret_' + Date.now(),
            status: 'requires_payment_method'
        };
    },

    /**
     * Capture mock funds
     */
    async capturePayment(paymentIntentId: string) {
        console.log('✅ Mock Payment Captured:', paymentIntentId);
        return { id: paymentIntentId, status: 'succeeded' };
    },

    /**
     * Cancel mock funds
     */
    async cancelPayment(paymentIntentId: string) {
        console.log('❌ Mock Payment Cancelled:', paymentIntentId);
        return { id: paymentIntentId, status: 'canceled' };
    }
};

/**
 * Standard Mock Payment Intent
 */
export async function createPaymentIntent(amount: number, currency: string = 'usd') {
    return {
        id: 'pi_mock_' + Date.now(),
        client_secret: 'pi_mock_secret_' + Date.now(),
        status: 'requires_payment_method'
    };
}
