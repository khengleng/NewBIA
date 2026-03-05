'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeftRight,
    TrendingUp,
    DollarSign,
    BarChart3,
    Clock,
    CheckCircle2,
    AlertCircle,
    Search,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Briefcase,
    ShoppingCart,
    X,
    Star
} from 'lucide-react'
import Link from 'next/link'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import usePermissions from '../../hooks/usePermissions'
import { isTradingOperatorRole } from '../../lib/roles'

import { authorizedRequest } from '../../lib/api'

interface Listing {
    id: string
    sellerId: string
    seller: {
        id: string
        name: string
        type: string
    }
    deal: {
        id: string
        title: string
        sme: {
            id: string
            name: string
            sector?: string
            stage?: string
            score?: number
            certified?: boolean
        }
    }
    originalInvestment: number
    sharesOwned: number
    sharesAvailable: number
    pricePerShare: number
    originalPricePerShare: number
    minPurchase: number
    totalValue: number
    returnPercentage: number
    status: string
    listedAt: string
    expiresAt: string
    isOwner?: boolean
}

interface RecentMarketTrade {
    id: string
    listingId: string
    pricePerShare: number
    shares: number
    totalAmount: number
    executedAt: string
    deal: {
        id: string
        title: string
        sme: {
            id: string
            name: string
            sector?: string
        }
    } | null
}


interface Trade {
    id: string
    listingId: string
    buyerId: string
    buyer: { id: string; name: string }
    sellerId: string
    seller: { id: string; name: string }
    shares: number
    pricePerShare: number
    totalAmount: number
    fee: number
    netAmount: number
    status: string
    executedAt: string | null
    createdAt: string
    listing: {
        dealInvestor: {
            deal: {
                id: string
                title: string
                sme: { id: string; name: string }
            }
        }
    }
}

interface MarketStats {
    activeListings: number
    totalListingValue: number
    completedTrades: number
    totalVolume: number
    totalFees: number
    avgTradeSize: number
    avgReturn: number
    last24hVolume: number
    last7dVolume: number
}

interface SyndicateTokenListing {
    id: string
    syndicateId: string
    sellerId: string
    seller: {
        id: string
        name: string
        type: string
    }
    syndicate: {
        id: string
        name: string
        tokenName: string
        tokenSymbol: string
        pricePerToken: number
    }
    tokensAvailable: number
    pricePerToken: number
    minTokens: number
    status: string
    listedAt: string
    expiresAt: string | null
    isOwner?: boolean
}

interface SyndicateTokenTrade {
    id: string
    listingId: string
    buyerId: string
    buyer: { id: string; name: string }
    sellerId: string
    seller: { id: string; name: string }
    tokens: number
    pricePerToken: number
    totalAmount: number
    fee: number
    status: string
    executedAt: string | null
    createdAt: string
    listing: {
        syndicate: {
            id: string
            name: string
            tokenSymbol: string
        }
    }
}

