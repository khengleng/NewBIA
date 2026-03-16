'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'
import {
  Building2,
  Users,
  Handshake,
  BarChart3,
  FileText,
  TrendingUp,
  DollarSign,
  Target,
  CheckCircle,
  AlertCircle,
  Clock,
  UserX,
  ArrowUpRight
} from 'lucide-react'
import { useTranslations } from '../../hooks/useTranslations'
import { authorizedRequest } from '../../lib/api'
import { TRADING_OPERATOR_HOME } from '@/lib/tradingOperatorRoutes'
import { hasPermission } from '@/lib/permissions'
import { normalizeRole } from '@/lib/roles'

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'SME' | 'INVESTOR' | 'ADVISOR' | 'ADMIN' | 'SUPER_ADMIN' | 'FINOPS' | 'CX' | 'AUDITOR' | 'COMPLIANCE' | 'SUPPORT'
  tenantId: string
}

export default function DashboardPage() {
  const { t } = useTranslations()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const meResponse = await authorizedRequest('/api/auth/me')
        if (!meResponse.ok) {
          router.replace('/auth/login')
          return
        }

        const meData = await meResponse.json()
        const apiUser = meData?.user
        if (!apiUser) {
          router.replace('/auth/login')
          return
        }

        const normalizedUser: User = {
          ...apiUser,
          role: normalizeRole(apiUser.role) as User['role'],
        }

        localStorage.setItem('user', JSON.stringify(normalizedUser))

        if (hasPermission(normalizedUser.role, 'admin.read')) {
          router.replace('/admin/dashboard')
          return
        }

        setUser(normalizedUser)

        const response = await authorizedRequest('/api/dashboard/stats')
        if (response.ok) {
          const data = await response.json()
          setStats(data.stats)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [router])

  const getDashboardContent = () => {
    if (!user) return null

    switch (user.role) {
      case 'SME':
        return <SMEDashboard user={user} t={t} stats={stats} />
      case 'INVESTOR':
        return <InvestorDashboard t={t} stats={stats} />
      case 'ADVISOR':
        return <AdvisorDashboard t={t} stats={stats} />
      case 'ADMIN':
      case 'SUPER_ADMIN':
      case 'FINOPS':
      case 'CX':
      case 'AUDITOR':
      case 'COMPLIANCE':
      case 'SUPPORT':
        return <AdminDashboard t={t} stats={stats} />
      default:
        return <div>Unknown role</div>
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      {getDashboardContent()}
    </DashboardLayout>
  )
}

// SME Dashboard Component
function SMEDashboard({ user, t, stats }: { user: User; t: any; stats: any }) {
  const dashboardStats = [
    { label: t('navigation.profile'), value: stats?.profileCompleteness ? `${stats.profileCompleteness}%` : '75%', icon: Target, color: 'text-blue-500' },
    { label: t('advisory.fundingRequired'), value: stats?.fundingGoal ? `$${(stats.fundingGoal / 1000).toFixed(0)}K` : '$0K', icon: DollarSign, color: 'text-green-500' },
    { label: t('advisory.certified'), value: stats?.smeStatus || (stats?.activeBookings > 0 ? 'IN_REVIEW' : 'PENDING'), icon: CheckCircle, color: 'text-yellow-500' },
    { label: t('navigation.deals'), value: stats?.totalDeals || '0', icon: TrendingUp, color: 'text-purple-500' },
    { label: 'Active Disputes', value: stats?.activeDisputes || '0', icon: AlertCircle, color: 'text-red-500' }
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">{t('dashboard.welcome')}, {user.firstName}!</h1>

      <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
        <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-400 mb-2">SME Owner Workspace</p>
            <h2 className="text-2xl font-semibold text-white">{stats?.smeName || `${user.firstName} ${user.lastName}`}</h2>
            <p className="text-gray-400 mt-2">
              {stats?.sector || 'Sector pending'}{stats?.stage ? ` · ${stats.stage}` : ''} · Status: {stats?.smeStatus || 'PENDING'}
            </p>
          </div>
          <div className="text-sm text-gray-300 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
            This dashboard is your SME owner control center for onboarding, documents, deal preparation, and investor readiness.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {dashboardStats.map((stat: any, index: number) => (
          <div key={index} className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg bg-gray-700 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">{t('dashboard.recentActivity')}</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div>
                <p className="text-white">Profile updated</p>
                <p className="text-sm text-gray-400">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-white">Document uploaded</p>
                <p className="text-sm text-gray-400">1 day ago</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">{t('dashboard.nextSteps')}</h2>
          <div className="space-y-4">
            <Link href="/kyc" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 transition-colors group">
              <Clock className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-white group-hover:text-blue-400">Complete KYC verification</p>
                <p className="text-sm text-gray-400">Due in 3 days</p>
              </div>
            </Link>
            <Link href="/documents" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 transition-colors group">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-white group-hover:text-blue-400">Upload financial statements</p>
                <p className="text-sm text-gray-400">Required for certification</p>
              </div>
            </Link>
            {stats?.activeDisputes > 0 && (
              <Link href="/payments" className="flex items-center space-x-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors group">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-white font-bold">Unresolved Disputes Found</p>
                  <p className="text-sm text-red-400/80">Check payment history for details</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Investor Dashboard Component
function InvestorDashboard({ t, stats }: { t: any; stats: any }) {
  const dashboardStats = [
    { label: t('dashboard.portfolioValue') || 'Portfolio Value', value: stats?.portfolioValue ? `$${(stats.portfolioValue / 1000).toFixed(0)}K` : '$0', icon: DollarSign, color: 'text-green-500', link: '/investor/portfolio' },
    { label: t('dashboard.activeInvestments') || 'Active Investments', value: stats?.activeInvestments || '0', icon: TrendingUp, color: 'text-blue-500', link: '/investor/portfolio' },
    { label: 'Match Score', value: stats?.avgMatchScore ? `${stats.avgMatchScore}%` : '0%', icon: BarChart3, color: 'text-purple-500', link: '/matchmaking' },
    { label: 'Pending Offers', value: stats?.pendingOffers || '0', icon: Clock, color: 'text-yellow-500', link: '/deals' }
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">{t('dashboard.investorTitle')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {dashboardStats.map((stat: any, index: number) => (
          <Link href={stat.link} key={index} className="block group">
            <div className="bg-gray-800 rounded-lg p-6 group-hover:bg-gray-700 transition-colors cursor-pointer border border-transparent group-hover:border-gray-600">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg bg-gray-700 ${stat.color} group-hover:bg-gray-600`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-400 group-hover:text-gray-300 transition-colors">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">My Portfolio Performance</h2>
          <div className="space-y-4">
            {stats?.recentInvestments && stats.recentInvestments.length > 0 ? (
              stats.recentInvestments.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between border-b border-gray-700/50 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-white font-medium">{inv.name}</p>
                    <p className="text-sm text-gray-400">
                      ${(inv.amount || 0).toLocaleString()} {inv.type === 'SYNDICATE' ? 'syndicate' : ''} invested
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-green-400 text-xs font-bold mb-1">
                      <TrendingUp className="w-3 h-3" />
                      +{inv.performance || 0}%
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">No active investments</p>
              </div>
            )}
            <Link href="/investor/portfolio" className="block text-center text-blue-400 text-sm hover:underline mt-4">
              View Full Portfolio
            </Link>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Market Opportunities</h2>
          <div className="space-y-4">
            {stats?.marketOpportunities && stats.marketOpportunities.length > 0 ? (
              stats.marketOpportunities.map((opportunity: any) => (
                <Link key={opportunity.id} href={`/deals/${opportunity.id}`} className="block border-l-4 border-blue-500 pl-4 py-2 hover:bg-gray-700 transition-colors group">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-medium group-hover:text-blue-400 transition-colors">{opportunity.name}</p>
                      <p className="text-sm text-gray-400">
                        {opportunity.sector || 'General'} • Seeking ${(opportunity.amount || 0).toLocaleString()}
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">No new opportunities</p>
              </div>
            )}
            <Link href="/deals" className="block text-center text-blue-400 text-sm hover:underline mt-4">
              Explore All Deals
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// Advisor Dashboard Component
function AdvisorDashboard({ t, stats }: { t: any; stats: any }) {
  const dashboardStats = [
    { label: 'Active Projects', value: stats?.clients || '0', icon: FileText, color: 'text-blue-500' },
    { label: 'Total Earnings', value: stats?.earnings ? `$${stats.earnings}` : '$0', icon: DollarSign, color: 'text-green-500' },
    { label: 'Pending Reviews', value: stats?.pendingCertifications || '0', icon: Clock, color: 'text-yellow-500' },
    { label: 'Rating', value: stats?.rating ? `${stats.rating}/5` : 'N/A', icon: TrendingUp, color: 'text-purple-500' }
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">{t('dashboard.advisorTitle')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {dashboardStats.map((stat: any, index: number) => (
          <div key={index} className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg bg-gray-700 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">{t('dashboard.recentActivity')}</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">E-commerce Platform</p>
                <p className="text-sm text-gray-400">Certified 2 days ago</p>
              </div>
              <span className="text-green-500 text-sm">Score: 8.5/10</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">AI Startup</p>
                <p className="text-sm text-gray-400">Certified 1 week ago</p>
              </div>
              <span className="text-green-500 text-sm">Score: 9.2/10</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">{t('dashboard.pendingReviews')}</h2>
          <div className="space-y-4">
            <Link href="/advisory/certifications" className="block border-l-4 border-yellow-500 pl-4 py-2 hover:bg-gray-700 transition-colors">
              <p className="text-white font-medium">Manufacturing SME</p>
              <p className="text-sm text-gray-400">Documents pending review</p>
            </Link>
            <Link href="/advisory/certifications" className="block border-l-4 border-red-500 pl-4 py-2 hover:bg-gray-700 transition-colors">
              <p className="text-white font-medium">FinTech Startup</p>
              <p className="text-sm text-gray-400">KYC verification required</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// Admin Dashboard Component
function AdminDashboard({ t, stats }: { t: any; stats: any }) {
  const adminStats = {
    users: stats?.users ?? stats?.totalUsers ?? 0,
    smes: stats?.smes ?? stats?.totalSMEs ?? 0,
    deals: stats?.deals ?? stats?.activeDeals ?? 0,
    activeDisputes: stats?.activeDisputes ?? 0,
    revenue: stats?.totalVolume ?? stats?.platformRevenue ?? stats?.totalFees ?? 0,
    deletedUsers: stats?.deletedUsers ?? 0
  }

  const dashboardStats = [
    { label: 'Total Users', value: adminStats.users, icon: Users, color: 'text-blue-500' },
    { label: 'SMEs', value: adminStats.smes, icon: Building2, color: 'text-green-500' },
    { label: 'Active Deals', value: adminStats.deals, icon: Handshake, color: 'text-purple-500' },
    { label: 'Active Disputes', value: adminStats.activeDisputes, icon: AlertCircle, color: 'text-red-500' },
    { label: 'Revenue', value: `$${adminStats.revenue.toLocaleString()}`, icon: CheckCircle, color: 'text-green-500' },
    { label: 'Deleted Users', value: adminStats.deletedUsers, icon: UserX, color: 'text-red-500' }
  ]
  const systemOverview = [
    {
      key: 'api',
      title: 'API Service',
      subtitle: 'Core Gateway',
      status: stats?.systemOverview?.api || 'unknown'
    },
    {
      key: 'database',
      title: 'Database',
      subtitle: 'Primary Storage',
      status: stats?.systemOverview?.database || 'unknown'
    },
    {
      key: 'redis',
      title: 'Redis',
      subtitle: 'Cache / Rate Limit',
      status: stats?.systemOverview?.redis || 'unknown'
    }
  ]
  const recentActivity = stats?.recentActivity || []

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-8">{t('dashboard.adminTitle')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {dashboardStats.map((stat: any, index: number) => (
          <div key={index} className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg bg-gray-700 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">System Overview</h2>
          <div className="space-y-4">
            {systemOverview.map((item: any) => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{item.title}</p>
                  <p className="text-sm text-gray-400">{item.subtitle}</p>
                </div>
                <span className={`text-sm ${item.status === 'online' ? 'text-green-500' : 'text-yellow-500'}`}>
                  {item.status === 'online' ? 'Online' : 'Degraded'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">{t('dashboard.recentActivity')}</h2>
          <div className="space-y-4">
            {recentActivity.length > 0 ? recentActivity.map((item: any) => (
              <div key={item.id} className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="text-white">{item.title}</p>
                  <p className="text-sm text-gray-400">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-400">No recent activity found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
