'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'

type UserRole = 'SME' | 'INVESTOR' | 'ADVISOR' | 'ADMIN' | 'SUPER_ADMIN'

interface CurrentUser {
  id: string
  role: UserRole
}

const STAGE_OPTIONS = [
  { label: 'Seed', value: 'SEED' },
  { label: 'Growth', value: 'GROWTH' },
  { label: 'Expansion', value: 'EXPANSION' },
  { label: 'Mature', value: 'MATURE' }
]

const ONBOARDING_OPTIONS = [
  { label: 'Direct (owner self data)', value: 'DIRECT' },
  { label: 'On behalf of owner', value: 'ON_BEHALF' }
]

export default function AddSMEPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [formData, setFormData] = useState({
    ownerFirstName: '',
    ownerLastName: '',
    ownerEmail: '',
    ownerPassword: '',
    onboardingMode: 'DIRECT',
    mandateDocumentUrl: '',
    mandateDocumentName: '',
    name: '',
    sector: '',
    stage: 'SEED',
    fundingRequired: '',
    description: '',
    website: '',
    location: ''
  })

  const canOnboardOnBehalf = useMemo(
    () => user?.role === 'ADVISOR' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN',
    [user]
  )

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (!userData) {
      router.push('/auth/login')
      return
    }

    const parsedUser = JSON.parse(userData) as CurrentUser
    setUser(parsedUser)

    if (parsedUser.role !== 'ADMIN' && parsedUser.role !== 'ADVISOR' && parsedUser.role !== 'SUPER_ADMIN') {
      alert('You do not have permission to create SMEs.')
      router.push('/smes')
    }
  }, [router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const fundingRequired = Number(String(formData.fundingRequired).replace(/[^\d.]/g, ''))
      if (!Number.isFinite(fundingRequired) || fundingRequired <= 0) {
        alert('Funding required must be a valid positive number')
        return
      }

      if (formData.onboardingMode === 'ON_BEHALF' && !formData.mandateDocumentUrl) {
        alert('Mandate document URL is required for on-behalf onboarding')
        return
      }

      const payload = {
        ownerFirstName: formData.ownerFirstName.trim(),
        ownerLastName: formData.ownerLastName.trim(),
        ownerEmail: formData.ownerEmail.trim(),
        ownerPassword: formData.ownerPassword.trim() || undefined,
        name: formData.name.trim(),
        sector: formData.sector.trim(),
        stage: formData.stage,
        fundingRequired,
        description: formData.description.trim() || undefined,
        website: formData.website.trim() || undefined,
        location: formData.location.trim() || undefined,
        onboardingMode: formData.onboardingMode,
        mandateDocumentUrl: formData.onboardingMode === 'ON_BEHALF' ? formData.mandateDocumentUrl.trim() : undefined,
        mandateDocumentName: formData.onboardingMode === 'ON_BEHALF' ? (formData.mandateDocumentName.trim() || undefined) : undefined
      }

      const response = await authorizedRequest('/api/smes', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        router.push('/smes')
        return
      }

      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      alert(`Failed to create SME: ${errorData.error || 'Unknown error'}`)
    } catch (error) {
      console.error('Error creating SME:', error)
      alert('Error creating SME. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/smes" className="inline-flex items-center text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to SMEs
          </Link>
          <h1 className="text-3xl font-bold text-white mt-3">Add New SME</h1>
          <p className="text-gray-400 mt-1">Advisor/admin onboarding with owner identity and mandate controls</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Owner Identity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Owner First Name *</label>
                <input name="ownerFirstName" value={formData.ownerFirstName} onChange={handleInputChange} required className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Owner Last Name *</label>
                <input name="ownerLastName" value={formData.ownerLastName} onChange={handleInputChange} required className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Owner Email *</label>
                <input type="email" name="ownerEmail" value={formData.ownerEmail} onChange={handleInputChange} required className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Owner Password (optional)</label>
                <input type="password" name="ownerPassword" value={formData.ownerPassword} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Onboarding Controls</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Onboarding Mode *</label>
                <select
                  name="onboardingMode"
                  value={formData.onboardingMode}
                  onChange={handleInputChange}
                  disabled={!canOnboardOnBehalf}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
                >
                  {ONBOARDING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Mandate Document Name</label>
                <input
                  name="mandateDocumentName"
                  value={formData.mandateDocumentName}
                  onChange={handleInputChange}
                  disabled={formData.onboardingMode !== 'ON_BEHALF'}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-300 mb-1">Mandate Document URL {formData.onboardingMode === 'ON_BEHALF' ? '*' : ''}</label>
                <input
                  type="url"
                  name="mandateDocumentUrl"
                  value={formData.mandateDocumentUrl}
                  onChange={handleInputChange}
                  required={formData.onboardingMode === 'ON_BEHALF'}
                  disabled={formData.onboardingMode !== 'ON_BEHALF'}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-4">SME Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">SME Name *</label>
                <input name="name" value={formData.name} onChange={handleInputChange} required className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Sector *</label>
                <input name="sector" value={formData.sector} onChange={handleInputChange} required className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Stage *</label>
                <select name="stage" value={formData.stage} onChange={handleInputChange} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                  {STAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Funding Required (USD) *</label>
                <input name="fundingRequired" value={formData.fundingRequired} onChange={handleInputChange} required placeholder="250000" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-300 mb-1">Website</label>
                <input type="url" name="website" value={formData.website} onChange={handleInputChange} placeholder="https://example.com" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-300 mb-1">Location</label>
                <input name="location" value={formData.location} onChange={handleInputChange} placeholder="Phnom Penh, Cambodia" className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-300 mb-1">Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows={4} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/smes" className="px-5 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700">Cancel</Link>
            <button type="submit" disabled={isLoading} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center disabled:opacity-50">
              {isLoading ? (
                <span className="inline-flex items-center">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating...
                </span>
              ) : (
                <span className="inline-flex items-center">
                  <Save className="w-4 h-4 mr-2" />
                  Create SME
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
