'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Search, Sparkles, Star, TrendingDown, TrendingUp } from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import usePermissions from '@/hooks/usePermissions'
import { isTradingOperatorRole, normalizeRole } from '@/lib/roles'

interface Listing {
    id: string
    sharesAvailable: number
    pricePerShare: number
    minPurchase: number
    listedAt: string
    status: string
    deal: {
        id: string
        title: string
        sme: {
            id: string
            name: string
            sector?: string
            stage?: string
            score?: number
        }
    }
}

interface MarketRow extends Listing {
    syntheticChange24h: number
    syntheticVolume24h: number
    syntheticMarketCap: number
}

const hashSeed = (value: string) => {
    let hash = 0
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) % 100000
    }
    return hash
}

const deriveMetrics = (listing: Listing): Pick<MarketRow, 'syntheticChange24h' | 'syntheticVolume24h' | 'syntheticMarketCap'> => {
    const seed = hashSeed(listing.id)
    const signed = ((seed % 2001) - 1000) / 100
    const change = Math.max(-18, Math.min(24, signed))

    const liquidity = Number(listing.sharesAvailable || 0) * Number(listing.pricePerShare || 0)
    const volumeFactor = 0.6 + (seed % 120) / 100
    const volume24h = liquidity * volumeFactor

    const capFactor = 2.5 + ((seed % 70) / 20)
    const marketCap = liquidity * capFactor

    return {
        syntheticChange24h: Number(change.toFixed(2)),
        syntheticVolume24h: Number(volume24h.toFixed(2)),
        syntheticMarketCap: Number(marketCap.toFixed(2))
    }
}

