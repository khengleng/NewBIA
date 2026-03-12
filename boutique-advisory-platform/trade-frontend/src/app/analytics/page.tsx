'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    BarChart3,
    TrendingUp,
    DollarSign,
    Users,
    Building2,
    Handshake,
    Target,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    Eye,
    MessageSquare,
    FileText,
    Upload,
    Clock,
    Sparkles
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { authorizedRequest } from '@/lib/api'

interface KPIs {
    totalDeals: number
    activeDeals: number
    totalInvestment: number
    avgDealSize: number
    successRate: number
    activeSMEs: number
    activeInvestors: number
    pendingMatches: number
}

interface MonthlyData {
    month: string
    deals: number
    value: number
}

interface RecentActivity {
    type: string
    description: string
    timestamp: string
}

export default function AnalyticsPage() {
    const { addToast } = useToast()
    const [kpis, setKpis] = useState<KPIs | null>(null)
    const [monthlyDeals, setMonthlyDeals] = useState<MonthlyData[]>([])
    const [sectorDistribution, setSectorDistribution] = useState<{ [key: string]: number }>({})
    const [stageDistribution, setStageDistribution] = useState<{ [key: string]: number }>({})
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const userData = localStorage.getItem('user')

                if (!userData) {
                    window.location.href = '/auth/login'
                    return
                }

                const response = await authorizedRequest('/api/dashboard/analytics')

                if (response.ok) {
                    const data = await response.json()
                    setKpis(data.kpis || null)
                    setMonthlyDeals(data.monthlyDeals || [])
                    setSectorDistribution(data.sectorDistribution || {})
                    setStageDistribution(data.stageDistribution || {})
                    setRecentActivity(data.recentActivity || [])
                }
            } catch (error) {
                console.error('Error fetching analytics:', error)
                addToast('error', 'Failed to load analytics')
            } finally {
                setIsLoading(false)
            }
        }

        fetchAnalytics()
    }, [addToast])

    const formatCurrency = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
        return `$${value}`
    }

    const getMaxValue = () => Math.max(...monthlyDeals.map(d => d.value))

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'DEAL_CREATED': return <Handshake className="w-4 h-4 text-purple-400" />
            case 'INTEREST_EXPRESSED': return <Sparkles className="w-4 h-4 text-pink-400" />
            case 'STAGE_CHANGED': return <TrendingUp className="w-4 h-4 text-blue-400" />
            case 'DOCUMENT_UPLOADED': return <Upload className="w-4 h-4 text-green-400" />
            case 'MESSAGE_SENT': return <MessageSquare className="w-4 h-4 text-yellow-400" />
            default: return <Activity className="w-4 h-4 text-gray-400" />
        }
    }

    const sectorColors = [
        'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
        'bg-yellow-500', 'bg-red-500', 'bg-indigo-500', 'bg-cyan-500'
    ]

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
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-blue-400" />
                        Analytics Dashboard
                    </h1>
                    <p className="text-gray-400 mt-1">Platform performance metrics and insights</p>
                </div>
                <div className="text-sm text-gray-400">
                    Last updated: {new Date().toLocaleString()}
                </div>
            </div>

            {/* KPI Cards */}
            {kpis && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-xl p-6 border border-blue-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-300 text-sm">Total Deals</p>
                                <p className="text-3xl font-bold text-white">{kpis.totalDeals}</p>
                                <div className="flex items-center gap-1 mt-1 text-green-400 text-sm">
                                    <ArrowUpRight className="w-4 h-4" />
                                    <span>+12% vs last month</span>
                                </div>
                            </div>
                            <div className="p-3 bg-blue-500/20 rounded-lg">
                                <Handshake className="w-6 h-6 text-blue-400" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 rounded-xl p-6 border border-green-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-300 text-sm">Total Investment</p>
                                <p className="text-3xl font-bold text-white">{formatCurrency(kpis.totalInvestment)}</p>
                                <div className="flex items-center gap-1 mt-1 text-green-400 text-sm">
                                    <ArrowUpRight className="w-4 h-4" />
                                    <span>+18% vs last month</span>
                                </div>
                            </div>
                            <div className="p-3 bg-green-500/20 rounded-lg">
                                <DollarSign className="w-6 h-6 text-green-400" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-xl p-6 border border-purple-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-300 text-sm">Success Rate</p>
                                <p className="text-3xl font-bold text-white">{kpis.successRate}%</p>
                                <div className="flex items-center gap-1 mt-1 text-green-400 text-sm">
                                    <ArrowUpRight className="w-4 h-4" />
                                    <span>+5% vs last month</span>
                                </div>
                            </div>
                            <div className="p-3 bg-purple-500/20 rounded-lg">
                                <Target className="w-6 h-6 text-purple-400" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-pink-600/20 to-pink-800/20 rounded-xl p-6 border border-pink-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-pink-300 text-sm">Pending Matches</p>
                                <p className="text-3xl font-bold text-white">{kpis.pendingMatches}</p>
                                <Link href="/matchmaking" className="flex items-center gap-1 mt-1 text-blue-400 text-sm hover:text-blue-300">
                                    <Eye className="w-4 h-4" />
                                    <span>View matches</span>
                                </Link>
                            </div>
                            <div className="p-3 bg-pink-500/20 rounded-lg">
                                <Sparkles className="w-6 h-6 text-pink-400" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Monthly Deals Chart */}
                <div className="lg:col-span-2 bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-6">Monthly Deal Activity</h3>
                    <div className="h-64 flex items-end gap-4">
                        {monthlyDeals.map((data, index) => (
                            <div key={index} className="flex-1 flex flex-col items-center gap-2">
                                <div className="w-full flex flex-col items-center gap-1">
                                    <span className="text-xs text-gray-400">{formatCurrency(data.value)}</span>
                                    <div
                                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all hover:from-blue-500 hover:to-blue-300"
                                        style={{
                                            height: `${(data.value / getMaxValue()) * 180}px`,
                                            minHeight: '20px'
                                        }}
                                    />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium text-white">{data.deals}</p>
                                    <p className="text-xs text-gray-400">{data.month}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sector Distribution */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-6">SMEs by Sector</h3>
                    <div className="space-y-4">
                        {Object.entries(sectorDistribution).map(([sector, count], index) => {
                            const total = Object.values(sectorDistribution).reduce((a, b) => a + b, 0)
                            const percentage = Math.round((count / total) * 100)

                            return (
                                <div key={sector}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-300">{sector}</span>
                                        <span className="text-white font-medium">{count} ({percentage}%)</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${sectorColors[index % sectorColors.length]}`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Deal Stage Distribution */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-6">Deals by Stage</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(stageDistribution).map(([stage, count]) => (
                            <div
                                key={stage}
                                className="bg-gray-700/50 rounded-lg p-4 border border-gray-600"
                            >
                                <p className="text-gray-400 text-sm">{stage}</p>
                                <p className="text-2xl font-bold text-white mt-1">{count}</p>
                            </div>
                        ))}
                    </div>
                    <Link
                        href="/pipeline"
                        className="mt-4 inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                    >
                        View Pipeline <ArrowUpRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* Recent Activity */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-6">Recent Activity</h3>
                    <div className="space-y-4">
                        {recentActivity.map((activity, index) => (
                            <div key={index} className="flex items-start gap-3">
                                <div className="p-2 bg-gray-700 rounded-lg">
                                    {getActivityIcon(activity.type)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-white text-sm">{activity.description}</p>
                                    <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(activity.timestamp).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Stats Row */}
            {kpis && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                        <Building2 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-white">{kpis.activeSMEs}</p>
                        <p className="text-gray-400 text-sm">Active SMEs</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                        <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-white">{kpis.activeInvestors}</p>
                        <p className="text-gray-400 text-sm">Active Investors</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                        <TrendingUp className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-white">{kpis.activeDeals}</p>
                        <p className="text-gray-400 text-sm">Active Deals</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                        <DollarSign className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-white">{formatCurrency(kpis.avgDealSize)}</p>
                        <p className="text-gray-400 text-sm">Avg. Deal Size</p>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}
