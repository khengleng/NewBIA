
'use client'

import { useState } from 'react'
// Adjusted import path to match alias or relative if alias fails (but tsconfig says @/ is src/)
import { authorizedRequest } from '@/lib/api'

export default function ABAPaymentTest() {
    const [amount, setAmount] = useState('10.00')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [abaData, setAbaData] = useState<any>(null)

    const handleCreateTransaction = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setAbaData(null)

        try {
            // Use authorizedRequest which handles token and CSRF
            const res = await authorizedRequest('/api/payments/aba/create-transaction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    items: [{ name: 'Test Item', price: amount, quantity: 1 }]
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create transaction')
            }

            setAbaData(data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-md">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        ABA PayWay Test
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Simulate a payment transaction
                    </p>
                </div>

                {!abaData ? (
                    <form className="mt-8 space-y-6" onSubmit={handleCreateTransaction}>
                        <div>
                            <label htmlFor="amount" className="sr-only">
                                Amount (USD)
                            </label>
                            <input
                                id="amount"
                                name="amount"
                                type="number"
                                step="0.01"
                                required
                                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                                placeholder="Amount (USD)"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm text-center">{error}</div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                        >
                            {loading ? 'Processing...' : 'Generate Payment Link'}
                        </button>
                    </form>
                ) : (
                    <div className="mt-8 space-y-6">
                        <div className="bg-green-50 p-4 rounded-md">
                            <h3 className="text-green-800 font-medium">Transaction Created!</h3>
                            <p className="text-green-600 text-sm mt-1">
                                Transaction ID: {abaData.paymentId}
                            </p>
                        </div>

                        <form action={abaData.abaUrl} method="POST" target="_blank">
                            {Object.entries(abaData.abaRequest).map(([key, value]) => (
                                <input key={key} type="hidden" name={key} value={value as string} />
                            ))}
                            <button
                                type="submit"
                                className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                                Pay with ABA PayWay
                            </button>
                        </form>

                        <button
                            onClick={() => setAbaData(null)}
                            className="w-full mt-2 text-indigo-600 hover:text-indigo-500 text-sm"
                        >
                            Start New Transaction
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
