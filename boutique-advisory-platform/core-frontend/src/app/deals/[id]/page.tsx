'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Coins, RefreshCw, Save } from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'

interface CurrentUser {
  id: string
  role: 'SME' | 'INVESTOR' | 'ADVISOR' | 'ADMIN' | 'SUPER_ADMIN' | 'FINOPS' | 'CX' | 'AUDITOR' | 'COMPLIANCE' | 'SUPPORT'
}

interface DealInvestor {
  id: string
  amount: number
  status: string
  investor?: {
    id: string
    name?: string
    user?: { firstName?: string; lastName?: string; email?: string }
  }
}

interface DealDocument {
  id: string
  name: string
  type: string
  url?: string
  createdAt?: string
}

interface DealRecord {
  id: string
  title: string
  description?: string
  amount: number
  equity?: number | null
  successFee?: number | null
  status: string
  terms?: string
  createdAt?: string
  updatedAt?: string
  sme?: {
    id: string
    name: string
    sector?: string
    stage?: string
    status?: string
    user?: { firstName?: string; lastName?: string; email?: string }
  }
  investors?: DealInvestor[]
  documents?: DealDocument[]
}

const STATUS_OPTIONS = ['DRAFT', 'PUBLISHED', 'NEGOTIATION', 'DUE_DILIGENCE', 'FUNDED', 'CLOSED', 'CANCELLED']

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  const [user, setUser] = useState<CurrentUser | null>(null)
  const [deal, setDeal] = useState<DealRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [statusValue, setStatusValue] = useState('')

  const [showTokenize, setShowTokenize] = useState(false)
  const [isTokenizing, setIsTokenizing] = useState(false)
  const [investors, setInvestors] = useState<Array<{ id: string; name: string }>>([])
  const [tokenizeForm, setTokenizeForm] = useState({
    syndicateName: '',
    syndicateDescription: '',
    leadInvestorId: '',
    targetAmount: '',
    minInvestment: '1000',
    maxInvestment: '',
    managementFee: '2',
    carryFee: '20',
    tokenName: '',
    tokenSymbol: 'CBT',
    pricePerToken: '1',
    totalTokens: '',
    closingDate: ''
  })

  const canManage = useMemo(() => {
    return user?.role === 'ADMIN' || user?.role === 'ADVISOR' || user?.role === 'SUPER_ADMIN'
  }, [user])

  const canTokenize = useMemo(() => {
    return (canManage || user?.role === 'SME') && deal?.status === 'CLOSED'
  }, [canManage, user?.role, deal?.status])

  const loadDeal = useCallback(async () => {
    const response = await authorizedRequest(`/api/deals/${dealId}`)
    if (!response.ok) {
      throw new Error('Failed to load deal')
    }
    const data = await response.json()
    setDeal(data)
    setStatusValue(data.status || '')
  }, [dealId])

  useEffect(() => {
    const init = async () => {
      try {
        const userData = localStorage.getItem('user')
        if (!userData) {
          router.push('/auth/login')
          return
        }

        const parsedUser = JSON.parse(userData) as CurrentUser
        setUser(parsedUser)

        await loadDeal()

        if (parsedUser.role === 'ADMIN' || parsedUser.role === 'ADVISOR' || parsedUser.role === 'SUPER_ADMIN') {
          const investorsRes = await authorizedRequest('/api/investors')
          if (investorsRes.ok) {
            const invData = (await investorsRes.json()) as Array<{
              id: string
              name?: string
              user?: { firstName?: string; lastName?: string }
            }>
            setInvestors(
              invData.map((inv) => ({
                id: inv.id,
                name: inv.name || `${inv.user?.firstName || ''} ${inv.user?.lastName || ''}`.trim() || 'Unnamed Investor'
              }))
            )
          }
        }
      } catch (error: unknown) {
        console.error(error)
        alert('Failed to load deal details')
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [dealId, loadDeal, router])

  const handleSaveStatus = async () => {
    if (!deal || !statusValue || statusValue === deal.status) return
    setIsSavingStatus(true)
    try {
      const response = await authorizedRequest(`/api/deals/${deal.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: statusValue })
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to update status' }))
        throw new Error(err.error || 'Failed to update status')
      }
      await loadDeal()
      alert('Deal status updated')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update status'
      alert(message)
    } finally {
      setIsSavingStatus(false)
    }
  }

  const openTokenize = () => {
    if (!deal) return
    setTokenizeForm((prev) => ({
      ...prev,
      syndicateName: `${deal.title} Tokenized Syndicate`,
      syndicateDescription: `Tokenized syndicate generated from closed deal ${deal.title}.`,
      targetAmount: deal.amount ? String(deal.amount) : '',
      tokenName: `${deal.title} Token`,
      totalTokens: deal.amount ? String(deal.amount) : ''
    }))
    setShowTokenize(true)
  }

  const handleTokenize = async () => {
    if (!deal) return
    setIsTokenizing(true)
    try {
      const response = await authorizedRequest(`/api/deals/${deal.id}/tokenize`, {
        method: 'POST',
        body: JSON.stringify({
          syndicateName: tokenizeForm.syndicateName,
          syndicateDescription: tokenizeForm.syndicateDescription || undefined,
          leadInvestorId: tokenizeForm.leadInvestorId,
          targetAmount: tokenizeForm.targetAmount ? parseFloat(tokenizeForm.targetAmount) : undefined,
          minInvestment: tokenizeForm.minInvestment ? parseFloat(tokenizeForm.minInvestment) : undefined,
          maxInvestment: tokenizeForm.maxInvestment ? parseFloat(tokenizeForm.maxInvestment) : undefined,
          managementFee: tokenizeForm.managementFee ? parseFloat(tokenizeForm.managementFee) : undefined,
          carryFee: tokenizeForm.carryFee ? parseFloat(tokenizeForm.carryFee) : undefined,
          tokenName: tokenizeForm.tokenName,
          tokenSymbol: tokenizeForm.tokenSymbol.toUpperCase(),
          pricePerToken: parseFloat(tokenizeForm.pricePerToken),
          totalTokens: parseFloat(tokenizeForm.totalTokens),
          closingDate: tokenizeForm.closingDate || undefined
        })
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to tokenize deal')
      }

      setShowTokenize(false)
      alert(data.message || 'Deal tokenized successfully')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to tokenize deal'
      alert(message)
    } finally {
      setIsTokenizing(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      </DashboardLayout>
    )
  }

  if (!deal) {
    return (
      <DashboardLayout>
        <div className="text-center text-gray-400">Deal not found</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/deals" className="inline-flex items-center text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to deals
            </Link>
            <h1 className="text-3xl font-bold text-white mt-3">{deal.title}</h1>
            <p className="text-gray-400 mt-1">Deal ID: {deal.id}</p>
          </div>
          <button onClick={loadDeal} className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 inline-flex items-center">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-400">Status</p>
            <p className="text-white font-semibold mt-1">{deal.status}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-400">Amount</p>
            <p className="text-white font-semibold mt-1">${Number(deal.amount || 0).toLocaleString()}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-400">SME</p>
            <p className="text-white font-semibold mt-1">{deal.sme?.name || '-'}</p>
          </div>
        </div>

        {(canManage || user?.role === 'SME') && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-4">
            <h2 className="text-white font-semibold">Deal Controls</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="text-sm text-gray-300">Status</label>
                <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className="block mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSaveStatus}
                disabled={isSavingStatus || statusValue === deal.status}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSavingStatus ? 'Saving...' : 'Save Status'}
              </button>

              {canTokenize && (
                <button
                  onClick={openTokenize}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 inline-flex items-center"
                >
                  <Coins className="w-4 h-4 mr-2" />
                  Tokenize Deal
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <h2 className="text-white font-semibold mb-3">Deal Information</h2>
            <div className="space-y-2 text-sm">
              <p className="text-gray-300"><span className="text-gray-400">Description:</span> {deal.description || '-'}</p>
              <p className="text-gray-300"><span className="text-gray-400">Equity:</span> {deal.equity ?? '-'}</p>
              <p className="text-gray-300"><span className="text-gray-400">Success Fee:</span> {deal.successFee ?? '-'}</p>
              <p className="text-gray-300"><span className="text-gray-400">Terms:</span> {deal.terms || '-'}</p>
              <p className="text-gray-300"><span className="text-gray-400">Updated:</span> {deal.updatedAt ? new Date(deal.updatedAt).toLocaleString() : '-'}</p>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <h2 className="text-white font-semibold mb-3">SME Profile</h2>
            <div className="space-y-2 text-sm">
              <p className="text-gray-300"><span className="text-gray-400">Name:</span> {deal.sme?.name || '-'}</p>
              <p className="text-gray-300"><span className="text-gray-400">Sector:</span> {deal.sme?.sector || '-'}</p>
              <p className="text-gray-300"><span className="text-gray-400">Stage:</span> {deal.sme?.stage || '-'}</p>
              <p className="text-gray-300"><span className="text-gray-400">SME Status:</span> {deal.sme?.status || '-'}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <h2 className="text-white font-semibold mb-3">Investors</h2>
          {deal.investors && deal.investors.length > 0 ? (
            <div className="space-y-2">
              {deal.investors.map((inv) => (
                <div key={inv.id} className="flex justify-between text-sm border-b border-gray-700 pb-2">
                  <span className="text-gray-300">{inv.investor?.name || inv.investor?.user?.email || inv.investor?.id || 'Unknown Investor'}</span>
                  <span className="text-gray-400">${Number(inv.amount || 0).toLocaleString()} • {inv.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No investor allocations yet.</p>
          )}
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <h2 className="text-white font-semibold mb-3">Documents</h2>
          {deal.documents && deal.documents.length > 0 ? (
            <div className="space-y-2">
              {deal.documents.map((doc) => (
                <div key={doc.id} className="flex justify-between text-sm border-b border-gray-700 pb-2">
                  <span className="text-gray-300">{doc.name} ({doc.type})</span>
                  {doc.url ? (
                    <a href={doc.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">Open</a>
                  ) : (
                    <span className="text-gray-500">No URL</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No documents uploaded yet.</p>
          )}
        </div>
      </div>

      {showTokenize && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-gray-800 border border-gray-700 rounded-xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-white text-xl font-semibold mb-4">Tokenize Closed Deal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm text-gray-300">Syndicate Name *</label>
                <input value={tokenizeForm.syndicateName} onChange={(e) => setTokenizeForm((p) => ({ ...p, syndicateName: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-300">Syndicate Description</label>
                <textarea value={tokenizeForm.syndicateDescription} onChange={(e) => setTokenizeForm((p) => ({ ...p, syndicateDescription: e.target.value }))} rows={3} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-300">Lead Investor *</label>
                <select value={tokenizeForm.leadInvestorId} onChange={(e) => setTokenizeForm((p) => ({ ...p, leadInvestorId: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                  <option value="">Select investor</option>
                  {investors.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-300">Target Amount</label>
                <input type="number" min="0" value={tokenizeForm.targetAmount} onChange={(e) => setTokenizeForm((p) => ({ ...p, targetAmount: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-300">Token Name *</label>
                <input value={tokenizeForm.tokenName} onChange={(e) => setTokenizeForm((p) => ({ ...p, tokenName: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-300">Token Symbol *</label>
                <input value={tokenizeForm.tokenSymbol} onChange={(e) => setTokenizeForm((p) => ({ ...p, tokenSymbol: e.target.value.toUpperCase() }))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white uppercase" maxLength={12} />
              </div>
              <div>
                <label className="text-sm text-gray-300">Price Per Token *</label>
                <input type="number" min="0.000001" step="any" value={tokenizeForm.pricePerToken} onChange={(e) => setTokenizeForm((p) => ({ ...p, pricePerToken: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-300">Total Tokens *</label>
                <input type="number" min="1" step="any" value={tokenizeForm.totalTokens} onChange={(e) => setTokenizeForm((p) => ({ ...p, totalTokens: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-300">Min Investment</label>
                <input type="number" min="0" value={tokenizeForm.minInvestment} onChange={(e) => setTokenizeForm((p) => ({ ...p, minInvestment: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-300">Max Investment</label>
                <input type="number" min="0" value={tokenizeForm.maxInvestment} onChange={(e) => setTokenizeForm((p) => ({ ...p, maxInvestment: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-300">Management Fee (%)</label>
                <input type="number" min="0" step="0.01" value={tokenizeForm.managementFee} onChange={(e) => setTokenizeForm((p) => ({ ...p, managementFee: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="text-sm text-gray-300">Carry Fee (%)</label>
                <input type="number" min="0" step="0.01" value={tokenizeForm.carryFee} onChange={(e) => setTokenizeForm((p) => ({ ...p, carryFee: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-300">Closing Date</label>
                <input type="date" value={tokenizeForm.closingDate} onChange={(e) => setTokenizeForm((p) => ({ ...p, closingDate: e.target.value }))} className="w-full mt-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowTokenize(false)} disabled={isTokenizing} className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">Cancel</button>
              <button onClick={handleTokenize} disabled={isTokenizing} className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">
                {isTokenizing ? 'Tokenizing...' : 'Tokenize Deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