export default function SecondaryTradingPage() {
    const { addToast } = useToast()
    const { isInvestor, user, isLoading: isRoleLoading } = usePermissions()
    const router = useRouter()
    const simulateSecondaryTrades = process.env.NEXT_PUBLIC_SIMULATE_SECONDARY_TRADES === 'true'

    const [listings, setListings] = useState<Listing[]>([])
    const [myTrades, setMyTrades] = useState<{ purchases: Trade[], sales: Trade[] }>({ purchases: [], sales: [] })
    const [stats, setStats] = useState<MarketStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'marketplace' | 'syndicate-tokens' | 'my-trades' | 'sell'>('marketplace')
    const [showBuyModal, setShowBuyModal] = useState(false)
    const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
    const [buyShares, setBuyShares] = useState('')
    const [isBuying, setIsBuying] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<'latest' | 'bestReturn' | 'lowestPrice' | 'highestPrice' | 'mostLiquid'>('latest')
    const [showOnlyProfitable, setShowOnlyProfitable] = useState(false)
    const [watchlistIds, setWatchlistIds] = useState<string[]>([])
    const [recentTrades, setRecentTrades] = useState<RecentMarketTrade[]>([])

    // Syndicate token state
    const [tokenListings, setTokenListings] = useState<SyndicateTokenListing[]>([])
    const [myTokenTrades, setMyTokenTrades] = useState<{ purchases: SyndicateTokenTrade[], sales: SyndicateTokenTrade[] }>({ purchases: [], sales: [] })
    const [showBuyTokenModal, setShowBuyTokenModal] = useState(false)
    const [selectedTokenListing, setSelectedTokenListing] = useState<SyndicateTokenListing | null>(null)
    const [buyTokens, setBuyTokens] = useState('')
    const [isBuyingTokens, setIsBuyingTokens] = useState(false)
    const [currentInvestorId, setCurrentInvestorId] = useState<string | null>(null)
    const userRole = String(user?.role || '').toUpperCase()
    const isTradingOperator = isTradingOperatorRole(userRole)

    useEffect(() => {
        if (isRoleLoading) return
        if (isTradingOperator) {
            router.replace('/trading/markets')
        }
    }, [isRoleLoading, isTradingOperator, router])

    const fetchData = useCallback(async () => {
        if (isTradingOperator) {
            setIsLoading(false)
            return
        }

        try {
            const meRes = await authorizedRequest('/api/auth/me')
            if (meRes.status === 401) {
                router.push('/auth/login')
                return
            }

            // Fetch current investor ID if user is an investor
            if (isInvestor) {
                try {
                    const profileRes = await authorizedRequest('/api/investors/profile')
                    if (profileRes.ok) {
                        const profile = await profileRes.json()
                        setCurrentInvestorId(profile?.investor?.id || profile?.id || null)
                    } else if (profileRes.status === 404) {
                        console.warn('Investor profile not found - record may be in creation or missing.')
                        setCurrentInvestorId(null)
                    }
                } catch (err) {
                    console.error('Failed to fetch investor profile', err)
                }
            }

            // Fetch listings
            const listingsRes = await authorizedRequest('/api/secondary-trading/listings')
            if (listingsRes.ok) {
                setListings(await listingsRes.json())
            } else if (listingsRes.status === 401) {
                router.push('/auth/login')
                return
            } else {
                console.error('Failed to fetch listings:', listingsRes.status)
                addToast('error', 'Failed to load deal listings')
            }

            // Fetch my trades
            const tradesRes = await authorizedRequest('/api/secondary-trading/trades/my')
            if (tradesRes.ok) {
                setMyTrades(await tradesRes.json())
            } else if (tradesRes.status === 401) {
                router.push('/auth/login')
                return
            }

            // Fetch stats
            const statsRes = await authorizedRequest('/api/secondary-trading/stats')
            if (statsRes.ok) {
                setStats(await statsRes.json())
            } else if (statsRes.status === 401) {
                router.push('/auth/login')
                return
            }

            // Fetch syndicate token listings
            const tokenListingsRes = await authorizedRequest('/api/syndicate-tokens/listings')
            if (tokenListingsRes.ok) {
                setTokenListings(await tokenListingsRes.json())
            } else if (tokenListingsRes.status === 401) {
                router.push('/auth/login')
                return
            }

            // Fetch my token trades
            const tokenTradesRes = await authorizedRequest('/api/syndicate-tokens/trades/my')
            if (tokenTradesRes.ok) {
                setMyTokenTrades(await tokenTradesRes.json())
            } else if (tokenTradesRes.status === 401) {
                router.push('/auth/login')
                return
            }

            const [watchlistRes, recentTradesRes] = await Promise.all([
                authorizedRequest('/api/secondary-trading/watchlist'),
                authorizedRequest('/api/secondary-trading/trades/recent?limit=25')
            ])

            if (watchlistRes.ok) {
                const watchlistPayload = await watchlistRes.json()
                setWatchlistIds(Array.isArray(watchlistPayload.listingIds) ? watchlistPayload.listingIds : [])
            }

            if (recentTradesRes.ok) {
                const tradePayload = await recentTradesRes.json()
                setRecentTrades(Array.isArray(tradePayload.trades) ? tradePayload.trades : [])
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            addToast('error', 'Error loading marketplace. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }, [addToast, isInvestor, isTradingOperator, router])

    useEffect(() => {
        if (isRoleLoading || isTradingOperator) return
        fetchData()
    }, [fetchData, isRoleLoading, isTradingOperator])

    const handleBuyClick = (listing: Listing) => {
        setSelectedListing(listing)
        setBuyShares(listing.minPurchase.toString())
        setShowBuyModal(true)
    }

    const handleBuyShares = async () => {
        if (!selectedListing) return
        setIsBuying(true)

        try {
            const response = await authorizedRequest(`/api/secondary-trading/listings/${selectedListing.id}/buy`, {
                method: 'POST',
                body: JSON.stringify({
                    shares: parseFloat(buyShares),
                    simulate_payment: simulateSecondaryTrades
                })
            })

            if (response.ok) {
                const payload = await response.json()
                if (payload?.abaRequest) {
                    addToast('success', 'Purchase created. Complete ABA payment to settle trade.')
                } else {
                    addToast('success', 'Purchase initiated successfully!')
                }
                setShowBuyModal(false)
                fetchData()
            } else {
                const error = await response.json()
                addToast('error', error.error || 'Failed to buy shares')
            }
        } catch (error) {
            console.error('Error buying shares:', error)
            addToast('error', 'Error processing purchase')
        } finally {
            setIsBuying(false)
        }
    }

    const handleBuyTokenClick = (listing: SyndicateTokenListing) => {
        setSelectedTokenListing(listing)
        setBuyTokens(listing.minTokens.toString())
        setShowBuyTokenModal(true)
    }

    const handleBuyTokens = async () => {
        if (!selectedTokenListing) return
        setIsBuyingTokens(true)

        try {
            const response = await authorizedRequest('/api/syndicate-tokens/buy', {
                method: 'POST',
                body: JSON.stringify({
                    listingId: selectedTokenListing.id,
                    tokens: parseFloat(buyTokens)
                })
            })

            if (response.ok) {
                addToast('success', 'Tokens purchased successfully!')
                setShowBuyTokenModal(false)
                fetchData()
            } else {
                const error = await response.json()
                addToast('error', error.error || 'Failed to buy tokens')
            }
        } catch (error) {
            console.error('Error buying tokens:', error)
            addToast('error', 'Error processing purchase')
        } finally {
            setIsBuyingTokens(false)
        }
    }

    const handleCancelListing = async (listingId: string) => {
        if (!confirm('Are you sure you want to cancel this listing?')) return

        try {
            const response = await authorizedRequest(`/api/secondary-trading/listings/${listingId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                addToast('success', 'Listing cancelled successfully')
                fetchData()
            } else {
                const error = await response.json()
                addToast('error', error.error || 'Failed to cancel listing')
            }
        } catch (error) {
            console.error('Error cancelling listing:', error)
            addToast('error', 'Error cancelling listing')
        }
    }

    const handleCancelTokenListing = async (listingId: string) => {
        if (!confirm('Are you sure you want to cancel this token listing?')) return

        try {
            const response = await authorizedRequest(`/api/syndicate-tokens/listings/${listingId}`, {
                method: 'DELETE'
            })

            if (response.ok) {
                addToast('success', 'Token listing cancelled successfully')
                fetchData()
            } else {
                const error = await response.json()
                addToast('error', error.error || 'Failed to cancel listing')
            }
        } catch (error) {
            console.error('Error cancelling token listing:', error)
            addToast('error', 'Error cancelling listing')
        }
    }

    const toggleWatchlist = async (listingId: string) => {
        const isWatched = watchlistIds.includes(listingId)
        const nextListingIds = isWatched
            ? watchlistIds.filter(id => id !== listingId)
            : [...watchlistIds, listingId]

        setWatchlistIds(nextListingIds)
        const response = await authorizedRequest('/api/secondary-trading/watchlist', {
            method: 'PUT',
            body: JSON.stringify({ listingIds: nextListingIds })
        })

        if (!response.ok) {
            // Roll back optimistic update
            setWatchlistIds(watchlistIds)
            addToast('error', 'Failed to update watchlist')
            return
        }

        addToast('success', isWatched ? 'Removed from watchlist' : 'Added to watchlist')
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Active</span>
            case 'SOLD':
                return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">Sold</span>
            case 'PENDING':
                return <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">Pending</span>
            case 'COMPLETED':
                return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Completed</span>
            default:
                return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">{status}</span>
        }
    }

    const filteredListings = listings
        .filter(l =>
            (l.deal?.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (l.deal?.sme?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
        )
        .filter(l => !showOnlyProfitable || (l.returnPercentage || 0) > 0)
        .sort((a, b) => {
            if (sortBy === 'bestReturn') return (b.returnPercentage || 0) - (a.returnPercentage || 0)
            if (sortBy === 'lowestPrice') return (a.pricePerShare || 0) - (b.pricePerShare || 0)
            if (sortBy === 'highestPrice') return (b.pricePerShare || 0) - (a.pricePerShare || 0)
            if (sortBy === 'mostLiquid') return (b.sharesAvailable || 0) - (a.sharesAvailable || 0)
            return new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime()
        })

    const topReturnListing = filteredListings.reduce<Listing | null>((best, current) => {
        if (!best) return current
        return (current.returnPercentage || 0) > (best.returnPercentage || 0) ? current : best
    }, null)

    const mostLiquidListing = filteredListings.reduce<Listing | null>((best, current) => {
        if (!best) return current
        return (current.sharesAvailable || 0) > (best.sharesAvailable || 0) ? current : best
    }, null)

    const highlightedListing = topReturnListing || mostLiquidListing || filteredListings[0] || null
    const orderBook = highlightedListing
        ? {
            asks: [0.2, 0.5, 0.8, 1.2, 1.8].map(offset => ({
                price: Number((highlightedListing.pricePerShare * (1 + offset / 100)).toFixed(2)),
                shares: Math.max(1, Math.round(highlightedListing.sharesAvailable * (0.08 + offset / 10)))
            })),
            bids: [0.2, 0.5, 0.8, 1.2, 1.8].map(offset => ({
                price: Number((highlightedListing.pricePerShare * (1 - offset / 100)).toFixed(2)),
                shares: Math.max(1, Math.round(highlightedListing.sharesAvailable * (0.07 + offset / 12)))
            }))
        }
        : { asks: [], bids: [] }

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ArrowLeftRight className="w-8 h-8 text-blue-400" />
                        CamboBia Trading Exchange
                    </h1>
                    <p className="text-gray-400 mt-2">Trade tokenized units with live pricing, liquidity, and performance signals.</p>
                </div>
            </div>

            {/* Stats Dashboard */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                            <Briefcase className="w-4 h-4" />
                            Active Listings
                        </div>
                        <p className="text-2xl font-bold text-white">{stats.activeListings || 0}</p>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                            <DollarSign className="w-4 h-4" />
                            Total Value
                        </div>
                        <p className="text-2xl font-bold text-white">${((stats.totalListingValue || 0) / 1000).toFixed(0)}K</p>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Completed Trades
                        </div>
                        <p className="text-2xl font-bold text-white">{stats.completedTrades || 0}</p>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                            <Activity className="w-4 h-4" />
                            Total Volume
                        </div>
                        <p className="text-2xl font-bold text-white">${((stats.totalVolume || 0) / 1000).toFixed(0)}K</p>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                            <TrendingUp className="w-4 h-4" />
                            Avg Return
                        </div>
                        <p className={`text-2xl font-bold ${(stats.avgReturn || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(stats.avgReturn || 0) >= 0 ? '+' : ''}{(stats.avgReturn || 0).toFixed(1)}%
                        </p>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                            <BarChart3 className="w-4 h-4" />
                            24h Volume
                        </div>
                        <p className="text-2xl font-bold text-white">${(stats.last24hVolume || 0).toFixed(0)}</p>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-700">
                <button
                    onClick={() => setActiveTab('marketplace')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'marketplace'
                        ? 'text-blue-400'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        Marketplace
                    </div>
                    {activeTab === 'marketplace' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('syndicate-tokens')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'syndicate-tokens'
                        ? 'text-cyan-400'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Syndicate Tokens
                    </div>
                    {activeTab === 'syndicate-tokens' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('my-trades')}
                    className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === 'my-trades'
                        ? 'text-blue-400'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <ArrowLeftRight className="w-4 h-4" />
                        My Trades
                    </div>
                    {activeTab === 'my-trades' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
                    )}
                </button>
            </div>

            {/* Marketplace Tab */}
            {activeTab === 'marketplace' && (
                <>
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <Link href="/trading/watchlist" className="px-3 py-2 text-sm bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg border border-yellow-400/20">
                            Watchlist ({watchlistIds.length})
                        </Link>
                        <Link href="/trading/profile" className="px-3 py-2 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg border border-blue-400/20">
                            Trader Profile
                        </Link>
                        <Link href="/investor/portfolio" className="px-3 py-2 text-sm bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg border border-green-400/20">
                            Portfolio
                        </Link>
                    </div>

                    {/* Exchange-style market signals */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                            <p className="text-xs text-gray-400 mb-2">Top Return Opportunity</p>
                            {topReturnListing ? (
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-white font-semibold">{topReturnListing.deal?.sme?.name || 'N/A'}</p>
                                        <p className="text-xs text-gray-400">{topReturnListing.deal?.title || 'Deal'}</p>
                                    </div>
                                    <p className={`text-lg font-bold ${(topReturnListing.returnPercentage || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {(topReturnListing.returnPercentage || 0) >= 0 ? '+' : ''}{(topReturnListing.returnPercentage || 0).toFixed(2)}%
                                    </p>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">No active listings</p>
                            )}
                        </div>
                        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                            <p className="text-xs text-gray-400 mb-2">Most Liquid Listing</p>
                            {mostLiquidListing ? (
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-white font-semibold">{mostLiquidListing.deal?.sme?.name || 'N/A'}</p>
                                        <p className="text-xs text-gray-400">{mostLiquidListing.deal?.title || 'Deal'}</p>
                                    </div>
                                    <p className="text-lg font-bold text-cyan-400">
                                        {(mostLiquidListing.sharesAvailable || 0).toLocaleString()} shares
                                    </p>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">No active listings</p>
                            )}
                        </div>
                    </div>

                    {/* Market depth + tape */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                            <h3 className="text-white font-semibold mb-3">Order Book {highlightedListing ? `- ${highlightedListing.deal?.sme?.name || 'Listing'}` : ''}</h3>
                            {highlightedListing ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-red-400 mb-2">Asks</p>
                                        <div className="space-y-1">
                                            {orderBook.asks.map((level, idx) => (
                                                <div key={`ask-${idx}`} className="flex justify-between text-xs">
                                                    <span className="text-red-300">${level.price.toFixed(2)}</span>
                                                    <span className="text-gray-300">{level.shares.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-green-400 mb-2">Bids</p>
                                        <div className="space-y-1">
                                            {orderBook.bids.map((level, idx) => (
                                                <div key={`bid-${idx}`} className="flex justify-between text-xs">
                                                    <span className="text-green-300">${level.price.toFixed(2)}</span>
                                                    <span className="text-gray-300">{level.shares.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">No active listing for order book.</p>
                            )}
                        </div>
                        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                            <h3 className="text-white font-semibold mb-3">Recent Market Trades</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {recentTrades.length === 0 && (
                                    <p className="text-sm text-gray-500">No recent trades yet.</p>
                                )}
                                {recentTrades.map((trade) => (
                                    <div key={trade.id} className="flex items-center justify-between text-xs bg-gray-900/30 rounded px-2 py-1.5">
                                        <div>
                                            <p className="text-gray-200">{trade.deal?.sme?.name || 'SME'}</p>
                                            <p className="text-gray-500">{new Date(trade.executedAt).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white">${trade.pricePerShare.toFixed(2)}</p>
                                            <p className="text-cyan-300">{trade.shares.toLocaleString()} shares</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="mb-6 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search by deal or company name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="latest">Sort: Latest</option>
                                <option value="bestReturn">Sort: Best Return</option>
                                <option value="lowestPrice">Sort: Lowest Price</option>
                                <option value="highestPrice">Sort: Highest Price</option>
                                <option value="mostLiquid">Sort: Most Liquid</option>
                            </select>
                            <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={showOnlyProfitable}
                                    onChange={(e) => setShowOnlyProfitable(e.target.checked)}
                                    className="rounded bg-gray-800 border-gray-600 text-blue-500 focus:ring-blue-500"
                                />
                                Profitable only
                            </label>
                        </div>
                    </div>

                    {/* Listings Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {filteredListings.map((listing) => (
                            <div key={listing.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-blue-500/50 transition-all">
                                <div className="p-5">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-white mb-1">{listing.deal?.title || 'Unknown Deal'}</h3>
                                            <p className="text-sm text-gray-400">{listing.deal?.sme?.name || 'Project Name'}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {(listing.deal?.sme?.sector || 'General')} | {(listing.deal?.sme?.stage || 'N/A')} | Score {Number(listing.deal?.sme?.score || 0).toFixed(1)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => toggleWatchlist(listing.id)}
                                                className={`p-1 rounded ${watchlistIds.includes(listing.id) ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-300'}`}
                                                title={watchlistIds.includes(listing.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                                            >
                                                <Star className={`w-4 h-4 ${watchlistIds.includes(listing.id) ? 'fill-current' : ''}`} />
                                            </button>
                                            {getStatusBadge(listing.status)}
                                        </div>
                                    </div>

                                    {/* Price Info */}
                                    <div className="grid grid-cols-3 gap-4 mb-4">
                                        <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                                            <p className="text-xs text-gray-400 mb-1">Price/Share</p>
                                            <p className="text-lg font-bold text-white">${(listing.pricePerShare || 0).toFixed(2)}</p>
                                            <div className={`flex items-center justify-center gap-1 text-xs ${listing.returnPercentage >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                {listing.returnPercentage >= 0 ? (
                                                    <ArrowUpRight className="w-3 h-3" />
                                                ) : (
                                                    <ArrowDownRight className="w-3 h-3" />
                                                )}
                                                {(listing.returnPercentage || 0).toFixed(1)}%
                                            </div>
                                        </div>
                                        <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                                            <p className="text-xs text-gray-400 mb-1">Available</p>
                                            <p className="text-lg font-bold text-white">{listing.sharesAvailable.toLocaleString()}</p>
                                            <p className="text-xs text-gray-500">shares</p>
                                        </div>
                                        <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                                            <p className="text-xs text-gray-400 mb-1">Total Value</p>
                                            <p className="text-lg font-bold text-green-400">${((listing.totalValue || 0) / 1000).toFixed(1)}K</p>
                                            <p className="text-xs text-gray-500">min ${listing.minPurchase}</p>
                                        </div>
                                    </div>

                                    {/* Seller Info */}
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <span>Seller:</span>
                                            <span className="text-white">{listing.seller.name}</span>
                                            <span className="text-xs text-gray-500">({listing.seller.type})</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-gray-500">
                                            <Clock className="w-4 h-4" />
                                            Expires {new Date(listing.expiresAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                        <div className="bg-gray-900/40 border border-gray-700 rounded-md px-2 py-1">
                                            <p className="text-gray-500">Liquidity</p>
                                            <p className="text-gray-200">{listing.sharesAvailable.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-gray-900/40 border border-gray-700 rounded-md px-2 py-1">
                                            <p className="text-gray-500">Entry Min</p>
                                            <p className="text-gray-200">{listing.minPurchase}</p>
                                        </div>
                                        <div className="bg-gray-900/40 border border-gray-700 rounded-md px-2 py-1">
                                            <p className="text-gray-500">SME</p>
                                            <p className="text-gray-200 truncate">{listing.deal?.sme?.name || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Footer */}
                                <div className="px-5 py-4 bg-gray-800/80 border-t border-gray-700 flex justify-between items-center">
                                    <div className="text-sm text-gray-400">
                                        Original: ${(listing.originalPricePerShare || 0).toFixed(2)}/share
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/trading/terminal/${listing.id}`}
                                            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg text-sm font-medium transition-colors border border-blue-500/30"
                                        >
                                            Open Terminal
                                        </Link>
                                        {listing.status === 'ACTIVE' && !listing.isOwner && listing.sellerId !== currentInvestorId && (
                                            <button
                                                onClick={() => handleBuyClick(listing)}
                                                disabled={!isInvestor}
                                                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                                            >
                                                <ShoppingCart className="w-4 h-4" />
                                                {isInvestor ? 'Buy Shares' : 'View Only'}
                                            </button>
                                        )}
                                    </div>
                                    {(listing.isOwner || listing.sellerId === currentInvestorId) && listing.status === 'ACTIVE' && (
                                        <button
                                            onClick={() => handleCancelListing(listing.id)}
                                            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition-colors border border-red-500/30"
                                        >
                                            Cancel Listing
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredListings.length === 0 && (
                        <div className="text-center py-16">
                            <ShoppingCart className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 text-lg">No listings found</p>
                            <p className="text-gray-500 text-sm mt-2">Check back later for new opportunities</p>
                        </div>
                    )}
                </>
            )}

            {/* Syndicate Tokens Tab */}
            {activeTab === 'syndicate-tokens' && (
                <>
                    {/* Search */}
                    <div className="mb-6">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search by syndicate name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                    </div>

                    {/* Token Listings Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {tokenListings
                            .filter(listing =>
                                listing.syndicate.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                listing.syndicate.tokenSymbol?.toLowerCase().includes(searchQuery.toLowerCase())
                            )
                            .map((listing) => (
                                <div key={listing.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-cyan-500/50 transition-all">
                                    <div className="p-5">
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <h3 className="text-lg font-bold text-white mb-1">{listing.syndicate?.name || 'Syndicate'}</h3>
                                                <p className="text-sm text-cyan-400">{listing.syndicate?.tokenSymbol || 'TOKEN'}</p>
                                            </div>
                                            {getStatusBadge(listing.status)}
                                        </div>

                                        {/* Token Info */}
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                                                <p className="text-xs text-gray-400 mb-1">Price/Token</p>
                                                <p className="text-lg font-bold text-white">${listing.pricePerToken.toFixed(2)}</p>
                                                <p className="text-xs text-gray-500">per {listing.syndicate.tokenSymbol}</p>
                                            </div>
                                            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                                                <p className="text-xs text-gray-400 mb-1">Available</p>
                                                <p className="text-lg font-bold text-white">{listing.tokensAvailable.toLocaleString()}</p>
                                                <p className="text-xs text-gray-500">tokens</p>
                                            </div>
                                            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                                                <p className="text-xs text-gray-400 mb-1">Total Value</p>
                                                <p className="text-lg font-bold text-cyan-400">${((listing.tokensAvailable * listing.pricePerToken) / 1000).toFixed(1)}K</p>
                                                <p className="text-xs text-gray-500">min {listing.minTokens}</p>
                                            </div>
                                        </div>

                                        {/* Seller Info */}
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2 text-gray-400">
                                                <span>Seller:</span>
                                                <span className="text-white">{listing.seller.name}</span>
                                                <span className="text-xs text-gray-500">({listing.seller.type})</span>
                                            </div>
                                            {listing.expiresAt && (
                                                <div className="flex items-center gap-1 text-gray-500">
                                                    <Clock className="w-4 h-4" />
                                                    Expires {new Date(listing.expiresAt).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Footer */}
                                    <div className="px-5 py-4 bg-gray-800/80 border-t border-gray-700 flex justify-between items-center">
                                        <div className="text-sm text-gray-400">
                                            Listed {new Date(listing.listedAt).toLocaleDateString()}
                                        </div>
                                        {listing.status === 'ACTIVE' && !listing.isOwner && listing.sellerId !== currentInvestorId && (
                                            <button
                                                onClick={() => handleBuyTokenClick(listing)}
                                                disabled={!isInvestor}
                                                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                                            >
                                                <ShoppingCart className="w-4 h-4" />
                                                {isInvestor ? 'Buy Tokens' : 'View Only'}
                                            </button>
                                        )}
                                        {(listing.isOwner || listing.sellerId === currentInvestorId) && listing.status === 'ACTIVE' && (
                                            <button
                                                onClick={() => handleCancelTokenListing(listing.id)}
                                                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition-colors border border-red-500/30"
                                            >
                                                Cancel Listing
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                    </div>

                    {tokenListings.length === 0 && (
                        <div className="text-center py-12">
                            <DollarSign className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400">No syndicate token listings available</p>
                        </div>
                    )}
                </>
            )}

            {/* My Trades Tab */}
            {activeTab === 'my-trades' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Purchases */}
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <ArrowDownRight className="w-5 h-5 text-green-400" />
                            Purchases
                        </h3>

                        {(myTrades?.purchases?.length > 0 || myTokenTrades?.purchases?.length > 0) ? (
                            <div className="space-y-3">
                                {/* Deal Share Purchases */}
                                {myTrades?.purchases?.map((trade) => (
                                    <div key={`share-${trade.id}`} className="bg-gray-700/50 rounded-lg p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-white font-medium">{trade.listing.dealInvestor?.deal.sme.name}</p>
                                                <p className="text-sm text-gray-400">{trade.shares} shares @ ${(trade.pricePerShare || 0).toFixed(2)}</p>
                                            </div>
                                            {getStatusBadge(trade.status)}
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Total:</span>
                                            <span className="text-green-400 font-semibold">${(trade.totalAmount || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                                            <span>From: {trade.seller.name}</span>
                                            <span>{trade.executedAt ? new Date(trade.executedAt).toLocaleDateString() : 'Pending'}</span>
                                        </div>
                                    </div>
                                ))}

                                {/* Syndicate Token Purchases */}
                                {myTokenTrades?.purchases?.map((trade) => (
                                    <div key={`token-${trade.id}`} className="bg-gray-700/50 rounded-lg p-4 border-l-2 border-cyan-500">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-white font-medium">{trade.listing.syndicate.name}</p>
                                                <p className="text-sm text-gray-400">{trade.tokens.toLocaleString()} {trade.listing.syndicate.tokenSymbol} @ ${(trade.pricePerToken || 0).toFixed(2)}</p>
                                            </div>
                                            {getStatusBadge(trade.status)}
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Total:</span>
                                            <span className="text-green-400 font-semibold">${(trade.totalAmount || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                                            <span>From: {trade.seller.name}</span>
                                            <span>{trade.executedAt ? new Date(trade.executedAt).toLocaleDateString() : 'Pending'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <p>No purchases yet</p>
                            </div>
                        )}
                    </div>

                    {/* Sales */}
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <ArrowUpRight className="w-5 h-5 text-blue-400" />
                            Sales
                        </h3>

                        {(myTrades?.sales?.length > 0 || myTokenTrades?.sales?.length > 0) ? (
                            <div className="space-y-3">
                                {/* Deal Share Sales */}
                                {myTrades?.sales?.map((trade) => (
                                    <div key={`share-${trade.id}`} className="bg-gray-700/50 rounded-lg p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-white font-medium">{trade.listing.dealInvestor?.deal.sme.name}</p>
                                                <p className="text-sm text-gray-400">{trade.shares} shares @ ${(trade.pricePerShare || 0).toFixed(2)}</p>
                                            </div>
                                            {getStatusBadge(trade.status)}
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Net:</span>
                                            <span className="text-blue-400 font-semibold">${(trade.netAmount || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                                            <span>To: {trade.buyer.name}</span>
                                            <span>{trade.executedAt ? new Date(trade.executedAt).toLocaleDateString() : 'Pending'}</span>
                                        </div>
                                    </div>
                                ))}

                                {/* Syndicate Token Sales */}
                                {myTokenTrades?.sales?.map((trade) => (
                                    <div key={`token-${trade.id}`} className="bg-gray-700/50 rounded-lg p-4 border-l-2 border-cyan-500">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-white font-medium">{trade.listing.syndicate.name}</p>
                                                <p className="text-sm text-gray-400">{trade.tokens.toLocaleString()} {trade.listing.syndicate.tokenSymbol} @ ${(trade.pricePerToken || 0).toFixed(2)}</p>
                                            </div>
                                            {getStatusBadge(trade.status)}
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Total:</span>
                                            <span className="text-blue-400 font-semibold">${(trade.totalAmount || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                                            <span>To: {trade.buyer.name}</span>
                                            <span>{trade.executedAt ? new Date(trade.executedAt).toLocaleDateString() : 'Pending'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <p>No sales yet</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Buy Modal */}
            {showBuyModal && selectedListing && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white">Buy Shares</h3>
                            <button
                                onClick={() => setShowBuyModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Deal Info */}
                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <p className="text-white font-medium">{selectedListing.deal?.title || 'Unknown Deal'}</p>
                                <p className="text-sm text-gray-400">{selectedListing.deal?.sme?.name || 'Project'}</p>
                            </div>

                            {/* Price Info */}
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Price per share:</span>
                                <span className="text-xl font-bold text-white">${(selectedListing.pricePerShare || 0).toFixed(2)}</span>
                            </div>

                            {/* Shares Input */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Number of Shares</label>
                                <input
                                    type="number"
                                    value={buyShares}
                                    onChange={(e) => setBuyShares(e.target.value)}
                                    min={selectedListing.minPurchase}
                                    max={selectedListing.sharesAvailable}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Min: {selectedListing.minPurchase}</span>
                                    <span>Available: {selectedListing.sharesAvailable.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Total Calculation */}
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-green-400">Total Cost:</span>
                                    <span className="text-2xl font-bold text-green-400">
                                        ${(parseFloat(buyShares || '0') * (selectedListing.pricePerShare || 0)).toFixed(2)}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">+ 1% platform fee</p>
                            </div>

                            {/* Warning */}
                            <div className="flex items-start gap-3 text-amber-400 text-sm">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p>All sales are final. Please review carefully before purchasing.</p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowBuyModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBuyShares}
                                    disabled={isBuying || parseFloat(buyShares) < selectedListing.minPurchase || parseFloat(buyShares) > selectedListing.sharesAvailable}
                                    className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isBuying ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-5 h-5" />
                                            Confirm Purchase
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Buy Token Modal */}
            {showBuyTokenModal && selectedTokenListing && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white">Buy Syndicate Tokens</h3>
                            <button
                                onClick={() => setShowBuyTokenModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Syndicate Info */}
                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <p className="text-white font-medium">{selectedTokenListing.syndicate.name}</p>
                                <p className="text-sm text-cyan-400">{selectedTokenListing.syndicate.tokenSymbol}</p>
                            </div>

                            {/* Price Info */}
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Price per token:</span>
                                <span className="text-xl font-bold text-white">${selectedTokenListing.pricePerToken.toFixed(2)}</span>
                            </div>

                            {/* Tokens Input */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Number of Tokens</label>
                                <input
                                    type="number"
                                    value={buyTokens}
                                    onChange={(e) => setBuyTokens(e.target.value)}
                                    min={selectedTokenListing.minTokens}
                                    max={selectedTokenListing.tokensAvailable}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Min: {selectedTokenListing.minTokens}</span>
                                    <span>Available: {selectedTokenListing.tokensAvailable.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Total Calculation */}
                            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-cyan-400">Total Cost:</span>
                                    <span className="text-2xl font-bold text-cyan-400">
                                        ${(parseFloat(buyTokens || '0') * selectedTokenListing.pricePerToken).toFixed(2)}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">+ 1% platform fee</p>
                            </div>

                            {/* Warning */}
                            <div className="flex items-start gap-3 text-amber-400 text-sm">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p>All token sales are final. Please review carefully before purchasing.</p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowBuyTokenModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBuyTokens}
                                    disabled={isBuyingTokens || parseFloat(buyTokens) < selectedTokenListing.minTokens || parseFloat(buyTokens) > selectedTokenListing.tokensAvailable}
                                    className="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isBuyingTokens ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-5 h-5" />
                                            Confirm Purchase
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}
