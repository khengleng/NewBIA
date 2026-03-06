'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import Link from 'next/link'

interface ListingRecord {
  id: string
  status: 'ACTIVE' | 'SOLD' | 'CANCELLED' | 'EXPIRED'
  listedAt: string
  sharesAvailable: number
  pricePerShare: number
  minPurchase: number
  seller?: { name?: string | null; type?: string | null } | null
  deal?: { title?: string | null; sme?: { name?: string | null; sector?: string | null } | null } | null
}

const STATUS_OPTIONS: Array<ListingRecord['status'] | 'ALL'> = ['ALL', 'ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED']

export default function TradingOpsPage() {
  const { addToast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ListingRecord['status'] | 'ALL'>('ALL')
  const [listings, setListings] = useState<ListingRecord[]>([])
  const [reconOverview, setReconOverview] = useState<{
    failedRuns?: number
    openExceptions?: number
    unresolvedCritical?: number
  } | null>(null)
  const [investorOverview, setInvestorOverview] = useState<{
    pendingKyc?: number
    stalePendingKyc?: number
    suspendedInvestors?: number
  } | null>(null)
  const [launchpadOfferings, setLaunchpadOfferings] = useState<any[]>([])

  const loadListings = useCallback(async () => {
    setIsLoading(true)
    try {
      const query = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`
      const response = await authorizedRequest(`/api/secondary-trading/listings${query}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || 'Unable to load trading listings')
      }
      const data = await response.json()
      setListings(Array.isArray(data) ? data : [])

      const [reconRes, investorRes] = await Promise.all([
        authorizedRequest('/api/admin/reconciliation/overview'),
        authorizedRequest('/api/admin/investor-ops/overview')
      ])

      if (reconRes.ok) {
        const reconData = await reconRes.json()
        setReconOverview(reconData || null)
      } else {
        setReconOverview(null)
      }

      if (investorRes.ok) {
        const investorData = await investorRes.json()
        setInvestorOverview(investorData || null)
      } else {
        setInvestorOverview(null)
      }

      const launchpadRes = await authorizedRequest('/api/launchpad')
      if (launchpadRes.ok) {
        setLaunchpadOfferings(await launchpadRes.json())
      }
    } catch (error: any) {
      addToast('error', error?.message || 'Failed to load listings')
    } finally {
      setIsLoading(false)
    }
  }, [addToast, statusFilter])

  useEffect(() => {
    void loadListings()
  }, [loadListings])

  const stats = useMemo(() => {
    const all = listings.length
    const active = listings.filter((l) => l.status === 'ACTIVE').length
    const blocked = listings.filter((l) => l.status === 'CANCELLED').length
    const volume = listings.reduce((sum, l) => sum + (l.sharesAvailable * l.pricePerShare), 0)
    return { all, active, blocked, volume }
  }, [listings])

  const updateListingStatus = async (listingId: string, status: ListingRecord['status']) => {
    setIsSaving(listingId)
    try {
      const response = await authorizedRequest(`/api/secondary-trading/listings/${listingId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to set status ${status}`)
      }

      addToast('success', `Listing ${status === 'ACTIVE' ? 'approved/reactivated' : 'blocked'} successfully`)
      setListings((prev) => prev.map((listing) => (listing.id === listingId ? { ...listing, status } : listing)))
    } catch (error: any) {
      addToast('error', error?.message || 'Failed to update listing')
    } finally {
      setIsSaving(null)
    }
  }

  const finalizeOffering = async (id: string) => {
    setIsSaving(id)
    try {
      const response = await authorizedRequest(`/api/launchpad/${id}/close`, { method: 'POST' })
      if (!response.ok) throw new Error('Failed to finalize offering')
      addToast('success', 'Offering finalized and commitments allocated')
      loadListings()
    } catch (err: any) {
      addToast('error', err.message)
    } finally {
      setIsSaving(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Trading Listing Control</h1>
            <p className="mt-1 text-gray-400">
              Approve, block, and monitor secondary-market listings for operator compliance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="statusFilter" className="text-sm text-gray-300">Status</label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ListingRecord['status'] | 'ALL')}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Total Listings" value={String(stats.all)} />
          <StatCard label="Active Listings" value={String(stats.active)} />
          <StatCard label="Blocked Listings" value={String(stats.blocked)} />
          <StatCard label="Market Notional" value={`$${stats.volume.toLocaleString()}`} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <QuickActionCard
            title="Investor eKYC Queue"
            metric={String(investorOverview?.pendingKyc ?? 0)}
            subtitle={`Stale pending: ${investorOverview?.stalePendingKyc ?? 0} · Suspended: ${investorOverview?.suspendedInvestors ?? 0}`}
            href="/admin/investor-ops"
            cta="Open Investor Ops"
          />
          <QuickActionCard
            title="Reconciliation Exceptions"
            metric={String(reconOverview?.openExceptions ?? 0)}
            subtitle={`Critical unresolved: ${reconOverview?.unresolvedCritical ?? 0} · Failed runs: ${reconOverview?.failedRuns ?? 0}`}
            href="/admin/reconciliation"
            cta="Open Reconciliation"
          />
          <QuickActionCard
            title="Case Management"
            metric="Review"
            subtitle="Handle disputes, escalations, and support tickets for trading users."
            href="/admin/cases"
            cta="Open Cases"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-300">Listing</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-300">Issuer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-300">Seller</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-300">Shares</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-300">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-300">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading listings...</td>
                  </tr>
                )}
                {!isLoading && listings.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">No listings found.</td>
                  </tr>
                )}
                {!isLoading && listings.map((listing) => (
                  <tr key={listing.id} className="hover:bg-gray-700/25">
                    <td className="px-4 py-3 text-sm text-white">
                      <div className="font-medium">{listing.deal?.title || 'Untitled Listing'}</div>
                      <div className="text-xs text-gray-400">{new Date(listing.listedAt).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-200">
                      <div>{listing.deal?.sme?.name || 'Unknown SME'}</div>
                      <div className="text-xs text-gray-400">{listing.deal?.sme?.sector || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-200">
                      <div>{listing.seller?.name || 'Unknown Seller'}</div>
                      <div className="text-xs text-gray-400">{listing.seller?.type || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-200">{listing.sharesAvailable.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-200">${listing.pricePerShare.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${listing.status === 'ACTIVE'
                          ? 'bg-green-900/50 text-green-300'
                          : listing.status === 'CANCELLED'
                            ? 'bg-red-900/40 text-red-300'
                            : 'bg-gray-700 text-gray-200'
                        }`}>
                        {listing.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isSaving === listing.id || listing.status === 'ACTIVE' || listing.status === 'SOLD'}
                          onClick={() => updateListingStatus(listing.id, 'ACTIVE')}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-600"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={isSaving === listing.id || listing.status === 'CANCELLED' || listing.status === 'SOLD'}
                          onClick={() => updateListingStatus(listing.id, 'CANCELLED')}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-600"
                        >
                          Block
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-white mb-4 mt-8">Launchpad Offerings</h2>
          <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-300">Offering / SME</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-300">Hard Cap</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-300">Raising Period</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {launchpadOfferings.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No offerings found.</td></tr>
                  )}
                  {launchpadOfferings.map((offering) => (
                    <tr key={offering.id} className="hover:bg-gray-700/25">
                      <td className="px-4 py-3 text-sm text-white">
                        <div className="font-medium">{offering.deal?.sme?.name || 'Unknown SME'}</div>
                        <div className="text-xs text-gray-400">{offering.deal?.title}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-200">${offering.hardCap.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-200">
                        {new Date(offering.startTime).toLocaleDateString()} - {new Date(offering.endTime).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => finalizeOffering(offering.id)}
                          disabled={isSaving === offering.id || new Date() < new Date(offering.endTime) || offering.status === 'CLOSED'}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 disabled:bg-gray-700"
                        >
                          {offering.status === 'CLOSED' ? 'Finalized' : isSaving === offering.id ? 'Finalizing...' : 'Finalize & Allocate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

function QuickActionCard({
  title,
  metric,
  subtitle,
  href,
  cta
}: {
  title: string
  metric: string
  subtitle: string
  href: string
  cta: string
}) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
      <p className="text-sm text-gray-400">{title}</p>
      <p className="mt-2 text-2xl font-bold text-white">{metric}</p>
      <p className="mt-2 text-xs text-gray-400">{subtitle}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
      >
        {cta}
      </Link>
    </div>
  )
}
