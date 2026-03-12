'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'

interface TradingStats {
  totalVolume: number
  totalFees: number
  totalTrades: number
  last24hVolume: number
}

interface AccountSummary {
  unsettledAmount: number
  settledAmount: number
  failedAmount: number
  unsettledCount: number
  settledCount: number
  failedCount: number
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value || 0)

export default function TradingReconciliationPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<TradingStats | null>(null)
  const [summary, setSummary] = useState<AccountSummary | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setError(null)
        const [statsRes, summaryRes] = await Promise.all([
          authorizedRequest('/api/secondary-trading/stats'),
          authorizedRequest('/api/secondary-trading/operator-account/summary'),
        ])

        if (statsRes.ok) {
          setStats(await statsRes.json())
        }

        if (summaryRes.ok) {
          setSummary(await summaryRes.json())
        }
      } catch (loadError) {
        console.error('Failed to load trading reconciliation data', loadError)
        setError('Unable to load fee and reconciliation data right now.')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h1 className="text-3xl font-bold text-white">Trading Fee & Reconciliation</h1>
          <p className="text-gray-400 mt-2">
            Monitor exchange fee revenue, settlement pipelines, and failed payouts for trade.cambobia.com.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs uppercase text-gray-400">Gross Trading Volume</p>
            <p className="text-2xl text-white font-semibold mt-2">{formatCurrency(stats?.totalVolume || 0)}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs uppercase text-gray-400">Platform Fees Earned</p>
            <p className="text-2xl text-emerald-400 font-semibold mt-2">{formatCurrency(stats?.totalFees || 0)}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs uppercase text-gray-400">24H Volume</p>
            <p className="text-2xl text-white font-semibold mt-2">{formatCurrency(stats?.last24hVolume || 0)}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs uppercase text-gray-400">Completed Trades</p>
            <p className="text-2xl text-white font-semibold mt-2">{stats?.totalTrades || 0}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <p className="text-xs uppercase text-gray-400">Settled</p>
            <p className="text-2xl text-emerald-400 font-semibold mt-2">{formatCurrency(summary?.settledAmount || 0)}</p>
            <p className="text-sm text-gray-400 mt-1">{summary?.settledCount || 0} transaction(s)</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <p className="text-xs uppercase text-gray-400">Unsettled</p>
            <p className="text-2xl text-amber-300 font-semibold mt-2">{formatCurrency(summary?.unsettledAmount || 0)}</p>
            <p className="text-sm text-gray-400 mt-1">{summary?.unsettledCount || 0} transaction(s)</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <p className="text-xs uppercase text-gray-400">Failed</p>
            <p className="text-2xl text-red-300 font-semibold mt-2">{formatCurrency(summary?.failedAmount || 0)}</p>
            <p className="text-sm text-gray-400 mt-1">{summary?.failedCount || 0} transaction(s)</p>
          </div>
        </section>

        {(isLoading || error) && (
          <section className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm">
            {isLoading ? (
              <p className="text-gray-400">Loading reconciliation data...</p>
            ) : (
              <p className="text-red-200">{error}</p>
            )}
          </section>
        )}
      </div>
    </DashboardLayout>
  )
}
