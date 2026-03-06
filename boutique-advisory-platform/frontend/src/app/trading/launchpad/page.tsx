'use client'

import { useState, useEffect } from 'react'
import { authorizedRequest } from '@/lib/api'
import { useTranslations } from '@/hooks/useTranslations'
import { Rocket, Clock, TrendingUp, Users, Building2, ChevronRight, Activity, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import CreateLaunchpadModal from './components/CreateLaunchpadModal'

interface Offering {
    id: string
    dealId: string
    hardCap: number
    unitPrice: number
    minCommitment: number
    maxCommitment: number
    startTime: string
    endTime: string
    deal: {
        title: string
        description: string
        sme: {
            companyName: string
            industry: string
        }
    }
}

export default function LaunchpadPage() {
    const { t } = useTranslations()
    const router = useRouter()
    const [offerings, setOfferings] = useState<Offering[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    useEffect(() => {
        const userStr = localStorage.getItem('user')
        if (userStr) {
            try {
                const user = JSON.parse(userStr)
                if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
                    setIsAdmin(true)
                }
            } catch (e) { }
        }
        fetchOfferings()
    }, [])

    const fetchOfferings = async () => {
        try {
            const response = await authorizedRequest('/api/launchpad')
            const data = await response.json()
            if (response.ok && Array.isArray(data)) {
                setOfferings(data)
            } else {
                setOfferings([])
            }
        } catch (error) {
            console.error('Failed to fetch launchpad offerings:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const calculateStatus = (startTime: string, endTime: string) => {
        const now = new Date()
        const start = new Date(startTime)
        const end = new Date(endTime)

        if (now < start) return { label: 'Upcoming', color: 'bg-yellow-500/10 text-yellow-500' }
        if (now > end) return { label: 'Ended', color: 'bg-gray-500/10 text-gray-500' }
        return { label: 'Active', color: 'bg-green-500/10 text-green-500', active: true }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(value)
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 md:p-8">
            {/* Header */}
            <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                        <Rocket className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Launchpad</h1>
                        <p className="text-gray-400">Discover and invest in top-tier SME tokenized equity drops.</p>
                    </div>
                </div>

                {isAdmin && (
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg flex items-center justify-center font-semibold transition-colors shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Create Launchpad Drop
                    </button>
                )}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <Activity className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Total Funds Raised</p>
                            <p className="text-2xl font-bold tracking-tight">$12.4M</p>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                            <Building2 className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Projects Launched</p>
                            <p className="text-2xl font-bold tracking-tight">42 SMEs</p>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 p-6 rounded-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                            <Users className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Unique Participants</p>
                            <p className="text-2xl font-bold tracking-tight">8,204</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Offerings List */}
            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : offerings.length === 0 ? (
                <div className="text-center py-20 bg-gray-800/50 rounded-2xl border border-gray-700/50">
                    <Rocket className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-white mb-2">No Active Offerings</h3>
                    <p className="text-gray-400">There are currently no SMEs listed on the Launchpad.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {offerings.map((offering) => {
                        const status = calculateStatus(offering.startTime, offering.endTime)
                        return (
                            <div
                                key={offering.id}
                                className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden hover:border-gray-600 transition-colors group cursor-pointer"
                                onClick={() => router.push(`/trading/launchpad/${offering.id}`)}
                            >
                                {/* Banner Placeholder */}
                                <div className="h-32 w-full bg-gradient-to-r from-blue-900/50 to-purple-900/50 relative">
                                    <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md border border-white/10 ${status.color}`}>
                                        <div className="flex items-center space-x-1">
                                            {status.active && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                                            <span>{status.label}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-2xl font-bold mb-1 group-hover:text-blue-400 transition-colors">
                                                {offering.deal.sme.companyName}
                                            </h3>
                                            <p className="text-sm text-gray-400">{offering.deal.title}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                                            <p className="text-xs text-gray-400 mb-1">Target Raise</p>
                                            <p className="text-lg font-semibold">{formatCurrency(offering.hardCap)}</p>
                                        </div>
                                        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                                            <p className="text-xs text-gray-400 mb-1">Price per DU</p>
                                            <p className="text-lg font-semibold">${offering.unitPrice.toFixed(2)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-sm mt-6 pt-4 border-t border-gray-700/50">
                                        <div className="flex items-center space-x-2 text-gray-400">
                                            <Clock className="w-4 h-4" />
                                            <span>Ends {new Date(offering.endTime).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center text-blue-400 font-medium group-hover:translate-x-1 transition-transform">
                                            View Details <ChevronRight className="w-4 h-4 ml-1" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <CreateLaunchpadModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => fetchOfferings()}
            />
        </div>
    )
}
