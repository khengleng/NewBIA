'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'

interface TradingStats {
  totalListings: number
  activeListings: number
  totalTrades: number
  totalListingValue: number
  totalVolume: number
  totalFees: number
  avgReturn: number
  last24hVolume: number
}

interface OperatorAccountSummary {
  unsettledAmount: number
  settledAmount: number
  failedAmount: number
  unsettledCount: number
  settledCount: number
  failedCount: number
}

export default function TradingOperatorBusinessOpsPage() {
  const [stats, setStats] = useState<TradingStats | null>(null)
  const [summary, setSummary] = useState<OperatorAccountSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsResponse, summaryResponse] = await Promise.all([
          authorizedRequest('/api/secondary-trading/stats'),
          authorizedRequest('/api/secondary-trading/operator-account/summary'),
        ])

        if (!statsResponse.ok || !summaryResponse.ok) {
          throw new Error('Failed to load business operations metrics')
        }

        setStats(await statsResponse.json())
        setSummary(await summaryResponse.json())
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load business operations metrics')
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h1 className="text-3xl font-bold text-white">Trading Business Operations</h1>
          <p className="text-gray-400 mt-2">
            Monitor exchange growth KPIs, listing health, and operator-side settlement performance for the secondary market business.
          </p>
        </div>

        {isLoading && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 text-gray-300">Loading business operations metrics...</div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-5 text-red-100">{error}</div>
        )}

        {stats && summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <div className="text-sm text-gray-400">Active Listings</div>
                <div className="text-3xl font-bold text-white mt-2">{stats.activeListings}</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <div className="text-sm text-gray-400">Total Trade Volume</div>
                <div className="text-3xl font-bold text-white mt-2">${Number(stats.totalVolume || 0).toLocaleString()}</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <div className="text-sm text-gray-400">Platform Fees Earned</div>
                <div className="text-3xl font-bold text-white mt-2">${Number(stats.totalFees || 0).toLocaleString()}</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                <div className="text-sm text-gray-400">24h Volume</div>
                <div className="text-3xl font-bold text-white mt-2">${Number(stats.last24hVolume || 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white">Marketplace Operating Summary</h2>
                <div className="mt-4 space-y-3 text-sm text-gray-300">
                  <div className="flex justify-between gap-4"><span>Total Listings</span><span>{stats.totalListings}</span></div>
                  <div className="flex justify-between gap-4"><span>Completed Trades</span><span>{stats.totalTrades}</span></div>
                  <div className="flex justify-between gap-4"><span>Listing Value</span><span>${Number(stats.totalListingValue || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between gap-4"><span>Average Return Signal</span><span>{stats.avgReturn}%</span></div>
                </div>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white">Settlement & Reconciliation</h2>
                <div className="mt-4 space-y-3 text-sm text-gray-300">
                  <div className="flex justify-between gap-4"><span>Unsettled Amount</span><span>${Number(summary.unsettledAmount || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between gap-4"><span>Settled Amount</span><span>${Number(summary.settledAmount || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between gap-4"><span>Failed Amount</span><span>${Number(summary.failedAmount || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between gap-4"><span>Unsettled Runs</span><span>{summary.unsettledCount}</span></div>
                  <div className="flex justify-between gap-4"><span>Failed Runs</span><span>{summary.failedCount}</span></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Link href="/trading/operator/reconciliation" className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-colors">
                <h2 className="text-xl font-semibold text-white">Fee & Reconciliation Desk</h2>
                <p className="text-gray-400 mt-2">Review trade fees, unsettled runs, and reconciliation exceptions.</p>
              </Link>
              <Link href="/trading/operator/listing-control" className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-colors">
                <h2 className="text-xl font-semibold text-white">Listing Governance</h2>
                <p className="text-gray-400 mt-2">Approve, pause, or block units from secondary market trading.</p>
              </Link>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
