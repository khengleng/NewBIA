'use client'

import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'

interface Listing {
  id: string
  status: string
  sharesAvailable: number
  pricePerShare: number
  minPurchase: number
  listedAt: string
  deal?: {
    title?: string
    sme?: {
      name?: string
      sector?: string
    }
  }
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value || 0)

export default function TradingListingControlPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [listings, setListings] = useState<Listing[]>([])

  const loadListings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await authorizedRequest('/api/secondary-trading/listings')
      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || 'Unable to load listings')
      }
      const data = await response.json()
      setListings(Array.isArray(data) ? data : [])
    } catch (loadError) {
      console.error('Failed to load listing control data', loadError)
      setError('Unable to load listing governance data right now.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadListings()
  }, [])

  const stats = useMemo(() => {
    const total = listings.length
    const active = listings.filter((l) => l.status === 'ACTIVE').length
    const cancelled = listings.filter((l) => l.status === 'CANCELLED').length
    const gross = listings.reduce((sum, l) => sum + Number(l.pricePerShare || 0) * Number(l.sharesAvailable || 0), 0)
    return { total, active, cancelled, gross }
  }, [listings])

  const updateStatus = async (listingId: string, status: string) => {
    setIsSaving(listingId)
    setError(null)
    try {
      const response = await authorizedRequest(`/api/secondary-trading/listings/${listingId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(body || 'Failed to update listing status')
      }

      await loadListings()
    } catch (updateError) {
      console.error('Failed to update listing status', updateError)
      setError('Listing status update failed. Please retry.')
    } finally {
      setIsSaving(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h1 className="text-3xl font-bold text-white">Listing Governance Console</h1>
          <p className="text-gray-400 mt-2">
            Approve, suspend, or retire token listings for the trading exchange without exposing cambobia.com admin modules.
          </p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs uppercase text-gray-400">Total Listings</p>
            <p className="text-2xl text-white font-semibold mt-2">{stats.total}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs uppercase text-gray-400">Active</p>
            <p className="text-2xl text-emerald-400 font-semibold mt-2">{stats.active}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs uppercase text-gray-400">Cancelled</p>
            <p className="text-2xl text-amber-400 font-semibold mt-2">{stats.cancelled}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-xs uppercase text-gray-400">Listed Notional</p>
            <p className="text-2xl text-white font-semibold mt-2">{formatCurrency(stats.gross)}</p>
          </div>
        </section>

        {error && (
          <section className="bg-red-900/20 border border-red-600/40 rounded-xl p-4 text-red-200 text-sm">
            {error}
          </section>
        )}

        <section className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-700">
            <h2 className="text-lg text-white font-semibold">Listing Queue</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead className="bg-gray-900 text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3">SME / Deal</th>
                  <th className="text-right px-4 py-3">Price</th>
                  <th className="text-right px-4 py-3">Units</th>
                  <th className="text-right px-4 py-3">Min Order</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-10">Loading listings...</td>
                  </tr>
                ) : listings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-10">No listings found.</td>
                  </tr>
                ) : (
                  listings.map((listing) => (
                    <tr key={listing.id} className="border-t border-gray-700">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{listing.deal?.sme?.name || listing.deal?.title || 'Listing'}</p>
                        <p className="text-xs text-gray-400">{listing.deal?.sme?.sector || 'Sector N/A'}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-white">{formatCurrency(Number(listing.pricePerShare || 0))}</td>
                      <td className="px-4 py-3 text-right text-white">{Number(listing.sharesAvailable || 0)}</td>
                      <td className="px-4 py-3 text-right text-white">{Number(listing.minPurchase || 0)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          listing.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {listing.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          type="button"
                          disabled={isSaving === listing.id || listing.status === 'ACTIVE'}
                          onClick={() => updateStatus(listing.id, 'ACTIVE')}
                          className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-40"
                        >
                          Activate
                        </button>
                        <button
                          type="button"
                          disabled={isSaving === listing.id || listing.status === 'CANCELLED'}
                          onClick={() => updateStatus(listing.id, 'CANCELLED')}
                          className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-40"
                        >
                          Retire
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}
