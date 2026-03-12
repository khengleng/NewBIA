'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'
import { Star, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import usePermissions from '../../../hooks/usePermissions'
import { isTradingOperatorRole, normalizeRole } from '../../../lib/roles'

interface WatchlistListing {
    id: string
    pricePerShare: number
    sharesAvailable: number
    minPurchase: number
    totalValue: number
    returnPercentage: number
    status: string
    deal?: {
        title?: string
        sme?: {
            name?: string
            sector?: string
            stage?: string
            score?: number
        }
    }
}

export default function TradingWatchlistPage() {
    const router = useRouter()
    const { user, isLoading: isRoleLoading } = usePermissions()
    const { addToast } = useToast()
    const [listings, setListings] = useState<WatchlistListing[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const load = useCallback(async () => {
        setIsLoading(true)
        const response = await authorizedRequest('/api/secondary-trading/watchlist')
        setIsLoading(false)
        if (!response.ok) {
            if (response.status === 404) {
                setListings([])
                return
            }
            addToast('error', 'Failed to load watchlist')
            return
        }

        const data = await response.json()
        setListings(data.listings || [])
    }, [addToast])

    useEffect(() => {
        if (isRoleLoading) return
        const role = normalizeRole(user?.role)
        if (isTradingOperatorRole(role)) {
            router.replace('/trading/markets')
            return
        }
        load()
    }, [isRoleLoading, load, router, user?.role])

    if (isRoleLoading) {
        return (
            <DashboardLayout>
                <div className="text-gray-300">Loading watchlist...</div>
            </DashboardLayout>
        )
    }

    const removeFromWatchlist = async (id: string) => {
        const remaining = listings.filter(l => l.id !== id).map(l => l.id)
        const response = await authorizedRequest('/api/secondary-trading/watchlist', {
            method: 'PUT',
            body: JSON.stringify({ listingIds: remaining })
        })
        if (!response.ok) {
            addToast('error', 'Failed to update watchlist')
            return
        }
        setListings(prev => prev.filter(l => l.id !== id))
    }

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <Star className="w-8 h-8 text-yellow-400" />
                        Trading Watchlist
                    </h1>
                    <p className="text-gray-400 mt-1">Track shortlisted listings and execute trades when price is right.</p>
                </div>

                {isLoading ? (
                    <div className="text-gray-300">Loading watchlist...</div>
                ) : listings.length === 0 ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center text-gray-400">
                        No listings in watchlist.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {listings.map((listing) => (
                            <div key={listing.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-white font-semibold">{listing.deal?.sme?.name || 'SME'}</h3>
                                        <p className="text-gray-400 text-sm">{listing.deal?.title || 'Listing'}</p>
                                    </div>
                                    <button
                                        onClick={() => removeFromWatchlist(listing.id)}
                                        className="text-yellow-400 hover:text-yellow-300"
                                        title="Remove from watchlist"
                                    >
                                        <Star className="w-5 h-5 fill-current" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                                    <div className="bg-gray-900/50 rounded-lg p-2">
                                        <p className="text-gray-500">Price</p>
                                        <p className="text-white font-semibold">${(listing.pricePerShare || 0).toFixed(2)}</p>
                                    </div>
                                    <div className="bg-gray-900/50 rounded-lg p-2">
                                        <p className="text-gray-500">Liquidity</p>
                                        <p className="text-white font-semibold">{(listing.sharesAvailable || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-gray-900/50 rounded-lg p-2">
                                        <p className="text-gray-500">Return</p>
                                        <p className={`font-semibold ${(listing.returnPercentage || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {(listing.returnPercentage || 0).toFixed(2)}%
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-500">
                                        Sector: {listing.deal?.sme?.sector || 'N/A'} | Stage: {listing.deal?.sme?.stage || 'N/A'}
                                    </p>
                                    <Link
                                        href="/secondary-trading"
                                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm flex items-center gap-1"
                                    >
                                        <ShoppingCart className="w-4 h-4" />
                                        Trade
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
