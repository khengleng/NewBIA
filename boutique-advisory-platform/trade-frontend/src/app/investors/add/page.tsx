'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Users,
  Handshake,
  BarChart3,
  FileText,
  Settings,
  ArrowLeft,
  Save,
  Upload,
  Briefcase,
  TrendingUp,
  FileText as DocumentIcon
} from 'lucide-react'

export default function AddInvestorPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    investorType: '',
    investmentRange: '',
    preferredSectors: [] as string[],
    netWorth: '',
    annualIncome: '',
    occupation: '',
    company: '',
    riskTolerance: '',
    investmentGoals: '',
    identificationDocument: null as File | null,
    proofOfFunds: null as File | null
  })

  const investorTypes = [
    'Angel Investor',
    'Venture Capitalist',
    'Private Equity',
    'Institutional Investor',
    'Corporate Investor',
    'Family Office',
    'High Net Worth Individual'
  ]

  const sectors = [
    'Technology', 'Manufacturing', 'Retail & E-commerce', 'Healthcare',
    'Education', 'Agriculture', 'Financial Services', 'Real Estate'
  ]

  const investmentRanges = [
    '$10K - $50K', '$50K - $100K', '$100K - $500K', '$500K - $1M',
    '$1M - $5M', '$5M - $10M', '$10M+'
  ]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target
    setFormData(prev => ({
      ...prev,
      preferredSectors: checked
        ? [...prev.preferredSectors, value]
        : prev.preferredSectors.filter(sector => sector !== value)
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target
    if (files && files[0]) {
      setFormData(prev => ({ ...prev, [name]: files[0] }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      router.push('/investors')
    } catch (error) {
      console.error('Error creating Investor:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Boutique Advisory</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 bg-gray-800 min-h-screen">
          <nav className="mt-8">
            <div className="px-4 space-y-2">
              <Link href="/dashboard" className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
                <BarChart3 className="w-5 h-5 mr-3" />Dashboard
              </Link>
              <Link href="/smes" className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
                <Building2 className="w-5 h-5 mr-3" />SMEs
              </Link>
              <Link href="/investors" className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg">
                <Users className="w-5 h-5 mr-3" />Investors
              </Link>
              <Link href="/deals" className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
                <Handshake className="w-5 h-5 mr-3" />Deals
              </Link>
              <Link href="/reports" className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
                <FileText className="w-5 h-5 mr-3" />Reports
              </Link>
              <Link href="/settings" className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
                <Settings className="w-5 h-5 mr-3" />Settings
              </Link>
            </div>
          </nav>
        </aside>

        <main className="flex-1 p-8">
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <Link href="/investors" className="flex items-center text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />Back to Investors
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-white">Add New Investor</h1>
            <p className="text-gray-400 mt-2">Register a new investor profile</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                <Users className="w-5 h-5 mr-2" />Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">First Name *</label>
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Last Name *</label>
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Investment Profile */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />Investment Profile
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Investor Type *</label>
                  <select name="investorType" value={formData.investorType} onChange={handleInputChange} required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Investor Type</option>
                    {investorTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Investment Range</label>
                  <select name="investmentRange" value={formData.investmentRange} onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Investment Range</option>
                    {investmentRanges.map(range => <option key={range} value={range}>{range}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Net Worth</label>
                  <input type="text" name="netWorth" value={formData.netWorth} onChange={handleInputChange}
                    placeholder="e.g., $1,000,000"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Annual Income</label>
                  <input type="text" name="annualIncome" value={formData.annualIncome} onChange={handleInputChange}
                    placeholder="e.g., $200,000"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Preferred Sectors */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">Preferred Sectors</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {sectors.map(sector => (
                    <label key={sector} className="flex items-center space-x-2">
                      <input type="checkbox" value={sector} checked={formData.preferredSectors.includes(sector)} onChange={handleCheckboxChange}
                        className="rounded border-gray-600 text-blue-600 focus:ring-blue-500" />
                      <span className="text-sm text-gray-300">{sector}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Professional Background */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                <Briefcase className="w-5 h-5 mr-2" />Professional Background
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Occupation</label>
                  <input type="text" name="occupation" value={formData.occupation} onChange={handleInputChange}
                    placeholder="e.g., CEO, Entrepreneur"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Company</label>
                  <input type="text" name="company" value={formData.company} onChange={handleInputChange}
                    placeholder="e.g., ABC Corporation"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Investment Preferences */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Investment Preferences</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Investment Goals</label>
                  <textarea name="investmentGoals" value={formData.investmentGoals} onChange={handleInputChange} rows={3}
                    placeholder="Describe your investment goals and objectives..."
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Risk Tolerance</label>
                  <select name="riskTolerance" value={formData.riskTolerance} onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Risk Tolerance</option>
                    <option value="Conservative">Conservative</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Aggressive">Aggressive</option>
                    <option value="Very Aggressive">Very Aggressive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                <DocumentIcon className="w-5 h-5 mr-2" />Documents
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Identification Document</label>
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <input type="file" name="identificationDocument" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" className="hidden" id="identificationDocument" />
                    <label htmlFor="identificationDocument" className="cursor-pointer text-blue-400 hover:text-blue-300">Upload ID Document</label>
                    <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (Max 5MB)</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Proof of Funds</label>
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <input type="file" name="proofOfFunds" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" className="hidden" id="proofOfFunds" />
                    <label htmlFor="proofOfFunds" className="cursor-pointer text-blue-400 hover:text-blue-300">Upload Proof of Funds</label>
                    <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (Max 5MB)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <Link href="/investors" className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700">Cancel</Link>
              <button type="submit" disabled={isLoading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center disabled:opacity-50">
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />Create Investor
                  </>
                )}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  )
}
