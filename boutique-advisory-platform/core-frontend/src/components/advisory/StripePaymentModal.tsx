'use client'

import { loadStripe } from '@stripe/stripe-js'
import {
    PaymentElement,
    Elements,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js'
import { useState } from 'react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_mock')

function CheckoutForm({ amount, onSuccess, onCancel }: { amount: number; onSuccess: () => void; onCancel: () => void }) {
    const stripe = useStripe()
    const elements = useElements()
    const [message, setMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!stripe || !elements) return

        setIsLoading(true)

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/advisory?payment_success=true`,
            },
            redirect: 'if_required',
        })

        if (error) {
            setMessage(error.message ?? 'An unexpected error occurred.')
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            onSuccess()
        }

        setIsLoading(false)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement className="bg-white p-4 rounded-lg" />
            <div className="flex gap-3">
                <button
                    disabled={isLoading || !stripe || !elements}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-all"
                >
                    {isLoading ? 'Processing...' : `Pay $${amount}`}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all"
                >
                    Cancel
                </button>
            </div>
            {message && <div className="text-red-400 text-sm mt-2 font-medium">{message}</div>}
        </form>
    )
}

export default function StripePaymentModal({
    amount,
    clientSecret,
    onSuccess,
    onAbaPay,
    onCancel,
    abaQrData, // New prop
}: {
    amount: number
    clientSecret: string
    onSuccess: () => void
    onAbaPay: () => void
    onCancel: () => void
    abaQrData?: { qrString: string; qrImage: string } | null
}) {
    const [isProcessing, setIsProcessing] = useState(false)

    // Detect mock payment mode
    const isMockPayment = clientSecret.startsWith('mock_')

    const handleMockPayment = async () => {
        setIsProcessing(true)
        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 1500))
        setIsProcessing(false)
        onSuccess()
    }

    // Render ABA QR Code State
    if (abaQrData) {
        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                <div className="bg-gray-800 border border-gray-700 p-8 rounded-2xl w-full max-w-md shadow-2xl text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">Scan to Pay</h2>
                    <p className="text-gray-400 mb-6">
                        Scan the ABA PayWay QR code below with your banking app.
                    </p>

                    <div className="bg-white p-4 rounded-xl inline-block mb-6">
                        {/* Display QR Image directly if provided as base64 or URL */}
                        <img
                            src={abaQrData.qrImage.startsWith('data:') ? abaQrData.qrImage : `data:image/png;base64,${abaQrData.qrImage}`}
                            alt="ABA PayWay QR"
                            className="w-64 h-64 object-contain"
                        />
                    </div>

                    <div className="bg-blue-900/30 text-blue-200 p-3 rounded-lg mb-6 text-sm animate-pulse">
                        Waiting for payment confirmation...
                    </div>

                    <p className="text-gray-500 text-xs mb-4">Transaction ID embedded in QR</p>

                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all"
                    >
                        Cancel Transaction
                    </button>
                </div>
            </div>
        );
    }

    // Mock payment UI (when Stripe is not configured)
    if (isMockPayment) {
        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                <div className="bg-gray-800 border border-gray-700 p-8 rounded-2xl w-full max-w-md shadow-2xl">
                    <h2 className="text-2xl font-bold text-white mb-2">Confirm Booking</h2>
                    <p className="text-gray-400 mb-6">
                        Confirm your booking for <span className="text-white font-semibold">${amount}</span>
                    </p>

                    <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <p className="text-yellow-500 font-semibold text-sm">Test Mode</p>
                                <p className="text-yellow-200/80 text-xs mt-1">
                                    Payment processing is in test mode. No real charges will be made.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleMockPayment}
                            disabled={isProcessing}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-all"
                        >
                            {isProcessing ? 'Processing...' : `Confirm Booking ($${amount})`}
                        </button>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-gray-600"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OR PAY WITH</span>
                            <div className="flex-grow border-t border-gray-600"></div>
                        </div>

                        <button
                            onClick={onAbaPay}
                            disabled={isProcessing}
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                            Pay with ABA PayWay
                        </button>

                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isProcessing}
                            className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all disabled:opacity-50 mt-2"
                        >
                            Cancel
                        </button>
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Configure Stripe for real payments</span>
                    </div>
                </div>
            </div>
        )
    }

    // Real Stripe payment UI
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-gray-800 border border-gray-700 p-8 rounded-2xl w-full max-w-md shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-2">Secure Payment</h2>
                <p className="text-gray-400 mb-8">Confirm your booking for <span className="text-white font-semibold">${amount}</span></p>

                <div className="mb-6">
                    <button
                        onClick={onAbaPay}
                        className="w-full mb-4 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                        Pay with ABA PayWay
                    </button>

                    <div className="relative flex py-2 items-center mb-4">
                        <div className="flex-grow border-t border-gray-600"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OR PAY WITH CARD</span>
                        <div className="flex-grow border-t border-gray-600"></div>
                    </div>
                </div>

                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
                    <CheckoutForm amount={amount} onSuccess={onSuccess} onCancel={onCancel} />
                </Elements>

                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Secured by Stripe SSL Encryption</span>
                </div>
            </div>
        </div>
    )
}
