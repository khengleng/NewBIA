'use client'

import { useState } from 'react'
import { authorizedRequest } from '../lib/api'
import { useToast } from '../contexts/ToastContext'
import { X, DollarSign, Loader2 } from 'lucide-react'

interface SellPositionModalProps {
    investmentId: string
    parentId: string
    type: 'DEAL' | 'SYNDICATE' | 'LAUNCHPAD'
    dealName: string
    currentValue: number
    onClose: () => void
    onSuccess: () => void
}

export default function SellPositionModal({ investmentId, parentId, type, dealName, currentValue, onClose, onSuccess }: SellPositionModalProps) {
    const { addToast } = useToast()
    const [amount, setAmount] = useState<string>('')
    const [price, setPrice] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Robust parsing: Strip commas or dollar signs
        const cleanAmount = amount.replace(/[^0-9.]/g, '')
        const cleanPrice = price.replace(/[^0-9.]/g, '')

        const qtyToSell = parseFloat(cleanAmount)
        const pricePerUnit = parseFloat(cleanPrice)

        if (isNaN(qtyToSell) || qtyToSell <= 0) {
            addToast('error', `Please enter a valid ${type === 'SYNDICATE' ? 'token count' : 'amount'} to sell`)
            return
        }

        if (qtyToSell > (currentValue || 0)) {
            addToast('error', `You only have ${type === 'SYNDICATE' ? '' : '$'}${(currentValue || 0).toLocaleString()} available to sell`)
            return
        }

        if (isNaN(pricePerUnit) || pricePerUnit <= 0) {
            addToast('error', 'Please enter a valid price per unit')
            return
        }

        setIsLoading(true)

        try {
            const isSyndicate = type === 'SYNDICATE'
            const endpoint = isSyndicate ? '/api/syndicate-tokens/listings' : '/api/secondary-trading/listings'

            const payload: any = isSyndicate ? {
                syndicateId: parentId,
                tokensAvailable: qtyToSell,
                pricePerToken: pricePerUnit,
                minTokens: 1
            } : {
                dealInvestorId: investmentId,
                sharesAvailable: qtyToSell,
                pricePerShare: pricePerUnit,
                minPurchase: Math.min(100, qtyToSell)
            }

            const response = await authorizedRequest(endpoint, {
                method: 'POST',
                body: JSON.stringify(payload)
            })

            if (response.ok) {
                addToast('success', 'Position listed for sale successfully')
                onSuccess()
            } else {
                const data = await response.json()
                addToast('error', data.error || 'Failed to create listing')
            }
        } catch (error) {
            console.error('Error creating listing:', error)
            addToast('error', 'An error occurred while creating listing')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
                    <div>
                        <h3 className="text-xl font-bold text-white">Sell Position</h3>
                        <p className="text-sm text-gray-400 mt-1">{dealName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-blue-300">{type === 'SYNDICATE' ? 'Tokens Available' : 'Available to Sell'}</span>
                            <span className="text-lg font-bold text-white">{type === 'SYNDICATE' ? '' : '$'}{(currentValue || 0).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-blue-400/60">
                            {type === 'SYNDICATE' ? 'Your approved syndicate tokens eligible for secondary trading.' : 'Your principal investment amount eligible for secondary trading.'}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {type === 'SYNDICATE' ? 'Number of Tokens to Sell' : 'Amount to Sell ($)'}
                            </label>
                            <div className="relative">
                                {type !== 'SYNDICATE' && <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />}
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder={type === 'SYNDICATE' ? "100" : "5000"}
                                    className={`w-full bg-gray-900 border border-gray-700 rounded-xl ${type === 'SYNDICATE' ? 'px-4' : 'px-10'} py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all`}
                                    min="1"
                                    max={currentValue}
                                />
                            </div>
                            {type === 'SYNDICATE' && amount && (
                                <p className={`text-xs mt-2 font-medium ${parseFloat(amount) > currentValue ? 'text-red-400' : 'text-green-400'}`}>
                                    {parseFloat(amount) > currentValue ? '⚠️ ' : '✓ '}
                                    {parseFloat(amount).toLocaleString()} tokens out of {currentValue.toLocaleString()} available
                                    {parseFloat(amount) <= currentValue && ` • ${(currentValue - parseFloat(amount)).toLocaleString()} remaining`}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {type === 'SYNDICATE' ? 'Price Per Token ($)' : 'Price Per Unit ($1 Principal)'}
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="1.10"
                                    step="0.01"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-10 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                {type === 'SYNDICATE' ? 'Example: Enter 1.50 to sell tokens at $1.50 each.' : 'Example: Enter 1.10 to sell for a 10% premium.'}
                            </p>
                        </div>
                    </div>

                    {amount && price && (
                        <div className="bg-gray-700/30 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">{type === 'SYNDICATE' ? 'Tokens to Sell' : 'Amount to Sell'}</span>
                                <span className="text-white font-medium">{parseFloat(amount).toLocaleString()} {type === 'SYNDICATE' ? 'tokens' : ''}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Price Per {type === 'SYNDICATE' ? 'Token' : 'Unit'}</span>
                                <span className="text-white font-medium">${parseFloat(price).toLocaleString()}</span>
                            </div>
                            <div className="border-t border-gray-600/50 my-2 pt-2 flex justify-between text-sm">
                                <span className="text-gray-400">Total Sale Value</span>
                                <span className="text-white font-bold">${(parseFloat(amount) * parseFloat(price)).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Estimated Fees (1%)</span>
                                <span className="text-white font-medium">${(parseFloat(amount) * parseFloat(price) * 0.01).toLocaleString()}</span>
                            </div>
                            <div className="border-t border-gray-600/50 my-2 pt-2 flex justify-between font-bold">
                                <span className="text-gray-300">Net Proceeds</span>
                                <span className="text-green-400">${(parseFloat(amount) * parseFloat(price) * 0.99).toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Listing...
                            </>
                        ) : (
                            'List for Sale'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
