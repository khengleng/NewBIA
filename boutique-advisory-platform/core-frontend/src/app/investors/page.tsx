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
  X
} from 'lucide-react'
import { useTranslations } from '@/hooks/useTranslations'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { authorizedRequest } from '../../lib/api'

import { User, Investor } from '../../types'

// Local properties removed in favor of shared types

export default function InvestorsPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const { t } = useTranslations()

  const [user, setUser] = useState<User | null>(null)
  const [investors, setInvestors] = useState<Investor[]>([])
  const [filteredInvestors, setFilteredInvestors] = useState<Investor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null)
  const [deletingInvestor, setDeletingInvestor] = useState<Investor | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [editForm, setEditForm] = useState({
    name: '',
    type: '',
    portfolioValue: '',
    activeInvestments: '',
    totalReturns: '',
    location: '',
    status: '',
    description: ''
  })

  useEffect(() => {
    const fetchUserAndData = async () => {
      try {
        // Check for user and token FIRST
        const userData = localStorage.getItem('user')

        if (!userData) {
          setIsLoading(false)
          router.push('/auth/login')
          return
        }

        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)

        // Only fetch if we have valid auth
        const response = await authorizedRequest('/api/investors')
        if (response.ok) {
          const data = await response.json()
          setInvestors(data)
          setFilteredInvestors(data)
        } else if (response.status === 401) {
          // Unauthorized - clear auth and redirect
          localStorage.removeItem('user')
          router.push('/auth/login')
        } else {
          console.error('Failed to fetch investors')
          addToast('error', 'Failed to fetch investors')
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        // Check if it's a JSON parse error from trying to parse HTML
        if (error instanceof SyntaxError) {
          localStorage.removeItem('user')
          router.push('/auth/login')
        } else {
          addToast('error', 'Error loading data')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserAndData()
  }, [router, addToast])

  useEffect(() => {
    // Filter Investors based on search query
    const lowerQuery = searchQuery.toLowerCase()
    const filtered = investors.filter(inv =>
      (inv.name?.toLowerCase() || '').includes(lowerQuery) ||
      (inv.type?.toLowerCase() || '').includes(lowerQuery) ||
      (inv.preferences?.location?.toLowerCase() || '').includes(lowerQuery) ||
      (inv.preferences?.description?.toLowerCase() || '').includes(lowerQuery)
    )
    setFilteredInvestors(filtered)
  }, [searchQuery, investors])

  const handleEdit = (investor: Investor) => {
    setEditingInvestor(investor)
    setEditForm({
      name: investor.name,
      type: investor.type,
      portfolioValue: investor.preferences?.portfolioValue || '',
      activeInvestments: investor.preferences?.activeInvestments || '',
      totalReturns: investor.preferences?.totalReturns || '',
      location: investor.preferences?.location || '',
      status: investor.preferences?.status || 'Active',
      description: investor.preferences?.description || ''
    })
    setShowEditModal(true)
  }

  const handleDelete = (investor: Investor) => {
    setDeletingInvestor(investor)
    setShowDeleteModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingInvestor) return
    setIsSaving(true)

    try {
      // Map form fields back to preferences
      const preferences = {
        portfolioValue: editForm.portfolioValue,
        activeInvestments: editForm.activeInvestments,
        totalReturns: editForm.totalReturns,
        location: editForm.location,
        status: editForm.status,
        description: editForm.description
      }



      const response = await authorizedRequest(`/api/investors/${editingInvestor.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name,
          type: editForm.type,
          preferences
        })
      })



      if (response.ok) {
        const updatedInvestor = await response.json()
        setInvestors(prev => prev.map(i => i.id === updatedInvestor.id ? updatedInvestor : i))
        addToast('success', 'Investor updated successfully')
        setShowEditModal(false)
        setEditingInvestor(null)
      } else if (response.status === 403) {
        console.error('Permission denied - 403 Forbidden')
        addToast('error', 'Permission denied. You do not have access to edit investors.')
      } else if (response.status === 401) {
        console.error('Unauthorized - 401')
        addToast('error', 'Session expired. Please login again.')
        localStorage.removeItem('user')
        router.push('/auth/login')
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Update failed:', response.status, errorData)
        addToast('error', errorData.error || `Failed to update investor (${response.status})`)
      }
    } catch (error) {
      console.error('Error updating investor:', error)
      addToast('error', `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingInvestor) return
    setIsSaving(true)

    try {
      const response = await authorizedRequest(`/api/investors/${deletingInvestor.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setInvestors(prev => prev.filter(i => i.id !== deletingInvestor.id))
        addToast('success', 'Investor deleted successfully')
        setShowDeleteModal(false)
        setDeletingInvestor(null)
      } else {
        const errorData = await response.json()
        addToast('error', errorData.error || 'Failed to delete investor')
      }
    } catch (error) {
      console.error('Error deleting investor:', error)
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
        <h1 className="text-3xl font-bold text-white">Investors</h1>
        {(user?.role === 'ADMIN' || user?.role === 'ADVISOR') && (
          <Link href="/investors/add" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors">
            <Plus className="w-4 h-4 mr-2" />
            Add Investor
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
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>
          <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors">
            <Filter className="w-4 h-4 mr-2" />
            {t('common.filter')}
          </button>
        </div>
      </div>

      {/* Investors Grid */}
      {
        filteredInvestors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInvestors.map((investor) => (
              <div key={investor.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-500 transition-colors shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white truncate">{investor.name}</h3>
                    <p className="text-gray-400 text-sm">{investor.type}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {(() => {
                      const status = investor.kycStatus || 'PENDING';
                      let config = { color: 'bg-gray-500/20 text-gray-400', icon: '⏳', label: t('advisory.kycPending') || 'Pending' };

                      if (status === 'VERIFIED') {
                        config = { color: 'bg-blue-500/20 text-blue-400', icon: '✅', label: t('advisory.kycVerified') || 'Verified' };
                      } else if (status === 'REJECTED') {
                        config = { color: 'bg-red-500/20 text-red-400', icon: '❌', label: 'Rejected' };
                      } else if (status === 'UNDER_REVIEW') {
                        config = { color: 'bg-yellow-500/20 text-yellow-400', icon: '👀', label: 'Under Review' };
                      }

                      return (
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${config.color}`}>
                          {`${config.icon} ${config.label}`}
                        </span>
                      );
                    })()}
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${investor.preferences?.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                      {investor.preferences?.status || 'Active'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('dashboard.portfolioValue')}:</span>
                    <span className="text-white">{investor.preferences?.portfolioValue || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('dashboard.activeInvestments')}:</span>
                    <span className="text-white">{investor.preferences?.activeInvestments || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('dashboard.totalReturns')}:</span>
                    <span className="text-white text-green-400">{investor.preferences?.totalReturns || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Location:</span>
                    <span className="text-white">{investor.preferences?.location || '-'}</span>
                  </div>
                </div>

                <p className="text-gray-300 text-sm mb-4 line-clamp-2 h-10">{investor.preferences?.description || 'No description available'}</p>

                <div className="flex space-x-2">
                  <Link href={`/investors/${investor.id}`} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center transition-colors">
                    <Eye className="w-4 h-4 mr-1" />
                    {t('common.view')}
                  </Link>
                  {(user?.role === 'ADMIN' || user?.role === 'ADVISOR') && (
                    <>
                      <button
                        onClick={() => handleEdit(investor)}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(investor)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No investors found matching your search.</p>
          </div>
        )
      }

      {/* Edit Modal */}
      {
        showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700 shadow-xl">
              <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                <h3 className="text-xl font-semibold text-white">Edit Investor</h3>
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
                    <label className="block text-sm font-medium text-gray-300 mb-2">Investor Name</label>
                    <input
                      type="text"
                      name="name"
                      value={editForm.name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Investor Type</label>
                    <select
                      name="type"
                      value={editForm.type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Type</option>
                      <option value="ANGEL">Angel Investor</option>
                      <option value="VENTURE_CAPITAL">Venture Capital</option>
                      <option value="PRIVATE_EQUITY">Private Equity</option>
                      <option value="INSTITUTIONAL">Institutional</option>
                      <option value="CORPORATE">Corporate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Portfolio Value</label>
                    <input
                      type="text"
                      name="portfolioValue"
                      value={editForm.portfolioValue}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="$1M"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Active Investments</label>
                    <input
                      type="text"
                      name="activeInvestments"
                      value={editForm.activeInvestments}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Total Returns</label>
                    <input
                      type="text"
                      name="totalReturns"
                      value={editForm.totalReturns}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+15%"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                    <input
                      type="text"
                      name="location"
                      value={editForm.location}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="City, Country"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                    <select
                      name="status"
                      value={editForm.status}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="SUSPENDED">Suspended</option>
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
                    placeholder="Describe the investor's background and focus..."
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
        )
      }

      {/* Delete Modal */}
      {
        showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-red-900/50 shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4">Delete Investor</h3>
              <p className="text-gray-400 mb-6">
                Are you sure you want to delete <strong className="text-white">{deletingInvestor?.name}</strong>?
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
        )
      }
    </DashboardLayout >
  )
}
