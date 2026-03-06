'use client'

import { useState, useEffect } from 'react'
import { authorizedRequest } from '@/lib/api'
import { ArrowLeft, Rocket, ShieldCheck, Wallet, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'

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
            <div className="space-y-8">
                {/* Header / Banner */}
                <div className="h-64 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-b border-gray-800 relative rounded-3xl overflow-hidden">
                    <div className="absolute inset-0 bg-gray-900/50" /> {/* Overlay */}
                    <div className="absolute inset-0 max-w-7xl mx-auto px-6 lg:px-8 py-8 flex flex-col justify-between">
                        <button
                            onClick={() => router.push('/trading/launchpad')}
                            className="flex items-center text-gray-400 hover:text-white transition-colors w-fit bg-gray-800/50 backdrop-blur-md px-4 py-2 rounded-full border border-gray-700/50"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Launchpad
                        </button>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-6">
                                <div className="w-24 h-24 bg-gray-800 border-2 border-gray-700 rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-xl">
                                    <Rocket className="w-10 h-10 text-blue-400" />
                                </div>
                                <div>
                                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">{offering.deal.sme.companyName}</h1>
                                    <p className="text-xl text-gray-300">{offering.deal.title}</p>
                                </div>
                            </div>
                            {stats && (
                                <div className="hidden lg:flex flex-col items-end">
                                    <p className="text-sm text-gray-400 mb-1">Funding Progress</p>
                                    <p className="text-2xl font-bold">${stats.totalRaised.toLocaleString()} <span className="text-sm font-normal text-gray-500">of ${stats.hardCap.toLocaleString()}</span></p>
                                    <div className="w-48 h-2 bg-gray-800 rounded-full mt-2 overflow-hidden border border-gray-700">
                                        <div
                                            className="h-full bg-blue-500 transition-all duration-500"
                                            style={{ width: `${stats.completionPercentage}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="hidden md:flex space-x-4">
                                <a href={`/trading/dataroom/${offering.dealId}`} className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-xl font-medium hover:bg-gray-700 transition">
                                    View Data Room
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto py-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

                        {/* Left Column: Details */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Highlights */}
                            <div className="bg-gray-800/30 border border-gray-800 rounded-3xl p-8">
                                <h3 className="text-xl font-bold mb-6 flex items-center">
                                    <ShieldCheck className="w-5 h-5 text-green-400 mr-2" />
                                    Deal Highlights
                                </h3>
                                <div className="prose prose-invert max-w-none text-gray-300 whitespace-pre-line">
                                    {offering.deal.description || "No description provided."}
                                </div>
                            </div>

                            {/* Financial Metrics */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-gray-800/30 border border-gray-800 rounded-2xl p-6">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Hard Cap</p>
                                    <p className="text-xl font-bold">${offering.hardCap.toLocaleString()}</p>
                                </div>
                                <div className="bg-gray-800/30 border border-gray-800 rounded-2xl p-6">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Unit Price</p>
                                    <p className="text-xl font-bold">${offering.unitPrice.toFixed(2)}</p>
                                </div>
                                <div className="bg-gray-800/30 border border-gray-800 rounded-2xl p-6">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Min Commit</p>
                                    <p className="text-xl font-bold">${offering.minCommitment.toLocaleString()}</p>
                                </div>
                                <div className="bg-gray-800/30 border border-gray-800 rounded-2xl p-6">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Max Commit</p>
                                    <p className="text-xl font-bold">${offering.maxCommitment.toLocaleString()}</p>
                                </div>
                            </div>

                            {/* SME Info */}
                            <div className="bg-gray-800/30 border border-gray-800 rounded-3xl p-8">
                                <h3 className="text-xl font-bold mb-6">Issuer Information</h3>
                                <div className="grid grid-cols-2 gap-y-6">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Company Name</p>
                                        <p className="font-medium">{offering.deal.sme.companyName}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Industry</p>
                                        <p className="font-medium">{offering.deal.sme.industry || 'Tech'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Registration #</p>
                                        <p className="font-medium">{offering.deal.sme.registrationNumber || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Incorporated</p>
                                        <p className="font-medium">{offering.deal.sme.incorporationDate ? new Date(offering.deal.sme.incorporationDate).getFullYear() : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Checkout / Status Area */}
                        <div className="lg:col-span-1">
                            <div className="bg-gray-800 rounded-3xl border border-gray-700 shadow-2xl p-8 sticky top-24">
                                {/* Status Indicator */}
                                {isUpcoming && (
                                    <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-xl p-4 mb-6 flex items-start text-sm">
                                        <Clock className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold mb-1">Offering Upcoming</p>
                                            <p className="opacity-80">This Launchpad offering opens on {start.toLocaleString()}.</p>
                                        </div>
                                    </div>
                                )}

                                {isEnded && (
                                    <div className="bg-gray-700 border border-gray-600 text-gray-300 rounded-xl p-4 mb-6 flex items-start text-sm">
                                        <CheckCircle2 className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold mb-1">Subscription Closed</p>
                                            <p className="opacity-80">Check the secondary market to trade these units.</p>
                                        </div>
                                    </div>
                                )}

                                {isActive && (
                                    <>
                                        <div className="bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl p-4 mb-6 flex items-center text-sm">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-3 flex-shrink-0" />
                                            <p className="font-bold">Subscription Period Active</p>
                                        </div>

                                        {userKycStatus !== 'VERIFIED' && (
                                            <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl p-4 mb-6 flex items-start text-sm">
                                                <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold mb-1">KYC Verification Required</p>
                                                    <p className="opacity-80 mb-2">You must be KYC verified to participate in this offering.</p>
                                                    <Link href="/trading/profile" className="text-orange-400 font-bold hover:underline">
                                                        Complete Verification &rarr;
                                                    </Link>
                                                </div>
                                            </div>
                                        )}

                                        {stats && (
                                            <div className="mb-6 p-4 bg-gray-900/50 rounded-2xl border border-gray-700/50">
                                                <div className="flex justify-between items-end mb-2">
                                                    <span className="text-sm text-gray-400">Raised so far</span>
                                                    <span className="text-lg font-bold text-blue-400">{stats.completionPercentage.toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-800 mb-3">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-1000"
                                                        style={{ width: `${stats.completionPercentage}%` }}
                                                    />
                                                </div>
                                                <div className="flex justify-between text-xs text-gray-500">
                                                    <span>{stats.investorCount.toLocaleString()} Investors</span>
                                                    <span>Target: ${stats.hardCap.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mb-6 pb-6 border-b border-gray-700">
                                            <h4 className="text-lg font-bold mb-4">Commit Funds</h4>
                                            <p className="text-sm text-gray-400 mb-4">
                                                Lock your fiat balance to request an allocation in this SME Deal.
                                            </p>

                                            <form onSubmit={handleCommit}>
                                                <div className="mb-4 relative">
                                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                        <span className="text-gray-500">$</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        value={commitAmount}
                                                        onChange={(e) => setCommitAmount(e.target.value)}
                                                        min={offering.minCommitment}
                                                        max={offering.maxCommitment}
                                                        placeholder="1,000"
                                                        disabled={isSubmitting}
                                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 pl-8 pr-4 text-white hover:border-blue-500/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                                                    />
                                                </div>

                                                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
                                                {success && <p className="text-green-400 text-sm mb-4 bg-green-500/10 p-3 rounded-lg border border-green-500/20">{success}</p>}

                                                <button
                                                    type="submit"
                                                    disabled={isSubmitting}
                                                    className="w-full bg-blue-600 text-white font-bold rounded-xl py-3 px-4 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
                                                >
                                                    {isSubmitting ? 'Locking Funds...' : 'Lock Commitment'}
                                                </button>
                                            </form>
                                        </div>
                                    </>
                                )}

                                <div className="flex items-center text-sm text-gray-400">
                                    <Wallet className="w-4 h-4 mr-2" />
                                    Uses Fiat Balance from Wallet
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
