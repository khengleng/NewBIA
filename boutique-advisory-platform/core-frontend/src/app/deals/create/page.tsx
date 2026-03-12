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
  DollarSign,
  Calendar,
  TrendingUp,
  FileText as DocumentIcon,
  Shield,
  Lock
} from 'lucide-react'

export default function CreateDealPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    // Basic Deal Information
    dealTitle: '',
    dealType: '',
    dealStage: '',
    dealSize: '',
    equityOffered: '',
    valuation: '',

    // SME Information
    smeId: '',
    smeName: '',
    smeSector: '',
    smeStage: '',

    // Investment Details
    investmentAmount: '',
    minimumInvestment: '',
    maximumInvestment: '',
    expectedReturn: '',
    investmentTerm: '',
    exitStrategy: '',
    terms: '',
    isDocumentLocked: false,

    // Deal Timeline
    closingDate: '',
    fundingDeadline: '',
    expectedCloseDate: '',

    // Deal Description
    dealSummary: '',
    businessModel: '',
    marketOpportunity: '',
    competitiveAdvantage: '',
    useOfFunds: '',
    riskFactors: '',

    // Financial Information
    currentRevenue: '',
    projectedRevenue: '',
    currentProfit: '',
    projectedProfit: '',
    burnRate: '',
    runway: '',

    // Documents
    pitchDeck: null as File | null,
    financialModel: null as File | null,
    businessPlan: null as File | null,
    legalDocuments: null as File | null
  })

  const dealTypes = [
    'Equity Investment',
    'Convertible Note',
    'Revenue Sharing',
    'Debt Financing',
    'Mezzanine Financing',
    'Bridge Loan',
    'Series A',
    'Series B',
    'Series C',
    'Growth Capital'
  ]

  const dealStages = [
    'Initial Review',
    'Due Diligence',
    'Term Sheet',
    'Negotiation',
    'Documentation',
    'Closing',
    'Funded',
    'Monitoring'
  ]

  const exitStrategies = [
    'IPO',
    'Strategic Acquisition',
    'Management Buyout',
    'Secondary Sale',
    'Dividend Recapitalization',
    'Asset Sale',
    'Liquidation'
  ]

  const investmentTerms = [
    '1-2 years',
    '3-5 years',
    '5-7 years',
    '7-10 years',
    '10+ years'
  ]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
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
      router.push('/deals')
    } catch (error) {
      console.error('Error creating deal:', error)
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
              <Link href="/investors" className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
                <Users className="w-5 h-5 mr-3" />Investors
              </Link>
              <Link href="/deals" className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg">
                <Handshake className="w-5 h-5 mr-3" />Deals
              </Link>
              <Link href="/advisory" className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
                <FileText className="w-5 h-5 mr-3" />Advisory
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
              <Link href="/deals" className="flex items-center text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />Back to Deals
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-white">Create New Deal</h1>
            <p className="text-gray-400 mt-2">Create a new investment opportunity</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Deal Information */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                <Handshake className="w-5 h-5 mr-2" />Basic Deal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Deal Title *</label>
                  <input type="text" name="dealTitle" value={formData.dealTitle} onChange={handleInputChange} required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Deal Type *</label>
                  <select name="dealType" value={formData.dealType} onChange={handleInputChange} required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Deal Type</option>
                    {dealTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Deal Stage</label>
                  <select name="dealStage" value={formData.dealStage} onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Deal Stage</option>
                    {dealStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Deal Size</label>
                  <input type="text" name="dealSize" value={formData.dealSize} onChange={handleInputChange}
                    placeholder="e.g., $500K - $2M"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Equity Offered</label>
                  <input type="text" name="equityOffered" value={formData.equityOffered} onChange={handleInputChange}
                    placeholder="e.g., 10-25%"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Valuation</label>
                  <input type="text" name="valuation" value={formData.valuation} onChange={handleInputChange}
                    placeholder="e.g., $5M"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* SME Information */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                <Building2 className="w-5 h-5 mr-2" />SME Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">SME Name *</label>
                  <input type="text" name="smeName" value={formData.smeName} onChange={handleInputChange} required
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">SME Sector</label>
                  <input type="text" name="smeSector" value={formData.smeSector} onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">SME Stage</label>
                  <input type="text" name="smeStage" value={formData.smeStage} onChange={handleInputChange}
                    placeholder="e.g., Seed, Series A, Growth"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Investment Details */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />Investment Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Investment Amount *</label>
                  <input type="text" name="investmentAmount" value={formData.investmentAmount} onChange={handleInputChange} required
                    placeholder="e.g., $1,000,000"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Minimum Investment</label>
                  <input type="text" name="minimumInvestment" value={formData.minimumInvestment} onChange={handleInputChange}
                    placeholder="e.g., $50,000"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Maximum Investment</label>
                  <input type="text" name="maximumInvestment" value={formData.maximumInvestment} onChange={handleInputChange}
                    placeholder="e.g., $500,000"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Expected Return</label>
                  <input type="text" name="expectedReturn" value={formData.expectedReturn} onChange={handleInputChange}
                    placeholder="e.g., 20-30%"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Investment Term</label>
                  <select name="investmentTerm" value={formData.investmentTerm} onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Investment Term</option>
                    {investmentTerms.map(term => <option key={term} value={term}>{term}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Exit Strategy</label>
                  <select name="exitStrategy" value={formData.exitStrategy} onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Exit Strategy</option>
                    {exitStrategies.map(strategy => <option key={strategy} value={strategy}>{strategy}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Key Terms & Conditions</label>
                <textarea name="terms" value={formData.terms} onChange={handleInputChange} rows={4}
                  placeholder="Outline key terms, rights, and conditions..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Deal Timeline */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />Deal Timeline
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Closing Date</label>
                  <input type="date" name="closingDate" value={formData.closingDate} onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Funding Deadline</label>
                  <input type="date" name="fundingDeadline" value={formData.fundingDeadline} onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Expected Close Date</label>
                  <input type="date" name="expectedCloseDate" value={formData.expectedCloseDate} onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Deal Description */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Deal Description</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Deal Summary *</label>
                  <textarea name="dealSummary" value={formData.dealSummary} onChange={handleInputChange} required rows={4}
                    placeholder="Provide a comprehensive summary of the investment opportunity..."
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Business Model</label>
                  <textarea name="businessModel" value={formData.businessModel} onChange={handleInputChange} rows={3}
                    placeholder="Describe the business model and revenue streams..."
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Market Opportunity</label>
                  <textarea name="marketOpportunity" value={formData.marketOpportunity} onChange={handleInputChange} rows={3}
                    placeholder="Describe the market opportunity and growth potential..."
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Competitive Advantage</label>
                  <textarea name="competitiveAdvantage" value={formData.competitiveAdvantage} onChange={handleInputChange} rows={3}
                    placeholder="What gives this business a competitive edge?"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Use of Funds</label>
                  <textarea name="useOfFunds" value={formData.useOfFunds} onChange={handleInputChange} rows={3}
                    placeholder="How will the investment be used?"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Risk Factors</label>
                  <textarea name="riskFactors" value={formData.riskFactors} onChange={handleInputChange} rows={3}
                    placeholder="What are the key risk factors investors should consider?"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Financial Information */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />Financial Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Current Revenue</label>
                  <input type="text" name="currentRevenue" value={formData.currentRevenue} onChange={handleInputChange}
                    placeholder="e.g., $500,000"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Projected Revenue</label>
                  <input type="text" name="projectedRevenue" value={formData.projectedRevenue} onChange={handleInputChange}
                    placeholder="e.g., $2,000,000"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Current Profit</label>
                  <input type="text" name="currentProfit" value={formData.currentProfit} onChange={handleInputChange}
                    placeholder="e.g., $100,000"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Projected Profit</label>
                  <input type="text" name="projectedProfit" value={formData.projectedProfit} onChange={handleInputChange}
                    placeholder="e.g., $500,000"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Burn Rate</label>
                  <input type="text" name="burnRate" value={formData.burnRate} onChange={handleInputChange}
                    placeholder="e.g., $50,000/month"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Runway</label>
                  <input type="text" name="runway" value={formData.runway} onChange={handleInputChange}
                    placeholder="e.g., 12 months"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center">
                  <DocumentIcon className="w-5 h-5 mr-2" />Documents
                </h2>
                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer relative">
                    <input
                      type="checkbox"
                      id="isDocumentLocked"
                      checked={formData.isDocumentLocked}
                      onChange={(e) => setFormData(prev => ({ ...prev, isDocumentLocked: e.target.checked }))}
                      className="sr-only"
                    />
                    <div className={`w-11 h-6 bg-gray-700 rounded-full border border-gray-600 transition-colors ${formData.isDocumentLocked ? 'bg-blue-600 border-blue-500' : ''}`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.isDocumentLocked ? 'translate-x-5' : ''}`}></div>
                    <span className="ml-3 text-sm text-gray-300 flex items-center">
                      <Shield className="w-4 h-4 mr-1 text-blue-400" />
                      Confidential (Lock Documents)
                    </span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Pitch Deck</label>
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <input type="file" name="pitchDeck" onChange={handleFileChange} accept=".pdf,.ppt,.pptx" className="hidden" id="pitchDeck" />
                    <label htmlFor="pitchDeck" className="cursor-pointer text-blue-400 hover:text-blue-300">Upload Pitch Deck</label>
                    <p className="text-xs text-gray-500 mt-1">PDF, PPT, PPTX (Max 10MB)</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Financial Model</label>
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <input type="file" name="financialModel" onChange={handleFileChange} accept=".xlsx,.xls,.pdf" className="hidden" id="financialModel" />
                    <label htmlFor="financialModel" className="cursor-pointer text-blue-400 hover:text-blue-300">Upload Financial Model</label>
                    <p className="text-xs text-gray-500 mt-1">XLSX, XLS, PDF (Max 10MB)</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Business Plan</label>
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <input type="file" name="businessPlan" onChange={handleFileChange} accept=".pdf,.doc,.docx" className="hidden" id="businessPlan" />
                    <label htmlFor="businessPlan" className="cursor-pointer text-blue-400 hover:text-blue-300">Upload Business Plan</label>
                    <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX (Max 10MB)</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Legal Documents</label>
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <input type="file" name="legalDocuments" onChange={handleFileChange} accept=".pdf" className="hidden" id="legalDocuments" />
                    <label htmlFor="legalDocuments" className="cursor-pointer text-blue-400 hover:text-blue-300">Upload Legal Documents</label>
                    <p className="text-xs text-gray-500 mt-1">PDF only (Max 10MB)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <Link href="/deals" className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700">Cancel</Link>
              <button type="submit" disabled={isLoading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center disabled:opacity-50">
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Creating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />Create Deal
                  </>
                )}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div >
  )
}
