'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    Activity,
    ArrowLeft,
    BarChart3,
    Clock,
    Clock3,
    Info,
    TrendingDown,
    TrendingUp,
    Wallet
} from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import usePermissions from '@/hooks/usePermissions'
import { useSocket } from '@/hooks/useSocket'
import { isTradingOperatorRole, normalizeRole } from '@/lib/roles'

interface Listing {
    id: string
    sharesAvailable: number
    pricePerShare: number
    minPurchase: number
    status: string
    returnPercentage?: number
    deal?: {
        id: string
        title: string
        sme?: {
            id: string
            name: string
            sector?: string
            stage?: string
        }
    }
}

interface RecentTrade {
    id: string
    listingId: string
    pricePerShare: number
    shares: number
    totalAmount: number
    executedAt: string
}

interface OrderLevel {
    price: number
    shares: number
    cumulative: number
}

export default function TradeTerminalPage() {
    const params = useParams<{ listingId: string }>()
    const router = useRouter()
    const { addToast } = useToast()
    const { user, isLoading: isRoleLoading } = usePermissions()
    const listingId = params?.listingId

    const { socket, isConnected } = useSocket()
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [listing, setListing] = useState<Listing | null>(null)
    const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([])
    const [walletBalance, setWalletBalance] = useState<number | null>(null)

    const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
    const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT')
    const [quantity, setQuantity] = useState('')
    const [limitPrice, setLimitPrice] = useState('')
    const [depthStepPct, setDepthStepPct] = useState(0.2)

    // WebSocket: Listen for real-time market updates
    useEffect(() => {
        if (!socket || !listingId) return

        const handleMarketUpdate = (data: any) => {
            if (data.type === 'TRADE_EXECUTED' && data.listingId === listingId) {
                setRecentTrades(prev => [...prev.slice(-119), data.trade])
                // Also update listing if any price changes (in a real app, we'd fetch the latest listing state)
            }
            if (data.type === 'NEW_LISTING' && data.listing?.id === listingId) {
                setListing(data.listing)
            }
        }

        socket.on('market_update', handleMarketUpdate)
        return () => {
            socket.off('market_update', handleMarketUpdate)
        }
    }, [socket, listingId])

    useEffect(() => {
        if (isRoleLoading) return
        const role = normalizeRole(user?.role)
        if (isTradingOperatorRole(role)) {
            router.replace('/trading/markets')
            return
        }

        const load = async () => {
            if (!listingId) return

            try {
                const [listingRes, tradesRes, walletRes] = await Promise.all([
                    authorizedRequest(`/api/secondary-trading/listings/${listingId}`),
                    authorizedRequest('/api/secondary-trading/trades/recent?limit=120'),
                    authorizedRequest('/api/wallet')
                ])

                if (listingRes.status === 404) {
                    addToast('error', 'Trading pair not found')
                    router.push('/trading/markets')
                    return
                }

                if (listingRes.ok) {
                    const data = await listingRes.json()
                    setListing(data)
                    setQuantity(String(data.minPurchase || 1))
                    setLimitPrice(Number(data.pricePerShare || 0).toFixed(2))
                }

                if (tradesRes.ok) {
                    const payload = await tradesRes.json()
                    const filtered = Array.isArray(payload.trades)
                        ? payload.trades.filter((t: RecentTrade) => t.listingId === listingId)
                        : []
                    const sorted = filtered.sort((a: RecentTrade, b: RecentTrade) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime())
                    setRecentTrades(sorted)
                }

                if (walletRes.ok) {
                    const data = await walletRes.json()
                    setWalletBalance(data.wallet?.balance || 0)
                }
            } catch (error) {
                console.error('Failed to load terminal', error)
                addToast('error', 'Failed to load trading terminal')
            } finally {
                setIsLoading(false)
            }
        }

        load()
    }, [addToast, isRoleLoading, listingId, router, user?.role])

    const referencePrice = Number(listing?.pricePerShare || 0)
    const resolvedLimitPrice = Number(limitPrice || 0)
    const effectivePrice = orderType === 'MARKET' ? referencePrice : resolvedLimitPrice
    const qty = Number(quantity || 0)
    const total = qty * effectivePrice
    const feeEstimate = total * 0.01

    const priceStats = useMemo(() => {
        const prices = recentTrades.map(t => Number(t.pricePerShare || 0)).filter(Boolean)
        const fallback = Number(listing?.pricePerShare || 0)

        const open = prices.length > 0 ? prices[0] : fallback
        const last = prices.length > 0 ? prices[prices.length - 1] : fallback
        const high = prices.length > 0 ? Math.max(...prices) : fallback
        const low = prices.length > 0 ? Math.min(...prices) : fallback

        const changePct = open > 0 ? ((last - open) / open) * 100 : 0
        return { open, last, high, low, changePct }
    }, [listing?.pricePerShare, recentTrades])

    const chartBars = useMemo(() => {
        const prices = recentTrades.map(t => Number(t.pricePerShare || 0)).filter(Boolean)

        if (prices.length >= 12) {
            const chunkSize = Math.max(2, Math.floor(prices.length / 24))
            const chunks: number[][] = []

            for (let i = 0; i < prices.length; i += chunkSize) {
                chunks.push(prices.slice(i, i + chunkSize))
            }

            return chunks.slice(-24).map((chunk, idx) => {
                const open = chunk[0]
                const close = chunk[chunk.length - 1]
                const high = Math.max(...chunk)
                const low = Math.min(...chunk)
                return {
                    id: idx,
                    open,
                    close,
                    high,
                    low,
                    bullish: close >= open
                }
            })
        }

        const base = Number(listing?.pricePerShare || 1)
        return Array.from({ length: 24 }).map((_, idx) => {
            const wave = Math.sin(idx * 0.55)
            const trend = Math.cos(idx * 0.21)
            const open = base * (1 + (wave + trend) * 0.01)
            const close = base * (1 + (Math.sin((idx + 0.6) * 0.55) + trend) * 0.01)
            const high = Math.max(open, close) * 1.004
            const low = Math.min(open, close) * 0.996
            return {
                id: idx,
                open,
                close,
                high,
                low,
                bullish: close >= open
            }
        })
    }, [listing?.pricePerShare, recentTrades])

    const orderBook = useMemo(() => {
        if (!listing) return { asks: [] as OrderLevel[], bids: [] as OrderLevel[] }

        const mid = Number(listing.pricePerShare || 0)
        const totalShares = Number(listing.sharesAvailable || 0)
        const levels = 12

        let askCumulative = 0
        let bidCumulative = 0

        const asks: OrderLevel[] = Array.from({ length: levels }).map((_, idx) => {
            const multiplier = 1 + ((idx + 1) * depthStepPct) / 100
            const shares = Math.max(1, Math.round(totalShares * (0.12 - idx * 0.007)))
            askCumulative += shares
            return {
                price: Number((mid * multiplier).toFixed(2)),
                shares,
                cumulative: askCumulative
            }
        })

        const bids: OrderLevel[] = Array.from({ length: levels }).map((_, idx) => {
            const multiplier = 1 - ((idx + 1) * depthStepPct) / 100
            const shares = Math.max(1, Math.round(totalShares * (0.12 - idx * 0.007)))
            bidCumulative += shares
            return {
                price: Number((mid * multiplier).toFixed(2)),
                shares,
                cumulative: bidCumulative
            }
        })

        return { asks, bids }
    }, [depthStepPct, listing])

    const maxTradableShares = Number(listing?.sharesAvailable || 0)

    const applyQuickSize = (percent: number) => {
        if (!listing) return
        const base = Math.floor(maxTradableShares * percent)
        const adjusted = Math.max(Number(listing.minPurchase || 1), base)
        setQuantity(String(Math.min(adjusted, maxTradableShares)))
    }

    const submitOrder = async () => {
        if (!listing) return
        const parsedQty = Number(quantity)

        if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
            addToast('error', 'Invalid quantity')
            return
        }

        if (parsedQty < Number(listing.minPurchase || 1)) {
            addToast('error', `Minimum order is ${listing.minPurchase} units`)
            return
        }

        if (parsedQty > Number(listing.sharesAvailable || 0)) {
            addToast('error', 'Requested quantity exceeds available shares')
            return
        }

        if (orderType === 'LIMIT' && (!Number.isFinite(resolvedLimitPrice) || resolvedLimitPrice <= 0)) {
            addToast('error', 'Invalid limit price')
            return
        }

        if (side === 'SELL') {
            addToast('info', 'Sell flow runs from your Portfolio positions.')
            router.push('/trading/portfolio')
            return
        }

        setIsSubmitting(true)
        try {
            const response = await authorizedRequest(`/api/secondary-trading/listings/${listing.id}/buy`, {
                method: 'POST',
                body: JSON.stringify({ shares: parsedQty })
            })

            if (response.ok) {
                const payload = await response.json()
                if (payload?.abaRequest) {
                    addToast('success', 'Order submitted. Complete settlement in ABA to finalize.')
                } else {
                    addToast('success', 'Buy order placed successfully.')
                }
            } else {
                const error = await response.json()
                addToast('error', error?.error || 'Unable to place order')
            }
        } catch (error) {
            console.error('Failed to submit order', error)
            addToast('error', 'Unable to place order')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-5">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                    <div>
                        <Link href="/trading/markets" className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Markets
                        </Link>
                        <h1 className="text-3xl font-bold text-white mt-2">
                            {listing?.deal?.sme?.name || 'Pair'} / USDT
                        </h1>
                        <p className="text-gray-400 mt-1">{listing?.deal?.title || 'Tokenized SME market'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300">
                            {listing?.deal?.sme?.sector || 'General Sector'}
                        </span>
                        <span className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300">
                            Stage: {listing?.deal?.sme?.stage || 'Active'}
                        </span>
                        <span className="px-2 py-1 rounded bg-blue-900/40 border border-blue-700/40 text-blue-200">
                            Listing: {listing?.status || 'ACTIVE'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">Last Price</p>
                        <p className="text-xl font-semibold text-white">${priceStats.last.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">24h Change</p>
                        <p className={`text-xl font-semibold flex items-center gap-1 ${priceStats.changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {priceStats.changePct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {priceStats.changePct >= 0 ? '+' : ''}{priceStats.changePct.toFixed(2)}%
                        </p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">24h High</p>
                        <p className="text-xl font-semibold text-white">${priceStats.high.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">24h Low</p>
                        <p className="text-xl font-semibold text-white">${priceStats.low.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                        <p className="text-xs text-gray-400 mb-1">Available Liquidity</p>
                        <p className="text-xl font-semibold text-cyan-300">{maxTradableShares.toLocaleString()}</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-10 text-center text-gray-400">Loading terminal...</div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                        <div className="xl:col-span-7 space-y-4">
                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-white font-semibold flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-blue-400" />
                                        Price Chart
                                    </h2>
                                    <span className="text-xs text-gray-400">Candles (preview)</span>
                                </div>
                                <div className="h-72 grid grid-cols-24 gap-1 items-end">
                                    {chartBars.map((bar) => {
                                        const range = Math.max(0.01, priceStats.high - priceStats.low)
                                        const bodyHeight = Math.max(8, Math.abs(bar.close - bar.open) / range * 180)
                                        const wickBottom = ((Math.min(bar.open, bar.close) - priceStats.low) / range) * 100
                                        const wickHeight = Math.max(6, ((bar.high - bar.low) / range) * 100)
                                        const bullish = bar.bullish

                                        return (
                                            <div key={bar.id} className="relative h-full flex items-end justify-center">
                                                <div
                                                    className={`absolute w-[2px] ${bullish ? 'bg-green-500/80' : 'bg-red-500/80'}`}
                                                    style={{
                                                        bottom: `${wickBottom}%`,
                                                        height: `${wickHeight}%`
                                                    }}
                                                />
                                                <div
                                                    className={`relative w-full max-w-[10px] rounded-sm ${bullish ? 'bg-green-500' : 'bg-red-500'}`}
                                                    style={{ height: `${bodyHeight}px` }}
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-white font-semibold flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-cyan-400" />
                                        Trade Tape
                                    </h2>
                                    <span className="text-xs text-gray-400">Last {recentTrades.length} executions</span>
                                </div>
                                <div className="grid grid-cols-3 text-xs text-gray-400 pb-2 border-b border-gray-700">
                                    <span>Price</span>
                                    <span className="text-right">Size</span>
                                    <span className="text-right">Time</span>
                                </div>
                                <div className="space-y-1 max-h-64 overflow-auto mt-2 pr-1">
                                    {recentTrades.length === 0 && (
                                        <p className="text-gray-400 text-sm py-6 text-center">No completed trades yet for this pair.</p>
                                    )}
                                    {recentTrades.slice().reverse().map((trade, idx, arr) => {
                                        const prev = arr[idx + 1]
                                        const up = !prev || Number(trade.pricePerShare) >= Number(prev.pricePerShare)
                                        return (
                                            <div key={trade.id} className="grid grid-cols-3 text-sm py-1 border-b border-gray-800/80">
                                                <span className={up ? 'text-green-400' : 'text-red-400'}>${Number(trade.pricePerShare).toFixed(2)}</span>
                                                <span className="text-gray-200 text-right">{Number(trade.shares).toLocaleString()}</span>
                                                <span className="text-gray-500 text-right">{new Date(trade.executedAt).toLocaleTimeString()}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="xl:col-span-3 bg-gray-800 border border-gray-700 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-white font-semibold">Order Book</h2>
                                <select
                                    value={depthStepPct}
                                    onChange={(e) => setDepthStepPct(Number(e.target.value))}
                                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
                                >
                                    <option value={0.1}>0.10%</option>
                                    <option value={0.2}>0.20%</option>
                                    <option value={0.5}>0.50%</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-3 text-[11px] text-gray-400 pb-1 border-b border-gray-700">
                                <span>Price</span>
                                <span className="text-right">Size</span>
                                <span className="text-right">Total</span>
                            </div>

                            <div className="space-y-1 mt-2 max-h-[220px] overflow-auto pr-1">
                                {orderBook.asks.slice().reverse().map((level, idx) => (
                                    <div key={`ask-${idx}`} className="grid grid-cols-3 text-xs">
                                        <span className="text-red-400">{level.price.toFixed(2)}</span>
                                        <span className="text-right text-gray-300">{level.shares.toLocaleString()}</span>
                                        <span className="text-right text-gray-500">{level.cumulative.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="text-center py-2 my-2 text-white font-semibold border-y border-gray-700">
                                ${referencePrice.toFixed(2)}
                            </div>

                            <div className="space-y-1 max-h-[220px] overflow-auto pr-1">
                                {orderBook.bids.map((level, idx) => (
                                    <div key={`bid-${idx}`} className="grid grid-cols-3 text-xs">
                                        <span className="text-green-400">{level.price.toFixed(2)}</span>
                                        <span className="text-right text-gray-300">{level.shares.toLocaleString()}</span>
                                        <span className="text-right text-gray-500">{level.cumulative.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="xl:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-4">
                            <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-3">
                                <button
                                    className={`flex-1 py-2 text-sm ${side === 'BUY' ? 'bg-green-600 text-white' : 'bg-gray-900 text-gray-300'}`}
                                    onClick={() => setSide('BUY')}
                                >
                                    Buy
                                </button>
                                <button
                                    className={`flex-1 py-2 text-sm ${side === 'SELL' ? 'bg-red-600 text-white' : 'bg-gray-900 text-gray-300'}`}
                                    onClick={() => setSide('SELL')}
                                >
                                    Sell
                                </button>
                            </div>

                            <div className="flex rounded-lg overflow-hidden border border-gray-700 mb-4">
                                <button
                                    className={`flex-1 py-1.5 text-xs ${orderType === 'LIMIT' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-300'}`}
                                    onClick={() => setOrderType('LIMIT')}
                                >
                                    Limit
                                </button>
                                <button
                                    className={`flex-1 py-1.5 text-xs ${orderType === 'MARKET' ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-300'}`}
                                    onClick={() => setOrderType('MARKET')}
                                >
                                    Market
                                </button>
                            </div>

                            <div className="mb-4">
                                <div className="flex justify-between items-center text-[11px] mb-1">
                                    <span className="text-gray-400 flex items-center gap-1">
                                        <Wallet className="w-3 h-3" /> Balance
                                    </span>
                                    <span className="text-white font-medium">
                                        {walletBalance !== null ? `$${walletBalance.toLocaleString()}` : <span className="animate-pulse">Loading...</span>}
                                    </span>
                                </div>
                                {side === 'BUY' && walletBalance !== null && (
                                    <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden border border-gray-700">
                                        <div
                                            className="bg-blue-500 h-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, ((total + feeEstimate) / (Math.max(1, walletBalance))) * 100)}%` }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                {orderType === 'LIMIT' ? (
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Limit Price (USDT)</label>
                                        <input
                                            value={limitPrice}
                                            onChange={(e) => setLimitPrice(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Market Price</label>
                                        <input
                                            readOnly
                                            value={referencePrice.toFixed(2)}
                                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-300"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Quantity</label>
                                    <input
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-[11px] text-gray-500 mt-1">Min {Number(listing?.minPurchase || 0).toLocaleString()} • Max {maxTradableShares.toLocaleString()}</p>
                                </div>

                                <div className="grid grid-cols-4 gap-1">
                                    {[0.25, 0.5, 0.75, 1].map((pct) => (
                                        <button
                                            key={pct}
                                            onClick={() => applyQuickSize(pct)}
                                            className="py-1 text-[11px] rounded bg-gray-900 border border-gray-700 text-gray-300 hover:text-white"
                                        >
                                            {Math.round(pct * 100)}%
                                        </button>
                                    ))}
                                </div>

                                <div className="rounded-lg bg-gray-900/70 border border-gray-700 p-3 space-y-1 text-xs">
                                    <div className="flex justify-between text-gray-400">
                                        <span>Order Value</span>
                                        <span className="text-gray-200">${total.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-400">
                                        <span>Fee (1%)</span>
                                        <span className="text-gray-200">${feeEstimate.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-400">
                                        <span>{side === 'BUY' ? 'Est. Debit' : 'Est. Credit'}</span>
                                        <span className={side === 'BUY' ? 'text-red-300' : 'text-green-300'}>
                                            ${side === 'BUY' ? (total + feeEstimate).toFixed(2) : Math.max(0, total - feeEstimate).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={submitOrder}
                                    disabled={isSubmitting}
                                    className={`w-full py-2 rounded-lg text-white font-medium ${side === 'BUY' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'} disabled:opacity-60`}
                                >
                                    {isSubmitting ? 'Submitting...' : `${side === 'BUY' ? 'Place Buy Order' : 'Place Sell Order'}`}
                                </button>

                                <p className="text-[11px] text-gray-500 flex items-start gap-1.5">
                                    <Info className="w-3.5 h-3.5 mt-0.5 text-gray-400" />
                                    Sell orders are managed through your portfolio positions to ensure ownership checks.
                                </p>

                                <Link href="/trading/portfolio" className="block text-center text-sm text-blue-300 hover:text-blue-200">
                                    Open Portfolio
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs text-gray-400 flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        {isConnected ? 'Real-time market connectivity active.' : 'Connecting to market data...'}
                    </span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Market depth updates automatically on every trade.</span>
                </div>
            </div>
        </DashboardLayout>
    )
}
