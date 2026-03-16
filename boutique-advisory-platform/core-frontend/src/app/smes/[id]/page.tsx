'use client'
import { API_URL, authorizedRequest } from '@/lib/api'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Handshake,
  DollarSign,
  TrendingUp,
  FileText as DocumentIcon,
  Eye,
  Settings,
  Phone,
  Mail,
  Globe,
  Award,
  MapPin,
  ArrowLeft,
  Edit,
  Download,
  Building2,
  BarChart3,
  Users,
  LogOut,
  Bell,
  FileText,
  Heart,
  Sparkles,
  Upload
} from 'lucide-react'
import { useTranslations } from '@/hooks/useTranslations'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/contexts/ToastContext'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'SME' | 'INVESTOR' | 'ADVISOR' | 'ADMIN' | 'SUPER_ADMIN' | 'FINOPS' | 'CX' | 'AUDITOR' | 'COMPLIANCE' | 'SUPPORT'
  tenantId: string
}

export default function SMEPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useTranslations()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState('OTHER')
  const [showCertifyDialog, setShowCertifyDialog] = useState(false)
  const [showInterestDialog, setShowInterestDialog] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = localStorage.getItem('user')

        if (!userData) {
          router.push('/auth/login')
          return
        }

        const user = JSON.parse(userData)
        setUser(user)
      } catch (error) {
        console.error('Error fetching user:', error)
        localStorage.removeItem('user')
        router.push('/auth/login')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUser()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/')
  }

  const handleEdit = () => {
    setShowEditModal(true)
  }



  const handleCreateDeal = () => {
    router.push('/deals/create')
  }

  const handleViewDocument = async (docId: string) => {
    try {
      const response = await authorizedRequest(`/api/documents/${docId}`)

      if (response.ok) {
        const data = await response.json()
        if (data.url) {
          window.open(data.url, '_blank')
        }
      } else {
        console.error('Document not found')
        addToast('error', 'Document not found or access denied')
      }
    } catch (error) {
      console.error('Error viewing document:', error)
      addToast('error', 'Error opening document')
    }
  }

  const handleDownloadDocument = async (docId: string) => {
    try {
      const response = await authorizedRequest(`/api/documents/${docId}/download`)

      if (response.ok) {
        const data = await response.json()
        if (data.url) {
          window.open(data.url, '_blank')
        }
      } else {
        console.error('Document download failed')
        addToast('error', 'Failed to generate download link')
      }
    } catch (error) {
      console.error('Error downloading document:', error)
      addToast('error', 'Error downloading document')
    }
  }

  const handleUploadDocument = () => {
    setShowUploadModal(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadFile(e.target.files[0])
    }
  }

  const performUpload = async () => {
    if (!uploadFile) return

    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('name', uploadFile.name)
      formData.append('type', uploadType)
      formData.append('smeId', params.id as string)

      const response = await authorizedRequest('/api/documents/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const newDoc = await response.json()
        setSme((prev: any) => ({
          ...prev,
          documents: [...prev.documents, {
            name: newDoc.name,
            type: newDoc.type,
            size: `${(newDoc.size / 1024 / 1024).toFixed(2)} MB`,
            uploaded: new Date(newDoc.createdAt).toISOString().split('T')[0]
          }]
        }))
        setShowUploadModal(false)
        setUploadFile(null)
        alert('Document uploaded successfully!')
      } else {
        alert('Failed to upload document')
      }
    } catch (error) {
      console.error('Error uploading document:', error)
      alert('Error uploading document')
    }
  }

  const [editFormData, setEditFormData] = useState({
    name: '',
    sector: '',
    stage: 'SEED',
    fundingRequired: '',
    description: '',
    website: '',
    location: '',
    currentAssets: '',
    currentLiabilities: '',
    totalRevenue: '',
    netProfit: '',
    customerRetention: '',
    marketShare: '',
    employeeSatisfaction: ''
  })

  // Mock SME data as initial state
  const initialSme = {
    id: params.id,
    name: 'Tech Startup A',
    registrationNumber: 'REG-2024-001',
    taxId: 'TAX-123456789',
    foundedDate: '2022-03-15',
    website: 'https://techstartupa.com',
    address: '123 Innovation Street',
    city: 'Phnom Penh',
    province: 'Phnom Penh',
    postalCode: '12000',
    phone: '+855 12 345 678',
    email: 'contact@techstartupa.com',
    sector: 'Technology',
    industry: 'Fintech',
    businessStage: 'Series A',
    employeeCount: '11-25',
    annualRevenue: '$500,000',
    fundingRequired: '$1,000,000',
    currentAssets: '$200,000',
    currentLiabilities: '$50,000',
    totalRevenue: '$500,000',
    netProfit: '$75,000',
    businessDescription: 'Innovative fintech solution for digital payments and financial inclusion in Cambodia.',
    valueProposition: 'Secure, fast, and affordable digital payment solutions for SMEs and individuals.',
    targetMarket: 'Small and medium enterprises, individual consumers, and financial institutions in Cambodia.',
    competitiveAdvantage: 'First-mover advantage in the Cambodian fintech market, strong local partnerships, and regulatory compliance.',
    status: 'Active',
    score: 88,
    location: 'Phnom Penh, Cambodia',
    documents: [
      { name: 'Business Plan', type: 'PDF', size: '2.3 MB', uploaded: '2024-01-15' },
      { name: 'Financial Statements', type: 'PDF', size: '1.8 MB', uploaded: '2024-01-10' },
      { name: 'Legal Documents', type: 'PDF', size: '3.1 MB', uploaded: '2024-01-05' }
    ],
    deals: [
      { id: 1, title: 'Series A Funding', amount: '$500K', status: 'Active', progress: 75 },
      { id: 2, title: 'Growth Capital', amount: '$750K', status: 'Pending', progress: 25 }
    ],
    metrics: {
      monthlyGrowth: '+15%',
      customerRetention: '92%',
      marketShare: '8%',
      employeeSatisfaction: '4.5/5'
    }
  }

  const [sme, setSme] = useState<any>(initialSme)

  useEffect(() => {
    const fetchSME = async () => {
      if (!params.id) return

      try {
        const response = await authorizedRequest(`/api/smes/${params.id}`)

        if (response.ok) {
          const data = await response.json()
          // Merge API data with mock data to preserve UI structure for missing fields
          setSme((prev: any) => ({
            ...prev,
            ...data,
            // Map API fields to UI fields if different
            businessStage: data.stage,
            businessDescription: data.description,
            fundingRequired: data.fundingRequired ? `$${data.fundingRequired.toLocaleString()}` : prev.fundingRequired,
            // Ensure lists exist
            documents: data.documents || prev.documents,
            deals: data.deals || prev.deals,
          }))
        }
      } catch (error) {
        console.error('Error fetching SME details:', error)
      }
    }

    fetchSME()
  }, [params.id])

  // Update handleEdit to populate form with current data
  useEffect(() => {
    if (showEditModal && sme) {
      setEditFormData({
        name: sme.name || '',
        sector: sme.sector || '',
        stage: sme.stage || 'SEED',
        fundingRequired: typeof sme.fundingRequired === 'number' ? sme.fundingRequired.toString() : sme.fundingRequired?.replace(/[^0-9.]/g, '') || '',
        description: sme.description || sme.businessDescription || '',
        website: sme.website || '',
        location: sme.location || '',
        currentAssets: sme.currentAssets || '',
        currentLiabilities: sme.currentLiabilities || '',
        totalRevenue: sme.totalRevenue || '',
        netProfit: sme.netProfit || '',
        customerRetention: sme.metrics?.customerRetention || '',
        marketShare: sme.metrics?.marketShare || '',
        employeeSatisfaction: sme.metrics?.employeeSatisfaction || ''
      })
    }
  }, [showEditModal, sme])

  const handleSaveSme = async () => {
    try {
      // Sanitize inputs
      let sanitizedWebsite = editFormData.website.trim()
      if (sanitizedWebsite && !/^https?:\/\//i.test(sanitizedWebsite)) {
        sanitizedWebsite = `https://${sanitizedWebsite}`
      }

      const payload = {
        name: editFormData.name.trim(),
        sector: editFormData.sector.trim(),
        stage: editFormData.stage,
        description: editFormData.description.trim() || undefined,
        website: sanitizedWebsite || null,
        location: editFormData.location.trim(),
        fundingRequired: editFormData.fundingRequired ? parseFloat(editFormData.fundingRequired.replace(/,/g, '')) : undefined,
        currentAssets: editFormData.currentAssets,
        currentLiabilities: editFormData.currentLiabilities,
        totalRevenue: editFormData.totalRevenue,
        netProfit: editFormData.netProfit,
        metrics: {
          customerRetention: editFormData.customerRetention,
          marketShare: editFormData.marketShare,
          employeeSatisfaction: editFormData.employeeSatisfaction
        }
      }

      const response = await authorizedRequest(`/api/smes/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (response.ok) {
        setSme((prev: any) => ({
          ...prev,
          ...data,
          businessStage: data.stage,
          businessDescription: data.description,
          fundingRequired: data.fundingRequired ? `$${data.fundingRequired.toLocaleString()}` : prev.fundingRequired
        }))
        setShowEditModal(false)
        alert('✨ Success! Your company profile has been updated.')
      } else {
        // Handle Validation Errors Friendly
        if (data.details && Array.isArray(data.details)) {
          const messages = data.details.map((err: any) => `• ${err.field}: ${err.message}`).join('\n')
          alert(`Please check the following fields:\n${messages}`)
        } else {
          console.error('Update failed:', data)
          alert(data.error || 'Msg: We couldn\'t update your profile at this time. Please try again.')
        }
      }
    } catch (error) {
      console.error('Error updating SME:', error)
      alert('Connection Error: We experienced a hiccup connecting to the server. Please check your internet connection or try again later.')
    }
  }

  const handleCertifySME = async () => {
    try {
      const response = await authorizedRequest(`/api/smes/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'CERTIFIED' })
      })

      if (response.ok) {
        addToast('success', 'SME certified successfully!', 10000)
        setTimeout(() => window.location.reload(), 1000)
      } else {
        addToast('error', 'Failed to certify SME')
      }
    } catch (error) {
      console.error('Error certifying SME:', error)
      addToast('error', 'Error certifying SME')
    } finally {
      setShowCertifyDialog(false)
    }
  }

  const handleExpressInterest = async () => {
    try {
      const recipientId = sme.userId || (sme.user && sme.user.id)
      if (!recipientId) {
        addToast('error', t('advisory.cannotMessageUser'))
        setShowInterestDialog(false)
        return
      }

      const response = await authorizedRequest('/api/messages/start', {
        method: 'POST',
        body: JSON.stringify({
          recipientId: recipientId,
          initialMessage: `Hi ${sme.name}, I'm interested in learning more about your business.`,
          dealId: null
        })
      })

      if (response.ok) {
        addToast('success', '✅ Message sent! You can continue the conversation in the dashboard.', 10000)
      } else {
        const errorData = await response.json()
        addToast('error', errorData.error || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error expressing interest:', error)
      addToast('error', 'Connection error while sending message')
    } finally {
      setShowInterestDialog(false)
    }
  }


  const tabs = [
    { id: 'overview', name: t('common.overview'), icon: Eye },
    { id: 'financials', name: t('common.financials'), icon: DollarSign },
    { id: 'deals', name: t('navigation.deals'), icon: Handshake },
    { id: 'documents', name: t('common.documents'), icon: DocumentIcon },
    { id: 'analytics', name: t('home.features.analytics.title'), icon: TrendingUp }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">CamboBia Platform</h1>
            </div>

            <div className="flex items-center space-x-4">
              <button className="relative p-2 text-gray-400 hover:text-white">
                <Bell className="w-6 h-6" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400"></span>
              </button>

              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-white">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">
                    {user?.role?.toLowerCase()}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-white"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 min-h-screen">
          <nav className="mt-8">
            <div className="px-4 space-y-2">
              <Link
                href="/dashboard"
                className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <BarChart3 className="w-5 h-5 mr-3" />
                Dashboard
              </Link>

              <Link
                href="/smes"
                className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg"
              >
                <Building2 className="w-5 h-5 mr-3" />
                SMEs
              </Link>

              <Link
                href="/investors"
                className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <Users className="w-5 h-5 mr-3" />
                Investors
              </Link>

              <Link
                href="/deals"
                className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <Handshake className="w-5 h-5 mr-3" />
                Deals
              </Link>

              <Link
                href="/advisory"
                className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <Award className="w-5 h-5 mr-3" />
                Advisory Services
              </Link>

              <Link
                href="/reports"
                className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <FileText className="w-5 h-5 mr-3" />
                Reports
              </Link>

              <Link
                href="/matchmaking"
                className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <Sparkles className="w-5 h-5 mr-3" />
                Matchmaking
              </Link>

              <Link
                href="/settings"
                className="flex items-center px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <Settings className="w-5 h-5 mr-3" />
                Settings
              </Link>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="mb-8">
            <div className="flex items-center space-x-4 mb-4">
              <Link
                href="/smes"
                className="flex items-center text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('common.back')}
              </Link>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-white">{sme.name}</h1>
                <p className="text-gray-400 mt-2">{sme.sector} • {sme.businessStage} • {sme.location}</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleEdit}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </button>
                <button
                  onClick={handleCreateDeal}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
                >
                  <Handshake className="w-4 h-4 mr-2" />
                  {t('advisory.createDeal')}
                </button>
                {/* Certify button for advisors */}
                {(user?.role === 'ADMIN' || user?.role === 'ADVISOR') && sme.status !== 'CERTIFIED' && (
                  <button
                    onClick={() => setShowCertifyDialog(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center"
                  >
                    <Award className="w-4 h-4 mr-2" />
                    {t('advisory.certifySME')}
                  </button>
                )}
                {/* Express Interest button for investors */}
                {(user?.role === 'INVESTOR' || user?.role === 'ADMIN' || user?.role === 'ADVISOR') && (
                  <button
                    onClick={() => setShowInterestDialog(true)}
                    className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg flex items-center"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    {t('advisory.expressInterest')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="mb-8">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${sme.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
              {sme.status}
            </span>
          </div>

          {/* Tabs */}
          <div className="bg-gray-800 rounded-lg mb-8">
            <div className="border-b border-gray-700">
              <nav className="flex space-x-8 px-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                      }`}
                  >
                    <tab.icon className="w-5 h-5 mr-2" />
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Advisory Scorecard - NEW FEATURE */}
                  <div className="bg-gradient-to-r from-gray-800 to-gray-850 rounded-xl overflow-hidden border border-gray-700 shadow-xl">
                    <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Award className="w-6 h-6 text-yellow-500" />
                        <h3 className="text-xl font-bold text-white">{t('advisory.scorecard')}</h3>
                      </div>
                      <div className="flex items-center gap-4">
                        {(user?.role === 'ADMIN' || user?.role === 'ADVISOR') && (
                          <Link
                            href={`/smes/${params.id}/assessment`}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                          >
                            {t('advisory.manageAssessment')}
                          </Link>
                        )}
                        <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
                          {sme.status === 'CERTIFIED' ? t('advisory.certified') : t('advisory.pending')}
                        </div>
                      </div>
                    </div>
                    <div className="p-8 grid grid-cols-2 md:grid-cols-6 gap-6">
                      {[
                        { label: t('common.financials'), score: sme.score ? Math.round(sme.score * 0.9) : 85, color: 'blue' },
                        { label: 'Team', score: sme.score ? Math.round(sme.score * 1.05) : 92, color: 'purple' },
                        { label: t('home.features.investor.title'), score: sme.score ? Math.round(sme.score * 0.8) : 78, color: 'green' },
                        { label: 'Product', score: sme.score ? Math.round(sme.score * 0.95) : 90, color: 'yellow' },
                        { label: 'Legal', score: sme.score ? Math.round(sme.score * 0.7) : 95, color: 'red' },
                        { label: 'Overall', score: Math.round(sme.score || 88), color: 'blue' }
                      ].map((stat, idx) => (
                        <div key={idx} className="text-center space-y-2">
                          <div className="relative w-16 h-16 mx-auto">
                            <svg className="w-16 h-16 transform -rotate-90">
                              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-700" />
                              <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent"
                                className={`text-${stat.color}-500`}
                                strokeDasharray={175.9}
                                strokeDashoffset={175.9 - (175.9 * Math.min(stat.score, 100)) / 100}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                              {Math.min(stat.score, 100)}
                            </div>
                          </div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">{t('smeProfile.basicInfo')}</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">{t('smeProfile.registrationNumber')}:</span>
                          <span className="text-white">{sme.registrationNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">{t('smeProfile.taxId')}:</span>
                          <span className="text-white">{sme.taxId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">{t('smeProfile.founded')}:</span>
                          <span className="text-white">{sme.foundedDate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">{t('smeProfile.employees')}:</span>
                          <span className="text-white">{sme.employeeCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">{t('smeProfile.annualRevenue')}:</span>
                          <span className="text-white">{sme.annualRevenue}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">{t('smeProfile.fundingRequired')}:</span>
                          <span className="text-white font-semibold text-blue-400">{sme.fundingRequired}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">{t('smeProfile.contactInfo')}</h3>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 text-gray-400 mr-3" />
                          <span className="text-white">{sme.address}, {sme.city}, {sme.province}</span>
                        </div>
                        <div className="flex items-center">
                          <Phone className="w-4 h-4 text-gray-400 mr-3" />
                          <span className="text-white">{sme.phone}</span>
                        </div>
                        <div className="flex items-center">
                          <Mail className="w-4 h-4 text-gray-400 mr-3" />
                          <span className="text-white">{sme.email}</span>
                        </div>
                        <div className="flex items-center">
                          <Globe className="w-4 h-4 text-gray-400 mr-3" />
                          <a href={sme.website} className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">
                            {sme.website}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Business Description */}
                  <div className="bg-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">{t('smeProfile.businessDescription')}</h3>
                    <p className="text-gray-300 mb-4">{sme.businessDescription}</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">{t('smeProfile.valueProposition')}</h4>
                        <p className="text-gray-300 text-sm">{sme.valueProposition}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">{t('smeProfile.targetMarket')}</h4>
                        <p className="text-gray-300 text-sm">{sme.targetMarket}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">{t('smeProfile.competitiveAdvantage')}</h4>
                        <p className="text-gray-300 text-sm">{sme.competitiveAdvantage}</p>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="bg-gray-700 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Key Metrics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">{sme.metrics.monthlyGrowth}</div>
                        <div className="text-sm text-gray-400">Monthly Growth</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">{sme.metrics.customerRetention}</div>
                        <div className="text-sm text-gray-400">Customer Retention</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-400">{sme.metrics.marketShare}</div>
                        <div className="text-sm text-gray-400">Market Share</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-400">{sme.metrics.employeeSatisfaction}</div>
                        <div className="text-sm text-gray-400">Employee Satisfaction</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'financials' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Financial Overview</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Current Assets:</span>
                          <span className="text-white">{sme.currentAssets}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Current Liabilities:</span>
                          <span className="text-white">{sme.currentLiabilities}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Total Revenue:</span>
                          <span className="text-white">{sme.totalRevenue}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Net Profit:</span>
                          <span className="text-green-400">{sme.netProfit}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Financial Ratios</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Current Ratio:</span>
                          <span className="text-white">4.0</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Debt-to-Equity:</span>
                          <span className="text-white">0.25</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Profit Margin:</span>
                          <span className="text-green-400">15%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">ROI:</span>
                          <span className="text-blue-400">22%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'deals' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">Active Deals</h3>
                    {sme.deals.length === 0 && (
                      <button
                        onClick={handleCreateDeal}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                      >
                        {t('advisory.createDeal')}
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    {sme.deals.map((deal: any) => (
                      <div key={deal.id} className="bg-gray-700 rounded-lg p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-lg font-semibold text-white">{deal.title}</h4>
                            <p className="text-gray-400">Amount: {deal.amount}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${deal.status === 'Active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                            {deal.status}
                          </span>
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-400">Progress</span>
                            <span className="text-white">{deal.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-600 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${deal.progress}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => router.push(`/deals/${deal.id}`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => router.push(`/deals/${deal.id}?edit=true`)}
                            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">Documents</h3>
                    <button
                      onClick={handleUploadDocument}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                    >
                      Upload Document
                    </button>
                  </div>

                  <div className="space-y-4">
                    {sme.documents.map((doc: any, index: number) => (
                      <div key={index} className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <DocumentIcon className="w-8 h-8 text-blue-400" />
                          <div>
                            <h4 className="text-white font-medium">{doc.name}</h4>
                            <p className="text-gray-400 text-sm">{doc.type} • {doc.size} • Uploaded {doc.uploaded}</p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewDocument(doc.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadDocument(doc.id)}
                            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-lg text-sm"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Revenue Growth</span>
                          <span className="text-green-400">+25%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Customer Acquisition</span>
                          <span className="text-blue-400">+18%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Market Expansion</span>
                          <span className="text-purple-400">+12%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Operational Efficiency</span>
                          <span className="text-yellow-400">+8%</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-700 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Risk Assessment</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Market Risk</span>
                          <span className="text-yellow-400">Medium</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Financial Risk</span>
                          <span className="text-green-400">Low</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Operational Risk</span>
                          <span className="text-yellow-400">Medium</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Regulatory Risk</span>
                          <span className="text-red-400">High</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl border border-gray-700 my-8">
            <h3 className="text-xl font-bold text-white mb-6">Edit SME Profile</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Company Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sector</label>
                <input
                  type="text"
                  value={editFormData.sector}
                  onChange={(e) => setEditFormData({ ...editFormData, sector: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Business Stage</label>
                <select
                  value={editFormData.stage}
                  onChange={(e) => setEditFormData({ ...editFormData, stage: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SEED">Seed</option>
                  <option value="GROWTH">Growth</option>
                  <option value="EXPANSION">Expansion</option>
                  <option value="MATURE">Mature</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Funding Required ($)</label>
                <input
                  type="number"
                  value={editFormData.fundingRequired}
                  onChange={(e) => setEditFormData({ ...editFormData, fundingRequired: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
                <input
                  type="text"
                  value={editFormData.location}
                  onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Website</label>
                <input
                  type="url"
                  value={editFormData.website}
                  onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Business Description</label>
              <textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Advisor Sections: Financials & Analytics */}
            {(user?.role === 'ADMIN' || user?.role === 'ADVISOR') && (
              <div className="mt-8 pt-8 border-t border-gray-700">
                <h4 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Advisor Insights (Financials & Analytics)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Current Assets</label>
                    <input
                      type="text"
                      value={editFormData.currentAssets}
                      placeholder="$200,000"
                      onChange={(e) => setEditFormData({ ...editFormData, currentAssets: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Current Liabilities</label>
                    <input
                      type="text"
                      value={editFormData.currentLiabilities}
                      placeholder="$50,000"
                      onChange={(e) => setEditFormData({ ...editFormData, currentLiabilities: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Total Revenue</label>
                    <input
                      type="text"
                      value={editFormData.totalRevenue}
                      placeholder="$500,000"
                      onChange={(e) => setEditFormData({ ...editFormData, totalRevenue: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Net Profit</label>
                    <input
                      type="text"
                      value={editFormData.netProfit}
                      placeholder="$75,000"
                      onChange={(e) => setEditFormData({ ...editFormData, netProfit: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Customer Retention (%)</label>
                    <input
                      type="text"
                      value={editFormData.customerRetention}
                      placeholder="85%"
                      onChange={(e) => setEditFormData({ ...editFormData, customerRetention: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Market Share (%)</label>
                    <input
                      type="text"
                      value={editFormData.marketShare}
                      placeholder="12%"
                      onChange={(e) => setEditFormData({ ...editFormData, marketShare: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSme}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Delete SME</h3>
            <p className="text-gray-400 mb-4">Are you sure you want to delete this SME? This action cannot be undone.</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await authorizedRequest(`/api/smes/${params.id}`, {
                      method: 'DELETE'
                    })

                    if (response.ok) {
                      console.log('SME deleted successfully!')
                      setShowDeleteModal(false)
                      router.push('/smes')
                    } else {
                      console.error('Failed to delete SME')
                    }
                  } catch (error) {
                    console.error('Error deleting SME:', error)
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-6">Upload Document</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Document Type</label>
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PITCH_DECK">Pitch Deck</option>
                  <option value="FINANCIAL_STATEMENT">Financial Statement</option>
                  <option value="BUSINESS_PLAN">Business Plan</option>
                  <option value="LEGAL_DOCUMENT">Legal Document</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">File</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700 hover:bg-gray-600 hover:border-gray-500">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-4 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PDF, DOCX, XLSX (MAX. 10MB)</p>
                    </div>
                    <input type="file" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
                {uploadFile && (
                  <p className="mt-2 text-sm text-green-400">
                    Selected: {uploadFile.name}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={performUpload}
                disabled={!uploadFile}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certify SME Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showCertifyDialog}
        title="Certify SME"
        message={`Are you sure you want to certify ${sme.name}? This action will update the SME status to CERTIFIED.`}
        confirmText="Yes, Certify"
        cancelText="Cancel"
        type="success"
        onConfirm={handleCertifySME}
        onCancel={() => setShowCertifyDialog(false)}
      />

      {/* Express Interest Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showInterestDialog}
        title="Express Interest"
        message={`Send a message to ${sme.name} expressing your interest in their business?`}
        confirmText="Yes, Send Message"
        cancelText="Cancel"
        type="info"
        onConfirm={handleExpressInterest}
        onCancel={() => setShowInterestDialog(false)}
      />
    </div>
  )
}
