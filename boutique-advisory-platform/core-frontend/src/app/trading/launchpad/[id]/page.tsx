'use client'

import { useState, useEffect } from 'react'
import { authorizedRequest } from '@/lib/api'
import { ArrowLeft, Rocket, ShieldCheck, Wallet, AlertCircle, Clock, CheckCircle2, ChevronRight, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import CreateLaunchpadModal from '../components/CreateLaunchpadModal'

interface OfferingDetail {
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
            registrationNumber: string
            incorporationDate: string
        }
    }
}

export default function LaunchpadDetailPage({ params }: any) {
    const router = useRouter()
    const { id } = params
    const [offering, setOffering] = useState<OfferingDetail | null>(null)
    const [stats, setStats] = useState<{ totalRaised: number, investorCount: number, completionPercentage: number, hardCap: number } | null>(null)
    const [userKycStatus, setUserKycStatus] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [commitAmount, setCommitAmount] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true)
            await Promise.all([
                fetchOffering(),
                fetchStats(),
                fetchUserKyc()
            ])
            setIsLoading(false)
        }
        fetchInitialData()
    }, [id])

    const fetchStats = async () => {
        try {
            const response = await authorizedRequest(`/api/launchpad/${id}/stats`)
            if (response.ok) {
                setStats(await response.json())
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err)
        }
    }

    const fetchUserKyc = async () => {
        try {
            const userStr = localStorage.getItem('user')
            if (userStr) {
                const user = JSON.parse(userStr)
                if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
                    setIsAdmin(true)
                }
                // In a real app we'd fetch fresh from /api/auth/me or a dedicated profile endpoint
                const response = await authorizedRequest('/api/auth/me')
                if (response.ok) {
                    const data = await response.json()
                    setUserKycStatus(data.user.investor?.kycStatus || 'PENDING')
                } else {
                    setUserKycStatus(user.investor?.kycStatus || 'PENDING')
                }
            }
        } catch (e) { }
    }

    const fetchOffering = async () => {
        try {
            const response = await authorizedRequest(`/api/launchpad/${id}`)
            if (response.ok) {
                const data = await response.json()
                setOffering(data)
            } else {
                setError('Failed to load offering details.')
            }
        } catch (error) {
            console.error('Failed to fetch offering:', error)
            setError('Failed to load offering details.')
        } finally {
            setIsLoading(false)
        }
    }

    const handleCommit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        const amount = parseFloat(commitAmount)
        if (isNaN(amount) || amount <= 0) {
            setError('Please enter a valid amount.')
            return
        }

        setIsSubmitting(true)
        try {
            const response = await authorizedRequest(`/api/launchpad/${id}/commit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to submit commitment')
            }

            setSuccess('Commitment successful! Funds have been securely locked.')
            setCommitAmount('')
            fetchStats() // Refresh stats after commitment
        } catch (err: any) {
            setError(err.message || 'Failed to submit commitment. Please check your wallet balance.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(value)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex justify-center py-40">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    if (!offering) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-8">
                <div className="max-w-4xl mx-auto text-center py-20">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold">Offering Not Found</h2>
                    <br />
                    <button onClick={() => router.push('/trading/launchpad')} className="text-blue-400 hover:text-blue-300">
                        &larr; Back to Launchpad
                    </button>
                </div>
            </div>
        )
    }

    const now = new Date()
    const start = new Date(offering.startTime)
    const end = new Date(offering.endTime)
    const isActive = now >= start && now <= end
    const isUpcoming = now < start
    const isEnded = now > end

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-12 pb-20">
                {/* Header / Banner - Premium Institutional Structure */}
                <div className="relative h-[32rem] rounded-[3rem] overflow-hidden bg-gray-900 border border-gray-800 shadow-2xl">
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-30 mix-blend-overlay" />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />

                    <div className="absolute inset-0 p-10 md:p-16 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <button
                                onClick={() => router.push('/trading/launchpad')}
                                className="flex items-center text-gray-300 hover:text-white transition-all bg-gray-800/40 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/5 font-bold text-sm group"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                                Back to Discover
                            </button>

                            <div className="flex gap-3">
                                <div className="bg-gray-800/40 backdrop-blur-xl border border-white/5 px-6 py-3 rounded-2xl flex items-center space-x-2">
                                    <ShieldCheck className="w-4 h-4 text-green-400" />
                                    <span className="text-xs font-black uppercase tracking-widest text-white">Verified SME</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                            <div className="space-y-6 max-w-2xl">
                                <div className="w-24 h-24 bg-gray-900 border-2 border-gray-700/50 rounded-[2rem] flex items-center justify-center shadow-2xl backdrop-blur-xl group hover:border-blue-500/50 transition-colors">
                                    <Rocket className="w-12 h-12 text-blue-400" />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-none">{offering.deal.sme.companyName}</h1>
                                    <p className="text-2xl text-gray-400 font-medium">{offering.deal.title}</p>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    <div className="px-5 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-sm font-bold uppercase tracking-widest">
                                        {offering.deal.sme.industry || 'Asset Management'}
                                    </div>
                                    <div className="px-5 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-gray-400 text-sm font-bold uppercase tracking-widest flex items-center">
                                        <Clock className="w-4 h-4 mr-2" />
                                        Ends {new Date(offering.endTime).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            <div className="hidden lg:flex flex-col items-end space-y-4">
                                <a
                                    href={`/trading/dataroom/${offering.dealId}`}
                                    className="px-10 py-5 bg-white text-gray-900 rounded-[1.5rem] font-black hover:bg-gray-200 transition-all shadow-xl shadow-white/5 flex items-center"
                                >
                                    Access Data Room
                                    <ChevronRight className="w-5 h-5 ml-2" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Left Column: Details */}
                    <div className="lg:col-span-2 space-y-12">
                        {/* Financial Overview Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {[
                                { label: 'Target Raise', value: formatCurrency(offering.hardCap), desc: 'Hard Cap Target' },
                                { label: 'Unit Price', value: `$${offering.unitPrice.toFixed(2)}`, desc: 'Per Equity Token' },
                                { label: 'Min Commit', value: formatCurrency(offering.minCommitment), desc: 'Barrier to Entry' },
                                { label: 'Max Commit', value: formatCurrency(offering.maxCommitment), desc: 'Individual Limit' },
                            ].map((stat, i) => (
                                <div key={i} className="bg-gray-800/20 border border-gray-800 rounded-3xl p-8 hover:border-gray-700 transition-colors group">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3">{stat.label}</p>
                                    <p className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{stat.value}</p>
                                    <p className="text-[10px] font-bold text-gray-600 mt-2">{stat.desc}</p>
                                </div>
                            ))}
                        </div>

                        {/* Executive Summary */}
                        <div className="bg-gray-800/20 border border-gray-800 rounded-[2.5rem] p-10 md:p-14 space-y-8">
                            <h3 className="text-2xl font-black text-white flex items-center">
                                <ShieldCheck className="w-7 h-7 text-green-400 mr-4" />
                                Executive Investment Summary
                            </h3>
                            <div className="prose prose-invert max-w-none text-gray-400 text-lg leading-relaxed whitespace-pre-line font-medium">
                                {offering.deal.description || "No detailed summary provided for this offering."}
                            </div>
                        </div>

                        {/* Issuer DNA */}
                        <div className="bg-gray-800/20 border border-gray-800 rounded-[2.5rem] p-10 md:p-14">
                            <h3 className="text-2xl font-black text-white mb-10 uppercase tracking-widest text-sm text-gray-500">
                                Institutional Profile
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Legal Identity</p>
                                    <p className="text-xl font-bold text-white uppercase tracking-tight">{offering.deal.sme.companyName}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Incorporation Hub</p>
                                    <p className="text-xl font-bold text-white uppercase tracking-tight">Kingdom of Cambodia</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Registration Number</p>
                                    <p className="text-xl font-bold text-gray-300 font-mono tracking-tighter">{offering.deal.sme.registrationNumber || 'KH-REG-48201'}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Operational Since</p>
                                    <p className="text-xl font-bold text-white uppercase tracking-tight">{offering.deal.sme.incorporationDate ? new Date(offering.deal.sme.incorporationDate).getFullYear() : '2019'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Investment Gateway */}
                    <div className="lg:col-span-1">
                        <div className="bg-gray-800/80 backdrop-blur-3xl rounded-[2.5rem] border border-gray-700 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] p-10 sticky top-24 space-y-8">
                            {/* Dynamic Status Badges */}
                            {isUpcoming && (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 rounded-3xl p-6 space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <Clock className="w-5 h-5" />
                                        <p className="font-black uppercase tracking-widest text-xs">Awaiting Activation</p>
                                    </div>
                                    <p className="text-sm font-medium opacity-80">This gateway will unlock on {start.toLocaleString()}. Ensure your wallet is funded.</p>
                                </div>
                            )}

                            {isEnded && (
                                <div className="bg-gray-900 border border-gray-700 text-gray-400 rounded-3xl p-6 space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <CheckCircle2 className="w-5 h-5" />
                                        <p className="font-black uppercase tracking-widest text-xs">Offering Finalized</p>
                                    </div>
                                    <p className="text-sm font-medium opacity-80">The primary subscription period has concluded. Units may be available on the secondary market.</p>
                                </div>
                            )}

                            {isActive && (
                                <>
                                    <div className="bg-green-500/10 border border-green-500/30 text-green-500 rounded-3xl p-6 flex items-center space-x-4">
                                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                                        <p className="font-black uppercase tracking-[0.2em] text-xs">Investment Gateway Open</p>
                                    </div>

                                    {userKycStatus !== 'VERIFIED' && (
                                        <div className="bg-red-500/10 border border-red-500/30 text-red-500 rounded-3xl p-6 space-y-4">
                                            <div className="flex items-center space-x-2">
                                                <AlertCircle className="w-5 h-5 font-black" />
                                                <p className="font-black uppercase tracking-widest text-xs">Compliance Barrier</p>
                                            </div>
                                            <p className="text-sm font-medium opacity-80 leading-relaxed">Regulatory compliance requires completed KYC verification for equity participation.</p>
                                            <Link href="/trading/profile" className="inline-flex items-center font-black text-xs uppercase tracking-widest hover:underline">
                                                Complete KYC Now <ChevronRight className="w-4 h-4 ml-1" />
                                            </Link>
                                        </div>
                                    )}

                                    {stats && (
                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Funding Velocity</span>
                                                    <span className="text-2xl font-black text-blue-400 tracking-tighter">{stats.completionPercentage.toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full h-4 bg-gray-900 rounded-full overflow-hidden border border-gray-800 p-0.5 shadow-inner">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-purple-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all duration-[2000ms] ease-out flex items-center justify-end px-2"
                                                        style={{ width: `${stats.completionPercentage}%` }}
                                                    >
                                                        <div className="w-1 h-1 bg-white rounded-full animate-pulse shadow-[0_0_10px_white]" />
                                                    </div>
                                                </div>
                                                <div className="flex justify-between text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                                    <span>{stats.investorCount.toLocaleString()} Institutional Backers</span>
                                                    <span>Cap: {formatCurrency(stats.hardCap)}</span>
                                                </div>
                                            </div>

                                            <div className="pt-6 border-t border-gray-700/50 space-y-6">
                                                <div className="space-y-3">
                                                    <h4 className="text-lg font-black text-white uppercase tracking-tight">Commit Capital</h4>
                                                    <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                                        Funds will be escrowed and held securely until the offering activation is finalized.
                                                    </p>
                                                </div>

                                                <form onSubmit={handleCommit} className="space-y-5">
                                                    <div className="relative group">
                                                        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                                            <span className="text-gray-500 font-bold">$</span>
                                                        </div>
                                                        <input
                                                            type="number"
                                                            value={commitAmount}
                                                            onChange={(e) => setCommitAmount(e.target.value)}
                                                            min={offering.minCommitment}
                                                            max={offering.maxCommitment}
                                                            placeholder="Amount to Invest"
                                                            disabled={isSubmitting}
                                                            className="w-full bg-gray-900 border-2 border-gray-800 rounded-2xl py-5 pl-12 pr-6 text-white font-black text-xl placeholder:text-gray-700 hover:border-blue-500/30 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 transition-all outline-none"
                                                        />
                                                    </div>

                                                    {error && (
                                                        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center space-x-3 text-red-400 text-xs font-bold">
                                                            <AlertCircle className="w-4 h-4" />
                                                            <span>{error}</span>
                                                        </div>
                                                    )}

                                                    {success && (
                                                        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center space-x-3 text-green-400 text-xs font-bold">
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            <span>{success}</span>
                                                        </div>
                                                    )}

                                                    <button
                                                        type="submit"
                                                        disabled={isSubmitting || userKycStatus !== 'VERIFIED'}
                                                        className="w-full bg-blue-600 text-white font-black rounded-2xl py-5 px-6 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-600/20 uppercase tracking-widest text-sm"
                                                    >
                                                        {isSubmitting ? 'Processing Transaction...' : 'Finalize Commitment'}
                                                    </button>
                                                </form>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center text-[10px] font-black text-gray-600 uppercase tracking-widest justify-center">
                                        <Wallet className="w-3 h-3 mr-2" />
                                        Draws from Primary Currency Wallet
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <CreateLaunchpadModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => {
                        fetchOffering()
                        fetchStats()
                    }}
                />
            </div>
        </DashboardLayout>
    )
}
