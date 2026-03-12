'use client'

import { useState, useEffect, useMemo } from 'react'
import { authorizedRequest } from '@/lib/api'
import { useTranslations } from '@/hooks/useTranslations'
import {
    Rocket,
    Clock,
    Building2,
    ChevronRight,
    Plus,
    AlertCircle,
    Info,
    Loader2
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import CreateLaunchpadModal from './components/CreateLaunchpadModal'
import DashboardLayout from '@/components/layout/DashboardLayout'

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
    // const { t } = useTranslations() --- removed as unused
    const router = useRouter()
    const [offerings, setOfferings] = useState<Offering[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [activeFilter, setActiveFilter] = useState<'active' | 'upcoming' | 'ended'>('active')

    useEffect(() => {
        const userStr = localStorage.getItem('user')
        if (userStr) {
            try {
                const user = JSON.parse(userStr)
                if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
                    setIsAdmin(true)
                }
            } catch (_err) { }
        }
        fetchOfferings()
    }, [])

    const fetchOfferings = async () => {
        setIsLoading(true)
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

        if (now < start) return { label: 'Upcoming', color: 'bg-amber-500/20 text-amber-300' }
        if (now > end) return { label: 'Ended', color: 'bg-gray-500/20 text-gray-400' }
        return { label: 'Active', color: 'bg-emerald-500/20 text-emerald-300', active: true }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(value)
    }

    const metrics = useMemo(() => {
        const active = offerings.filter(o => {
            const s = calculateStatus(o.startTime, o.endTime)
            return s.label === 'Active'
        }).length

        const totalValue = offerings.reduce((acc, o) => acc + o.hardCap, 0)

        return {
            active,
            total: offerings.length,
            value: totalValue
        }
    }, [offerings])

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-8 pb-20">
                {/* Header Section - Inspired by TradingOperatorModulePage */}
                <section className="bg-gray-800 border border-gray-700 rounded-xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <Rocket className="w-32 h-32 text-blue-400" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <Rocket className="w-8 h-8 text-blue-400" />
                                {isAdmin ? 'Token Launchpad Governance' : 'Token Launchpad'}
                            </h1>
                            <p className="text-gray-400 mt-2 max-w-2xl">
                                {isAdmin
                                    ? 'Orchestrate primary market offerings, manage token distributions, and monitor capital raising performance across the ecosystem.'
                                    : 'Invest in high-growth SMEs through compliant, institutional-grade equity tokenization.'}
                            </p>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 flex items-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Initialize New Drop
                            </button>
                        )}
                    </div>
                </section>

                {/* Sub-Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Active Offerings</p>
                        <p className="text-2xl font-bold text-emerald-400">{metrics.active}</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Total Pool Value</p>
                        <p className="text-2xl font-bold text-white">{formatCurrency(metrics.value)}</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Participants</p>
                        <p className="text-2xl font-bold text-blue-400">8,204+</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Historical Success</p>
                        <p className="text-2xl font-bold text-purple-400">98.2%</p>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-700 pb-6">
                        <div>
                            <h2 className="text-xl font-bold text-white">Investment Queue</h2>
                            <p className="text-sm text-gray-500">Pipeline of primary market SME listings.</p>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex space-x-1 bg-gray-900/50 p-1.5 rounded-xl border border-gray-700 h-fit">
                            {(['active', 'upcoming', 'ended'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setActiveFilter(f)}
                                    className={`px-5 py-2 rounded-lg font-bold capitalize transition-all text-xs ${activeFilter === f
                                        ? 'bg-gray-800 text-white shadow-sm ring-1 ring-gray-700'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Offerings Content */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    ) : offerings.length === 0 ? (
                        <div className="text-center py-20 bg-gray-800/20 rounded-xl border border-gray-700 border-dashed">
                            <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-gray-500">No Projects Found</h3>
                            <p className="text-sm text-gray-600 mt-2 max-w-sm mx-auto">The launchpad queue is currently empty for this status.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {offerings
                                .filter(offering => calculateStatus(offering.startTime, offering.endTime).label.toLowerCase() === activeFilter)
                                .map((offering) => {
                                    const status = calculateStatus(offering.startTime, offering.endTime)
                                    return (
                                        <div
                                            key={offering.id}
                                            className="group bg-gray-800/40 border border-gray-700/50 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all duration-300 cursor-pointer flex flex-col hover:bg-gray-800"
                                            onClick={() => router.push(`/trading/launchpad/${offering.id}`)}
                                        >
                                            <div className="p-6 space-y-6">
                                                <div className="flex justify-between items-start">
                                                    <div className="w-12 h-12 bg-gray-900 border border-gray-700 rounded-xl flex items-center justify-center">
                                                        <Building2 className="w-6 h-6 text-blue-400" />
                                                    </div>
                                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${status.color}`}>
                                                        {status.label}
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <h3 className="text-lg font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                                                        {offering.deal?.sme?.companyName}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 font-medium truncate">{offering.deal?.title}</p>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 py-4 border-y border-gray-700/50">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Target Raise</p>
                                                        <p className="text-sm font-bold text-white">{formatCurrency(offering.hardCap)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Unit Price</p>
                                                        <p className="text-sm font-bold text-blue-400">${offering.unitPrice.toFixed(2)}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-[11px]">
                                                    <div className="flex items-center gap-2 text-gray-500">
                                                        <Clock className="w-3 h-3" />
                                                        <span>Ends {new Date(offering.endTime).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
                                                        MANAGE <ChevronRight className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>
                    )}
                </div>

                {/* Operational Note */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 flex items-start gap-4">
                    <div className="bg-blue-600/20 p-2 rounded-lg">
                        <Info className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-300 font-medium">Compliance Oversight</p>
                        <p className="text-xs text-gray-500 mt-1">
                            All primary market offerings are subject to the Listing Governance Protocol.
                            Manual intervention or suspension can be triggered from the Deal Oversights module.
                        </p>
                    </div>
                </div>

                <CreateLaunchpadModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => fetchOfferings()}
                />
            </div>
        </DashboardLayout>
    )
}
