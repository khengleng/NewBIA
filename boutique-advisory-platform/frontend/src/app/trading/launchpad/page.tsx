'use client'

import { useState, useEffect } from 'react'
import { authorizedRequest } from '@/lib/api'
import { useTranslations } from '@/hooks/useTranslations'
import { Rocket, Clock, TrendingUp, Users, Building2, ChevronRight, Activity, Plus } from 'lucide-react'
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
    const { t } = useTranslations()
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
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-12 pb-20">
                {/* Hero Section - Discovery Structure */}
                <div className="relative rounded-[2.5rem] overflow-hidden bg-gray-900 border border-gray-800 shadow-2xl">
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-20 mix-blend-overlay" />
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-purple-600/20" />

                    <div className="relative p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-10">
                        <div className="max-w-xl space-y-6 text-center md:text-left">
                            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm font-bold uppercase tracking-widest">
                                <Rocket className="w-4 h-4" />
                                <span>Tokenized SME Equity</span>
                            </div>
                            <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.1]">
                                Next Generation <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Capital Raising</span>
                            </h1>
                            <p className="text-xl text-gray-400 leading-relaxed">
                                Join the future of SME financing. Invest in high-growth companies through compliant, institutional-grade equity tokenization.
                            </p>
                            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                                {isAdmin && (
                                    <button
                                        onClick={() => setIsCreateModalOpen(true)}
                                        className="bg-white text-gray-900 px-8 py-4 rounded-2xl font-black hover:bg-gray-200 transition-all shadow-xl flex items-center"
                                    >
                                        <Plus className="w-5 h-5 mr-2" />
                                        Initialize Drop
                                    </button>
                                )}
                                <button className="bg-gray-800 text-white border border-gray-700 px-8 py-4 rounded-2xl font-black hover:bg-gray-700 transition"
                                    onClick={() => window.scrollTo({ top: 800, behavior: 'smooth' })}>
                                    Browse Offerings
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto">
                            <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 p-6 rounded-3xl">
                                <Activity className="w-8 h-8 text-blue-400 mb-3" />
                                <p className="text-sm text-gray-500 font-bold uppercase mb-1">Total Raised</p>
                                <p className="text-3xl font-black text-white leading-none">$12.4M</p>
                            </div>
                            <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 p-6 rounded-3xl">
                                <Building2 className="w-8 h-8 text-green-400 mb-3" />
                                <p className="text-sm text-gray-500 font-bold uppercase mb-1">Live Deals</p>
                                <p className="text-3xl font-black text-white leading-none">42</p>
                            </div>
                            <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 p-6 rounded-3xl">
                                <Users className="w-8 h-8 text-purple-400 mb-3" />
                                <p className="text-sm text-gray-500 font-bold uppercase mb-1">Participants</p>
                                <p className="text-3xl font-black text-white leading-none">8,204</p>
                            </div>
                            <div className="bg-gray-800/40 backdrop-blur-md border border-gray-700/50 p-6 rounded-3xl flex items-center justify-center">
                                <div className="text-center group cursor-pointer">
                                    <p className="text-blue-400 font-bold hover:underline mb-1">View Analytics</p>
                                    <TrendingUp className="w-5 h-5 text-blue-400 mx-auto group-hover:translate-y-[-2px] transition-transform" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="space-y-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">Investment Opportunities</h2>
                            <p className="text-gray-400">Discover vetted SME deals currently open for subscription.</p>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-2xl border border-gray-800 h-fit">
                            {(['active', 'upcoming', 'ended'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setActiveFilter(f)}
                                    className={`px-6 py-2.5 rounded-xl font-bold capitalize transition-all text-sm ${activeFilter === f
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Offerings Grid */}
                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-10">
                            {[1, 2].map(i => (
                                <div key={i} className="bg-gray-800/50 border border-gray-800 rounded-[2rem] h-[400px] animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                            {offerings.length === 0 ? (
                                <div className="col-span-full text-center py-32 bg-gray-800/30 rounded-[2.5rem] border border-gray-800 border-dashed">
                                    <Rocket className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                                    <h3 className="text-2xl font-bold text-gray-500">No Offerings Available</h3>
                                    <p className="text-gray-600 mt-2 max-w-sm mx-auto">There are currently no SMEs listed on the Launchpad. Check back soon for new drops.</p>
                                </div>
                            ) : offerings.filter(o => calculateStatus(o.startTime, o.endTime).label.toLowerCase() === activeFilter).length === 0 ? (
                                <div className="col-span-full text-center py-32 bg-gray-800/30 rounded-[2.5rem] border border-gray-800 border-dashed">
                                    <Clock className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                                    <h3 className="text-2xl font-bold text-gray-500">No {activeFilter} Drops</h3>
                                    <p className="text-gray-600 mt-2">Check the other categories for available investments.</p>
                                </div>
                            ) : (
                                offerings
                                    .filter(offering => calculateStatus(offering.startTime, offering.endTime).label.toLowerCase() === activeFilter)
                                    .map((offering) => {
                                        const status = calculateStatus(offering.startTime, offering.endTime)
                                        return (
                                            <div
                                                key={offering.id}
                                                className="group relative bg-gray-800/40 border border-gray-700/50 rounded-[2rem] overflow-hidden hover:border-blue-500/50 transition-all duration-500 cursor-pointer flex flex-col shadow-lg hover:shadow-blue-500/10"
                                                onClick={() => router.push(`/trading/launchpad/${offering.id}`)}
                                            >
                                                {/* Card Header with Background */}
                                                <div className="h-48 relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1620325867502-221cfb5fc5f7?auto=format&fit=crop&q=80&w=1000')] bg-cover bg-center group-hover:scale-110 transition-transform duration-700" />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-800 to-transparent" />

                                                    <div className="absolute top-5 right-5">
                                                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter backdrop-blur-xl border border-white/10 ${status.color}`}>
                                                            {status.label}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-8 space-y-6 flex-1 flex flex-col pt-0 -mt-10 relative z-10">
                                                    <div className="w-20 h-20 bg-gray-900 border-2 border-gray-700 rounded-3xl flex items-center justify-center shadow-2xl group-hover:border-blue-500/50 transition-colors">
                                                        <Rocket className="w-10 h-10 text-blue-400" />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <h3 className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors leading-tight">
                                                            {offering.deal?.sme?.companyName}
                                                        </h3>
                                                        <p className="text-sm text-gray-400 font-medium">{offering.deal?.title}</p>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Target Raise</p>
                                                            <p className="text-lg font-black text-white">{formatCurrency(offering.hardCap)}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Price / Unit</p>
                                                            <p className="text-lg font-black text-blue-400">${offering.unitPrice.toFixed(2)}</p>
                                                        </div>
                                                    </div>

                                                    <div className="pt-6 border-t border-gray-700/50 mt-auto flex items-center justify-between">
                                                        <div className="flex items-center space-x-2 text-gray-500 text-xs font-bold">
                                                            <Clock className="w-4 h-4" />
                                                            <span>Ends {new Date(offering.endTime).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex items-center text-xs font-black text-blue-400 uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                                                            Explore Deal <ChevronRight className="w-4 h-4 ml-1" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                            )}
                        </div>
                    )}
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
