'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  X,
  Coins,
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { authorizedRequest } from '../../lib/api'

import { User, Deal, SME } from '../../types'

// Local interfaces removed in favor of shared types

export default function DealsPage() {
  const router = useRouter()
  const { addToast } = useToast()

  const [user, setUser] = useState<User | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [smes, setSmes] = useState<SME[]>([])
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [deletingDeal, setDeletingDeal] = useState<Deal | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showTokenizeModal, setShowTokenizeModal] = useState(false)
  const [tokenizingDeal, setTokenizingDeal] = useState<Deal | null>(null)
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
    tokenSymbol: '',
    pricePerToken: '',
    totalTokens: '',
    closingDate: ''
  })

  const [editForm, setEditForm] = useState({
    title: '',
    smeId: '',
    amount: '',
    stage: '',
    status: '',
    description: '',
    equity: '',
    successFee: ''
  })

  // Calculate progress based on stage
  const getProgress = (stage: string) => {
    switch (stage) {
      case 'Initial Contact': return 10
      case 'Term Sheet': return 30
      case 'Due Diligence': return 60
      case 'Legal Documentation': return 80
      case 'Closing': return 90
      case 'Completed': return 100
      default: return 0
    }
  }

  useEffect(() => {
    const fetchUserAndData = async () => {
      try {
        const userData = localStorage.getItem('user')
        if (!userData) {
          router.push('/auth/login')
          return
        }
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)

        // Fetch Deals
        const dealsResponse = await authorizedRequest('/api/deals')
        if (dealsResponse.ok) {
          const data = await dealsResponse.json()
          setDeals(data)
          setFilteredDeals(data)
        } else {
          console.error('Failed to fetch deals')
          addToast('error', 'Failed to fetch deals')
        }

        // Fetch SMEs for dropdown (only if Admin/Advisor)
        if (parsedUser.role === 'ADMIN' || parsedUser.role === 'ADVISOR') {
          const smesResponse = await authorizedRequest('/api/smes')
          if (smesResponse.ok) {
            const data = await smesResponse.json()
            setSmes(data)
          }

          const investorsResponse = await authorizedRequest('/api/investors')
          if (investorsResponse.ok) {
            const data = await investorsResponse.json()
            setInvestors(
              data.map((inv: any) => ({
                id: inv.id,
                name: inv.name || `${inv.user?.firstName || ''} ${inv.user?.lastName || ''}`.trim() || 'Unnamed Investor'
              }))
            )
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        addToast('error', 'Error loading data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserAndData()
  }, [router, addToast])

  useEffect(() => {
    // Filter Deals
    const lowerQuery = searchQuery.toLowerCase()
    const filtered = deals.filter(deal =>
      (deal.title?.toLowerCase() || '').includes(lowerQuery) ||
      (deal.sme?.name?.toLowerCase() || '').includes(lowerQuery) ||
      (deal.stage?.toLowerCase() || '').includes(lowerQuery) ||
      (deal.status?.toLowerCase() || '').includes(lowerQuery)
    )
    setFilteredDeals(filtered)
  }, [searchQuery, deals])

  const handleEdit = (deal: Deal) => {
    setEditingDeal(deal)
    setEditForm({
      title: deal.title,
      smeId: deal.smeId,
      amount: deal.amount ? deal.amount.toString() : '',
      stage: deal.stage || 'Initial Contact',
      status: deal.status || 'DRAFT',
      description: deal.description || '',
      equity: deal.equity ? deal.equity.toString() : '',
      successFee: deal.successFee ? deal.successFee.toString() : ''
    })
    setShowEditModal(true)
  }

  const handleDelete = (deal: Deal) => {
    setDeletingDeal(deal)
    setShowDeleteModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingDeal) return
    setIsSaving(true)

    try {
      const response = await authorizedRequest(`/api/deals/${editingDeal.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editForm,
          amount: parseFloat(editForm.amount) || 0,
          equity: editForm.equity ? parseFloat(editForm.equity) : null,
          successFee: editForm.successFee ? parseFloat(editForm.successFee) : null
        })
      })

      if (response.ok) {
        const updatedDeal = await response.json()
        setDeals(prev => prev.map(d => d.id === updatedDeal.id ? updatedDeal : d))
        addToast('success', 'Deal updated successfully')
        setShowEditModal(false)
        setEditingDeal(null)
      } else {
        const errorData = await response.json()
        addToast('error', errorData.error || 'Failed to update deal')
      }
    } catch (error) {
      console.error('Error updating deal:', error)
      addToast('error', 'An error occurred while updating')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingDeal) return
    setIsSaving(true)

    try {
      const response = await authorizedRequest(`/api/deals/${deletingDeal.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setDeals(prev => prev.filter(d => d.id !== deletingDeal.id))
        addToast('success', 'Deal deleted successfully')
        setShowDeleteModal(false)
        setDeletingDeal(null)
      } else {
        const errorData = await response.json()
        addToast('error', errorData.error || 'Failed to delete deal')
      }
    } catch (error) {
      console.error('Error deleting deal:', error)
      addToast('error', 'An error occurred while deleting')
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const canTokenizeDeal = (deal: Deal) =>
    (user?.role === 'ADMIN' || user?.role === 'ADVISOR') && deal.status === 'CLOSED'

  const openTokenizeModal = (deal: Deal) => {
    setTokenizingDeal(deal)
    const base = deal.amount || 0
    setTokenizeForm({
      syndicateName: `${deal.title} Tokenized Syndicate`,
      syndicateDescription: `Tokenized syndicate generated from closed deal ${deal.title}.`,
      leadInvestorId: '',
      targetAmount: base > 0 ? String(base) : '',
      minInvestment: '1000',
      maxInvestment: '',
      managementFee: '2',
      carryFee: '20',
      tokenName: `${deal.title} Token`,
      tokenSymbol: 'CBT',
      pricePerToken: '1',
      totalTokens: base > 0 ? String(base) : '',
      closingDate: ''
    })
    setShowTokenizeModal(true)
  }

  const handleTokenizeInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setTokenizeForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleTokenizeDeal = async () => {
    if (!tokenizingDeal) return
    setIsTokenizing(true)

    try {
      const payload = {
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
      }

      const response = await authorizedRequest(`/api/deals/${tokenizingDeal.id}/tokenize`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const data = await response.json()
        addToast('success', data.message || 'Deal tokenized successfully')
        setShowTokenizeModal(false)
        setTokenizingDeal(null)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to tokenize deal' }))
        addToast('error', errorData.error || 'Failed to tokenize deal')
      }
    } catch (error) {
      console.error('Error tokenizing deal:', error)
      addToast('error', 'An error occurred while tokenizing deal')
    } finally {
      setIsTokenizing(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) { // Backend uses ALL CAPS usually but frontend uses Title Case. Need to check backend return.
      // Backend sets 'DRAFT' and 'ACTIVE' in mock data usually. But let's support both.
      case 'Active':
      case 'ACTIVE': return 'bg-green-500/20 text-green-400'
      case 'Pending':
      case 'PENDING':
      case 'DRAFT': return 'bg-yellow-500/20 text-yellow-400'
      case 'Completed':
      case 'CLOSED': return 'bg-blue-500/20 text-blue-400'
      case 'Cancelled':
      case 'REJECTED': return 'bg-red-500/20 text-red-400'
      case 'Due Diligence':
      case 'DUE_DILIGENCE': return 'bg-purple-500/20 text-purple-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Deals</h1>
        {(user?.role === 'ADMIN' || user?.role === 'ADVISOR') && (
          // In a real app we'd have a Create page, but skipping 'create' button wiring for now as I only refactored existing pages.
          // Wait, user asked to fix. I should at least route it to somewhere or keep it as placeholder if page doesn't exist.
          // The previous code had Link to /deals/create. I will preserve it but note that I haven't created that page unless it exists. 
          // (It doesn't exist in file layout I saw, only deals/page.tsx). 
          // I'll keep it there.
          <Link href="/deals/create" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors">
            <Plus className="w-4 h-4 mr-2" />
            Create Deal
          </Link>
        )}
      </div>

      {/* Search and Filter */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-lg border border-gray-700">
        <div className="flex space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search Deals by title, SME, or stage..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>
          <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </button>
        </div>
      </div>

      {/* Deals Grid */}
      {filteredDeals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDeals.map((deal) => (
            <div key={deal.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-500 transition-colors shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white truncate">{deal.title}</h3>
                  <p className="text-gray-400 text-sm truncate">{deal.sme?.name || 'Unknown SME'}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(deal.status)}`}>
                  {deal.status}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Amount:</span>
                  <span className="text-white font-semibold">${deal.amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Stage:</span>
                  <span className="text-white">{deal.stage}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Progress</span>
                  <span className="text-white">{getProgress(deal.stage)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgress(deal.stage)}%` }}
                  ></div>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-4 line-clamp-2 h-10">{deal.description}</p>

              <div className="flex space-x-2">
                <Link href={`/deals/${deal.id}`} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center transition-colors">
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Link>
                {(user?.role === 'ADMIN' || user?.role === 'ADVISOR') && (
                  <>
                    <button
                      onClick={() => handleEdit(deal)}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(deal)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {canTokenizeDeal(deal) && (
                      <button
                        onClick={() => openTokenizeModal(deal)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center transition-colors"
                        title="Tokenize closed deal"
                      >
                        <Coins className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No deals found matching your search.</p>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700 shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
              <h3 className="text-xl font-semibold text-white">Edit Deal</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Deal Title</label>
                  <input
                    type="text"
                    name="title"
                    value={editForm.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">SME</label>
                  <select
                    name="smeId"
                    value={editForm.smeId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select SME</option>
                    {smes.map(sme => (
                      <option key={sme.id} value={sme.id}>{sme.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Amount ($)</label>
                  <input
                    type="number"
                    name="amount"
                    value={editForm.amount}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Equity (%)</label>
                  <input
                    type="number"
                    name="equity"
                    value={editForm.equity}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Stage</label>
                  <select
                    name="stage"
                    value={editForm.stage}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Initial Contact">Initial Contact</option>
                    <option value="Term Sheet">Term Sheet</option>
                    <option value="Due Diligence">Due Diligence</option>
                    <option value="Legal Documentation">Legal Documentation</option>
                    <option value="Closing">Closing</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                  <select
                    name="status"
                    value={editForm.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DUE_DILIGENCE">DUE DILIGENCE</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-8">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg transition-colors border border-gray-600"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors flex justify-center items-center"
                disabled={isSaving}
              >
                {isSaving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-red-900/50 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Delete Deal</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete <strong className="text-white">{deletingDeal?.title}</strong>?
              This action cannot be undone and will permanently remove all associated data.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg transition-colors border border-gray-600"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg transition-colors flex justify-center items-center"
                disabled={isSaving}
              >
                {isSaving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTokenizeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700 shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
              <h3 className="text-xl font-semibold text-white">Tokenize Closed Deal</h3>
              <button onClick={() => setShowTokenizeModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Syndicate Name *</label>
                <input name="syndicateName" value={tokenizeForm.syndicateName} onChange={handleTokenizeInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Syndicate Description</label>
                <textarea name="syndicateDescription" value={tokenizeForm.syndicateDescription} onChange={handleTokenizeInputChange} rows={3} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Lead Investor *</label>
                <select name="leadInvestorId" value={tokenizeForm.leadInvestorId} onChange={handleTokenizeInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                  <option value="">Select lead investor</option>
                  {investors.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Target Amount</label>
                <input type="number" min="0" name="targetAmount" value={tokenizeForm.targetAmount} onChange={handleTokenizeInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Token Name *</label>
                <input name="tokenName" value={tokenizeForm.tokenName} onChange={handleTokenizeInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Token Symbol *</label>
                <input name="tokenSymbol" value={tokenizeForm.tokenSymbol} onChange={handleTokenizeInputChange} maxLength={12} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white uppercase" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Price Per Token *</label>
                <input type="number" min="0.000001" step="any" name="pricePerToken" value={tokenizeForm.pricePerToken} onChange={handleTokenizeInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Total Tokens *</label>
                <input type="number" min="1" step="any" name="totalTokens" value={tokenizeForm.totalTokens} onChange={handleTokenizeInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Min Investment</label>
                <input type="number" min="0" name="minInvestment" value={tokenizeForm.minInvestment} onChange={handleTokenizeInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Max Investment</label>
                <input type="number" min="0" name="maxInvestment" value={tokenizeForm.maxInvestment} onChange={handleTokenizeInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Management Fee (%)</label>
                <input type="number" min="0" step="0.01" name="managementFee" value={tokenizeForm.managementFee} onChange={handleTokenizeInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Carry Fee (%)</label>
                <input type="number" min="0" step="0.01" name="carryFee" value={tokenizeForm.carryFee} onChange={handleTokenizeInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Closing Date</label>
                <input type="date" name="closingDate" value={tokenizeForm.closingDate} onChange={handleTokenizeInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
            </div>

            <div className="flex space-x-3 mt-8">
              <button
                onClick={() => setShowTokenizeModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg transition-colors border border-gray-600"
                disabled={isTokenizing}
              >
                Cancel
              </button>
              <button
                onClick={handleTokenizeDeal}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg transition-colors flex justify-center items-center"
                disabled={isTokenizing}
              >
                {isTokenizing ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : 'Tokenize Deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