export default function TradingMarketsPage() {
    const { addToast } = useToast()
    const { user } = usePermissions()
    const [isLoading, setIsLoading] = useState(true)
    const [query, setQuery] = useState('')
    const [listings, setListings] = useState<Listing[]>([])
    const [watchlistIds, setWatchlistIds] = useState<string[]>([])
    const [segment, setSegment] = useState<'all' | 'gainers' | 'losers' | 'new'>('all')

    const role = normalizeRole(user?.role)
    const isOperator = isTradingOperatorRole(role)

    useEffect(() => {
        const load = async () => {
            try {
                const listingsRes = await authorizedRequest('/api/secondary-trading/listings')

                if (listingsRes.ok) {
                    const data = await listingsRes.json()
                    setListings(Array.isArray(data) ? data : [])
                }

                if (!isOperator) {
                    const watchlistRes = await authorizedRequest('/api/secondary-trading/watchlist')
                    if (watchlistRes.ok) {
                        const data = await watchlistRes.json()
                        setWatchlistIds(Array.isArray(data.listingIds) ? data.listingIds : [])
                    }
                }
            } catch (error) {
                console.error('Failed to load trading markets', error)
                addToast('error', 'Failed to load market data')
            } finally {
                setIsLoading(false)
            }
        }

        load()
    }, [addToast, isOperator])

    const marketRows = useMemo<MarketRow[]>(() => {
        return listings.map((listing) => ({
            ...listing,
            ...deriveMetrics(listing)
        }))
    }, [listings])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        let rows = marketRows

        if (q) {
            rows = rows.filter((listing) => {
                const name = listing.deal?.sme?.name?.toLowerCase() || ''
                const title = listing.deal?.title?.toLowerCase() || ''
                const sector = listing.deal?.sme?.sector?.toLowerCase() || ''
                return name.includes(q) || title.includes(q) || sector.includes(q)
            })
        }

        if (segment === 'gainers') {
            rows = rows.filter((row) => row.syntheticChange24h > 0).sort((a, b) => b.syntheticChange24h - a.syntheticChange24h)
        }

        if (segment === 'losers') {
            rows = rows.filter((row) => row.syntheticChange24h < 0).sort((a, b) => a.syntheticChange24h - b.syntheticChange24h)
        }

        if (segment === 'new') {
            rows = rows.sort((a, b) => new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime())
        }

        if (segment === 'all') {
            rows = rows.sort((a, b) => b.syntheticVolume24h - a.syntheticVolume24h)
        }

        return rows
    }, [marketRows, query, segment])

    const topVolume = useMemo(() => {
        return [...marketRows].sort((a, b) => b.syntheticVolume24h - a.syntheticVolume24h).slice(0, 5)
    }, [marketRows])

    const topMovers = useMemo(() => {
        return [...marketRows].sort((a, b) => b.syntheticChange24h - a.syntheticChange24h).slice(0, 5)
    }, [marketRows])

    const tickerTape = useMemo(() => {
        return [...marketRows].sort((a, b) => Math.abs(b.syntheticChange24h) - Math.abs(a.syntheticChange24h)).slice(0, 8)
    }, [marketRows])

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Markets</h1>
                        <p className="text-gray-400 mt-1">
                            {isOperator
                                ? 'Operator view for market performance, depth, and listing health.'
                                : 'Binance-style market scanner for tokenized SME trading pairs.'}
                        </p>
                    </div>
                    {!isOperator && (
                        <Link
                            href="/secondary-trading"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500 text-blue-300 hover:bg-blue-500/10"
                        >
                            Open Marketplace
                            <ArrowUpRight className="w-4 h-4" />
                        </Link>
                    )}
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 overflow-x-auto">
                    <div className="flex items-center gap-3 min-w-max">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">Hot Pairs</span>
                        {tickerTape.map((row) => (
                            <div key={row.id} className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-900/60 text-xs">
                                <p className="text-gray-200 font-medium">{row.deal?.sme?.name || 'SME'}/USDT</p>
                                <p className={row.syntheticChange24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    {row.syntheticChange24h >= 0 ? '+' : ''}{row.syntheticChange24h.toFixed(2)}%
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by SME, deal, or sector"
                            className="w-full pl-10 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'all', label: 'All Markets' },
                            { id: 'gainers', label: 'Top Gainers' },
                            { id: 'losers', label: 'Top Losers' },
                            { id: 'new', label: 'New Listings' }
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setSegment(item.id as typeof segment)}
                                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${segment === item.id
                                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                                    : 'bg-gray-900 border-gray-700 text-gray-300 hover:text-white'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-8 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                            <h2 className="text-white font-semibold">Market Pairs</h2>
                            <span className="text-sm text-gray-400">{filtered.length} pairs</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[860px]">
                                <thead className="bg-gray-900 text-gray-400">
                                    <tr>
                                        <th className="text-left px-4 py-3">Pair</th>
                                        <th className="text-right px-4 py-3">Last Price</th>
                                        <th className="text-right px-4 py-3">24h %</th>
                                        <th className="text-right px-4 py-3">24h Volume</th>
                                        <th className="text-right px-4 py-3">Liquidity</th>
                                        <th className="text-right px-4 py-3">Min Order</th>
                                        <th className="text-right px-4 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr><td colSpan={7} className="text-center text-gray-400 py-10">Loading markets...</td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center text-gray-400 py-10">No markets found</td></tr>
                                    ) : filtered.map((listing) => (
                                        <tr key={listing.id} className="border-t border-gray-700">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-white font-medium">{listing.deal?.sme?.name || 'SME'}/USDT</p>
                                                    {!isOperator && watchlistIds.includes(listing.id) && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                                                </div>
                                                <p className="text-xs text-gray-400">{listing.deal?.sme?.sector || 'General'} • {listing.deal?.sme?.stage || 'Active'}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right text-white">${Number(listing.pricePerShare || 0).toFixed(2)}</td>
                                            <td className={`px-4 py-3 text-right font-medium ${listing.syntheticChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {listing.syntheticChange24h >= 0 ? '+' : ''}{listing.syntheticChange24h.toFixed(2)}%
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-200">${(listing.syntheticVolume24h / 1000).toFixed(1)}K</td>
                                            <td className="px-4 py-3 text-right text-gray-300">${(listing.sharesAvailable * listing.pricePerShare).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right text-gray-300">{Number(listing.minPurchase || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right">
                                                {isOperator ? (
                                                    <span className="inline-flex px-3 py-1.5 rounded-md bg-gray-700 text-gray-200">
                                                        Monitor
                                                    </span>
                                                ) : (
                                                    <Link
                                                        href={`/trading/terminal/${listing.id}`}
                                                        className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white"
                                                    >
                                                        Trade
                                                    </Link>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl">
                            <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-green-400" />
                                <h2 className="text-white font-semibold">Top Movers</h2>
                            </div>
                            <div className="p-4 space-y-2">
                                {topMovers.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No active listings.</p>
                                ) : topMovers.map((listing) => (
                                    <div key={listing.id} className="rounded-lg border border-gray-700 p-3 bg-gray-900/40">
                                        <div className="flex items-center justify-between">
                                            <p className="text-white font-medium text-sm">{listing.deal?.sme?.name || 'SME'}/USDT</p>
                                            <p className={listing.syntheticChange24h >= 0 ? 'text-green-400 text-sm font-medium' : 'text-red-400 text-sm font-medium'}>
                                                {listing.syntheticChange24h >= 0 ? '+' : ''}{listing.syntheticChange24h.toFixed(2)}%
                                            </p>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Vol ${(listing.syntheticVolume24h / 1000).toFixed(1)}K</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gray-800 border border-gray-700 rounded-xl">
                            <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-cyan-400" />
                                <h2 className="text-white font-semibold">Most Active</h2>
                            </div>
                            <div className="p-4 space-y-2">
                                {topVolume.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No active listings.</p>
                                ) : topVolume.map((listing) => (
                                    <div key={listing.id} className="rounded-lg border border-gray-700 p-3 bg-gray-900/40">
                                        <div className="flex items-center justify-between">
                                            <p className="text-white font-medium text-sm">{listing.deal?.sme?.name || 'SME'}/USDT</p>
                                            <p className="text-cyan-300 text-sm font-medium">${(listing.syntheticVolume24h / 1000).toFixed(1)}K</p>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Mkt Cap ${(listing.syntheticMarketCap / 1000).toFixed(1)}K</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {isOperator && (
                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-amber-300 mb-2">
                                    <TrendingDown className="w-4 h-4" />
                                    <p className="font-medium">Operator Note</p>
                                </div>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Use this panel as live market intelligence. Listing approvals, trading controls, and surveillance actions are managed in Trading Ops and Compliance modules.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
