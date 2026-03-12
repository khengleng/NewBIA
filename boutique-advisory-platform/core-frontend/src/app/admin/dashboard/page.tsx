'use client'

import { useState, useEffect } from 'react'
import {
    Users,
    Building2,
    Handshake,
    ShieldCheck,
    AlertTriangle,
    Activity,
    DollarSign,
    UserX,
    CheckCircle,
    Server,
    Database,
    Globe,
    HardDrive,
    Clock
} from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<any>(null)
    const [actionStats, setActionStats] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setIsLoading(true);
                const [generalRes, actionRes] = await Promise.all([
                    authorizedRequest('/api/dashboard/stats'),
                    authorizedRequest('/api/admin/action-center/stats')
                ]);

                if (generalRes.ok) {
                    const data = await generalRes.json();
                    setStats(data.stats || data)
                }

                if (actionRes.ok) {
                    const actionData = await actionRes.json();
                    setActionStats(actionData);
                }
            } catch (error) {
                console.error('Error fetching admin stats:', error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchStats()
    }, [])

    const normalizedStats = {
        users: stats?.users ?? stats?.totalUsers ?? 0,
        smes: stats?.smes ?? stats?.totalSMEs ?? 0,
        deals: stats?.deals ?? stats?.activeDeals ?? 0,
        revenue: stats?.platformRevenue ?? stats?.totalFees ?? stats?.totalVolume ?? 0,
        deletedUsers: stats?.deletedUsers ?? 0,
        activeDisputes: actionStats?.dealDisputes ?? stats?.activeDisputes ?? 0
    }
    const lastUpdatedAt = stats?.generatedAt
        ? new Date(stats.generatedAt).toLocaleTimeString()
        : new Date().toLocaleTimeString()
    const systemOverview = [
        {
            key: 'api',
            title: 'API Service',
            subtitle: 'Core Gateway',
            status: stats?.systemOverview?.api || 'unknown',
            icon: Globe
        },
        {
            key: 'database',
            title: 'Database',
            subtitle: 'Primary Storage',
            status: stats?.systemOverview?.database || 'unknown',
            icon: Database
        },
        {
            key: 'redis',
            title: 'Redis',
            subtitle: 'Cache / Rate Limit',
            status: stats?.systemOverview?.redis || 'unknown',
            icon: HardDrive
        }
    ]
    const recentActivity = stats?.recentActivity || []

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <ShieldCheck className="w-8 h-8 text-blue-400" />
                            Admin Dashboard
                        </h1>
                        <p className="text-gray-400 mt-2">System overview and platform management</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500">Last updated</p>
                        <p className="text-white font-medium">{lastUpdatedAt}</p>
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 border border-blue-700/50 rounded-xl p-5">
                        <div className="flex items-center gap-2 text-blue-400 text-xs mb-2">
                            <Users className="w-4 h-4" />
                            Total Users
                        </div>
                        <p className="text-3xl font-bold text-white">{normalizedStats.users}</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 border border-green-700/50 rounded-xl p-5">
                        <div className="flex items-center gap-2 text-green-400 text-xs mb-2">
                            <Building2 className="w-4 h-4" />
                            SMEs
                        </div>
                        <p className="text-3xl font-bold text-white">{normalizedStats.smes}</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-700/50 rounded-xl p-5">
                        <div className="flex items-center gap-2 text-purple-400 text-xs mb-2">
                            <Handshake className="w-4 h-4" />
                            Active Deals
                        </div>
                        <p className="text-3xl font-bold text-white">{normalizedStats.deals}</p>
                    </div>

                    <div className="bg-gradient-to-br from-red-900/40 to-red-800/20 border border-red-700/50 rounded-xl p-5">
                        <div className="flex items-center gap-2 text-red-400 text-xs mb-2">
                            <AlertTriangle className="w-4 h-4" />
                            Active Disputes
                        </div>
                        <p className="text-3xl font-bold text-white">{normalizedStats.activeDisputes}</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-800/20 border border-emerald-700/50 rounded-xl p-5">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs mb-2">
                            <DollarSign className="w-4 h-4" />
                            Platform Revenue
                        </div>
                        <p className="text-2xl font-bold text-white">${normalizedStats.revenue.toLocaleString()}</p>
                    </div>

                    <div className="bg-gradient-to-br from-gray-900/40 to-gray-800/20 border border-gray-700/50 rounded-xl p-5">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                            <UserX className="w-4 h-4" />
                            Deleted Users
                        </div>
                        <p className="text-3xl font-bold text-white">{normalizedStats.deletedUsers}</p>
                    </div>
                </div>

                {/* System Overview & Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* System Overview */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Server className="w-5 h-5 text-blue-400" />
                            System Overview
                        </h2>
                        <div className="space-y-4">
                            {systemOverview.map((item) => {
                                const Icon = item.icon
                                const isOnline = item.status === 'online'
                                return (
                                    <div key={item.key} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <div className={`${isOnline ? 'bg-green-500/20' : 'bg-yellow-500/20'} p-2 rounded-lg`}>
                                                <Icon className={`w-5 h-5 ${isOnline ? 'text-green-400' : 'text-yellow-400'}`} />
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{item.title}</p>
                                                <p className="text-xs text-gray-400">{item.subtitle}</p>
                                            </div>
                                        </div>
                                        <span className={`flex items-center gap-2 text-sm font-medium ${isOnline ? 'text-green-400' : 'text-yellow-400'}`}>
                                            <CheckCircle className="w-4 h-4" />
                                            {isOnline ? 'Online' : 'Degraded'}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-400" />
                            Recent Activity
                        </h2>
                        <div className="space-y-4">
                            {recentActivity.length > 0 ? recentActivity.map((activity: any) => (
                                <div key={activity.id} className="flex items-start gap-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                    <div className="bg-blue-500/20 p-2 rounded-lg mt-0.5">
                                        <Activity className="w-4 h-4 text-blue-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white font-medium text-sm">{activity.title}</p>
                                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(activity.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-gray-500 text-sm">No recent activity found.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Action Center */}
                <div className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border border-orange-700/50 rounded-xl p-6">
                    <h3 className="text-orange-400 font-bold flex items-center gap-2 mb-6 text-xl">
                        <AlertTriangle className="w-6 h-6" />
                        Action Center
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-900/50 p-5 rounded-xl border border-orange-500/20 flex justify-between items-center group hover:bg-gray-800 transition-all cursor-pointer">
                            <div>
                                <p className="text-white font-bold text-2xl">{actionStats?.kycRequests || 0}</p>
                                <p className="text-gray-400 text-sm mt-1">Pending KYC Requests</p>
                            </div>
                            <button
                                onClick={() => window.location.href = '/admin/kyc-requests'}
                                className="px-4 py-2 bg-orange-500/10 text-orange-400 rounded-lg border border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white transition-all font-medium"
                            >
                                Review
                            </button>
                        </div>

                        <div className="bg-gray-900/50 p-5 rounded-xl border border-red-500/20 flex justify-between items-center group hover:bg-gray-800 transition-all cursor-pointer">
                            <div>
                                <p className="text-white font-bold text-2xl">{actionStats?.dealDisputes || 0}</p>
                                <p className="text-gray-400 text-sm mt-1">Open Disputes</p>
                            </div>
                            <button
                                onClick={() => window.location.href = '/admin/disputes'}
                                className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20 group-hover:bg-red-500 group-hover:text-white transition-all font-medium"
                            >
                                Resolve
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
