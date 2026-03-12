'use client'

import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'

interface TradingStats {
  activeListings: number
  totalListings: number
  totalTrades: number
  totalVolume: number
  totalFees: number
  last24hVolume: number
}

interface Listing {
  id: string
  status: string
  sharesAvailable: number
  pricePerShare: number
  deal?: {
    title?: string
    sme?: {
      name?: string
    }
  }
}

interface RecentTrade {
  id: string
  totalAmount: number
  shares: number
  pricePerShare: number
  executedAt: string
  deal?: {
    title?: string
    sme?: {
      name?: string
    }
  } | null
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0)

export default function TradingOperatorDashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<TradingStats | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [recentTrades, setRecentTrades] = useState<RecentTrade[]>([])

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, listingsRes, tradesRes] = await Promise.all([
          authorizedRequest('/api/secondary-trading/stats'),
          authorizedRequest('/api/secondary-trading/listings?status=ACTIVE'),
          authorizedRequest('/api/secondary-trading/trades/recent?limit=8'),
        ])

        if (statsRes.ok) {
          setStats(await statsRes.json())
        }

        if (listingsRes.ok) {
          const listingData = await listingsRes.json()
          setListings(Array.isArray(listingData) ? listingData : [])
        }

        if (tradesRes.ok) {
          const tradeData = await tradesRes.json()
          setRecentTrades(Array.isArray(tradeData?.trades) ? tradeData.trades : [])
        }
      } catch (error) {
        console.error('Failed to load trading operator dashboard data', error)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  const avgTicket = useMemo(() => {
    if (!stats || stats.totalTrades === 0) return 0
    return stats.totalVolume / stats.totalTrades
  }, [stats])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h1 className="text-3xl font-bold text-white">Trading Operator Control Tower</h1>
          <p className="text-gray-400 mt-2">
            Dedicated operations console for the exchange platform. This view is separated from cambobia.com admin workflows.
          </p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase">Active Listings</p>
            <p className="text-2xl text-white font-semibold mt-2">{stats?.activeListings ?? 0}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase">Total Trades</p>
            <p className="text-2xl text-white font-semibold mt-2">{stats?.totalTrades ?? 0}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase">Gross Volume</p>
            <p className="text-2xl text-white font-semibold mt-2">{formatCurrency(stats?.totalVolume || 0)}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase">Platform Fees</p>
            <p className="text-2xl text-emerald-400 font-semibold mt-2">{formatCurrency(stats?.totalFees || 0)}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs text-gray-400 uppercase">Avg Ticket</p>
            <p className="text-2xl text-white font-semibold mt-2">{formatCurrency(avgTicket)}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white">Listing Health Snapshot</h2>
            <p className="text-gray-400 text-sm mt-1">Top active listings by notional value.</p>
            <div className="mt-4 space-y-3">
              {isLoading ? (
                <p className="text-gray-400">Loading listings...</p>
              ) : listings.length === 0 ? (
                <p className="text-gray-400">No active listings currently.</p>
              ) : (
                listings.slice(0, 6).map((listing) => {
                  const listingValue = Number(listing.sharesAvailable || 0) * Number(listing.pricePerShare || 0)
                  return (
                    <div key={listing.id} className="flex items-center justify-between border border-gray-700 rounded-lg p-3">
                      <div>
                        <p className="text-white text-sm font-medium">{listing.deal?.sme?.name || listing.deal?.title || 'Listing'}</p>
                        <p className="text-xs text-gray-400">{listing.sharesAvailable} units @ {formatCurrency(Number(listing.pricePerShare || 0))}</p>
                      </div>
                      <p className="text-sm text-blue-300 font-semibold">{formatCurrency(listingValue)}</p>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white">Recent Executions</h2>
            <p className="text-gray-400 text-sm mt-1">Latest completed trades across the exchange.</p>
            <div className="mt-4 space-y-3">
              {isLoading ? (
                <p className="text-gray-400">Loading trades...</p>
              ) : recentTrades.length === 0 ? (
                <p className="text-gray-400">No completed trades yet.</p>
              ) : (
                recentTrades.map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between border border-gray-700 rounded-lg p-3">
                    <div>
                      <p className="text-white text-sm font-medium">{trade.deal?.sme?.name || trade.deal?.title || 'Trade'}</p>
                      <p className="text-xs text-gray-400">{trade.shares} units @ {formatCurrency(Number(trade.pricePerShare || 0))}</p>
                    </div>
                    <p className="text-sm text-emerald-300 font-semibold">{formatCurrency(Number(trade.totalAmount || 0))}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}
