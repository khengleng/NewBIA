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
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { authorizedRequest } from '../../lib/api'
import usePermissions from '../../hooks/usePermissions'

import { SME } from '../../types'

// Local interfaces removed in favor of shared types

export default function SMEsPage() {
  const router = useRouter()
  const { addToast } = useToast()

  // Use centralized permissions hook
  const { canCreateSME, canEditSME, canDeleteSME, user, isAuthenticated, isLoading: authLoading } = usePermissions()

  const [smes, setSmes] = useState<SME[]>([])
  const [filteredSmes, setFilteredSmes] = useState<SME[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingSME, setEditingSME] = useState<SME | null>(null)
  const [deletingSME, setDeletingSME] = useState<SME | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [editForm, setEditForm] = useState({
    name: '',
    sector: '',
    stage: '',
    fundingRequired: '',
    location: '',
    status: '',
    description: '',
    website: ''
  })

  useEffect(() => {
    const fetchUserAndData = async () => {
      // Wait for auth to finish loading
      if (authLoading) return;

      // Check authentication via hook
      if (!isAuthenticated) {
        router.push('/auth/login')
        return
      }

      try {
        const response = await authorizedRequest('/api/smes')
        if (response.ok) {
          const data = await response.json()
          setSmes(data)
          setFilteredSmes(data)
        } else {
          console.error('Failed to fetch SMEs')
          addToast('error', 'Failed to fetch SMEs')
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        addToast('error', 'Error loading data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserAndData()
  }, [router, addToast, authLoading, isAuthenticated])

  useEffect(() => {
    // Filter SMEs based on search query
    const lowerQuery = searchQuery.toLowerCase()
    const filtered = smes.filter(sme =>
      (sme.name?.toLowerCase() || '').includes(lowerQuery) ||
      (sme.sector?.toLowerCase() || '').includes(lowerQuery) ||
      (sme.location?.toLowerCase() || '').includes(lowerQuery)
    )
    setFilteredSmes(filtered)
  }, [searchQuery, smes])

  const handleEdit = (sme: SME) => {
    setEditingSME(sme)
    setEditForm({
      name: sme.name,
      sector: sme.sector,
      stage: sme.stage,
      fundingRequired: sme.fundingRequired ? sme.fundingRequired.toString() : '',
      location: sme.location || '',
      status: sme.status || 'Active',
      description: sme.description || '',
      website: sme.website || ''
    })
    setShowEditModal(true)
  }

  const handleDelete = (sme: SME) => {
    setDeletingSME(sme)
    setShowDeleteModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingSME) return
    setIsSaving(true)

    try {
      const response = await authorizedRequest(`/api/smes/${editingSME.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editForm,
          fundingRequired: parseFloat(editForm.fundingRequired) || 0
        })
      })

      if (response.ok) {
        const updatedSME = await response.json()
        setSmes(prev => prev.map(s => s.id === updatedSME.id ? updatedSME : s))
        addToast('success', 'SME updated successfully')
        setShowEditModal(false)
        setEditingSME(null)
      } else {
        const errorData = await response.json()
        addToast('error', errorData.error || 'Failed to update SME')
      }
    } catch (error) {
      console.error('Error updating SME:', error)
      addToast('error', 'An error occurred while updating')
    } finally {
      setIsSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingSME) return
    setIsSaving(true)

    try {
      const response = await authorizedRequest(`/api/smes/${deletingSME.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSmes(prev => prev.filter(s => s.id !== deletingSME.id))
        addToast('success', 'SME deleted successfully')
        setShowDeleteModal(false)
        setDeletingSME(null)
      } else {
        const errorData = await response.json()
        addToast('error', errorData.error || 'Failed to delete SME')
      }
    } catch (error) {
      console.error('Error deleting SME:', error)
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
        <h1 className="text-3xl font-bold text-white">SMEs</h1>
        {canCreateSME && (
          <Link href="/smes/add" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors">
            <Plus className="w-4 h-4 mr-2" />
            Add SME
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
                placeholder="Search SMEs by name, sector, or location..."
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

      {/* SMEs Grid */}
      {filteredSmes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSmes.map((sme) => (
            <div key={sme.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-500 transition-colors shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white truncate">{sme.name}</h3>
                  <p className="text-gray-400 text-sm">{sme.sector}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${sme.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                  {sme.status || 'Active'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Stage:</span>
                  <span className="text-white">{sme.stage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Funding Required:</span>
                  <span className="text-white font-medium">
                    ${sme.fundingRequired?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Location:</span>
                  <span className="text-white">{sme.location}</span>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-4 line-clamp-2 h-10">{sme.description}</p>

              <div className="flex space-x-2">
                <Link href={`/smes/${sme.id}`} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center transition-colors">
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Link>
                {(canEditSME() || canDeleteSME) && (
                  <>
                    <button
                      onClick={() => handleEdit(sme)}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(sme)}
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
          <p className="text-gray-400 text-lg">No SMEs found matching your search.</p>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700 shadow-xl">
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
              <h3 className="text-xl font-semibold text-white">Edit SME</h3>
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">Company Name</label>
                  <input
                    type="text"
                    name="name"
                    value={editForm.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sector</label>
                  <select
                    name="sector"
                    value={editForm.sector}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Sector</option>
                    <option value="Technology">Technology</option>
                    <option value="E-commerce">E-commerce</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Finance">Finance</option>
                    <option value="Education">Education</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Agriculture">Agriculture</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Stage</label>
                  <select
                    name="stage"
                    value={editForm.stage}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Stage</option>
                    <option value="Pre-seed">Pre-seed</option>
                    <option value="Seed">Seed</option>
                    <option value="Series A">Series A</option>
                    <option value="Series B">Series B</option>
                    <option value="Series C">Series C</option>
                    <option value="Growth">Growth</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Funding Required ($)</label>
                  <input
                    type="number"
                    name="fundingRequired"
                    value={editForm.fundingRequired}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="100000"
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">Website</label>
                  <input
                    type="text"
                    name="website"
                    value={editForm.website}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                  />
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
                  placeholder="Describe the business..."
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
            <h3 className="text-lg font-semibold text-white mb-4">Delete SME</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete <strong className="text-white">{deletingSME?.name}</strong>?
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
    </DashboardLayout>
  )
}
