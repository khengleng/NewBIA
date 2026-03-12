'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    Users,
    Plus,
    DollarSign,
    Target,
    TrendingUp,
    Clock,
    ChevronRight,
    Star,
    UserPlus,
    CheckCircle2,
    AlertCircle,
    ArrowUpRight
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import usePermissions from '../../hooks/usePermissions'
import { authorizedRequest } from '@/lib/api'

// Updated API URL to match the backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003'

interface Syndicate {
    id: string
    name: string
    description: string
    leadInvestor: {
        id: string
        name: string
        type: string
    }
    targetAmount: number
    raisedAmount: number
    minInvestment: number
    maxInvestment: number
    managementFee: number
    carryFee: number
    status: string
    deal?: {
        id: string
        title: string
        amount: number
    }
    memberCount: number
    closingDate: string
    progress: number
    createdAt: string
    isTokenized: boolean
    tokenSymbol?: string
    tokenPrice?: number
}

interface SyndicateStats {
    totalSyndicates: number
    activeSyndicates: number
    totalRaised: number
    totalTarget: number
    totalMembers: number
    avgSyndicateSize: number
}

export default function SyndicatesPage() {
    const { addToast } = useToast()
    const { isAdmin, isInvestor } = usePermissions()

    const [syndicates, setSyndicates] = useState<Syndicate[]>([])
    const [stats, setStats] = useState<SyndicateStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'OPEN' | 'FORMING' | 'FUNDED'>('all')
    const [showJoinModal, setShowJoinModal] = useState(false)
    const [selectedSyndicate, setSelectedSyndicate] = useState<Syndicate | null>(null)
    const [joinAmount, setJoinAmount] = useState('')
    const [isJoining, setIsJoining] = useState(false)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const userData = localStorage.getItem('user')
            if (!userData) {
                window.location.href = '/auth/login'
                return
            }

            // Fetch syndicates
            const syndicatesRes = await authorizedRequest('/api/syndicates')
            if (syndicatesRes.ok) {
                const data = await syndicatesRes.json()
                setSyndicates(data)
            }

            // Fetch stats
            const statsRes = await authorizedRequest('/api/syndicates/stats/overview')
            if (statsRes.ok) {
                setStats(await statsRes.json())
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            addToast('error', 'Error loading syndicates')
        } finally {
            setIsLoading(false)
        }
    }

    const handleJoinClick = (syndicate: Syndicate) => {
        setSelectedSyndicate(syndicate)
        setJoinAmount(syndicate.minInvestment.toString())
        setShowJoinModal(true)
    }

    const handleJoinSyndicate = async () => {
        if (!selectedSyndicate) return
        setIsJoining(true)

        try {
            const response = await authorizedRequest(`/api/syndicates/${selectedSyndicate.id}/join`, {
                method: 'POST',
                body: JSON.stringify({ amount: parseFloat(joinAmount) })
            })

            if (response.ok) {
                addToast('success', 'Request to join syndicate submitted!')
                setShowJoinModal(false)
                fetchData()
            } else {
                const error = await response.json()
                addToast('error', error.error || 'Failed to join syndicate')
            }
        } catch (error) {
            console.error('Error joining syndicate:', error)
            addToast('error', 'Error joining syndicate')
        } finally {
            setIsJoining(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'OPEN': return 'bg-green-500/20 text-green-400'
            case 'FORMING': return 'bg-blue-500/20 text-blue-400'
            case 'FUNDED': return 'bg-purple-500/20 text-purple-400'
            case 'CLOSED': return 'bg-gray-500/20 text-gray-400'
            default: return 'bg-gray-500/20 text-gray-400'
        }
    }

    const filteredSyndicates = filter === 'all'
        ? syndicates
        : syndicates.filter(s => s.status === filter)

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
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Users className="w-8 h-8 text-blue-400" />
                        Investor Syndicates
                    </h1>
                    <p className="text-gray-400 mt-2">Pool investments with other investors for larger opportunities</p>
                </div>
                {isInvestor && (
                    <Link
                        href="/syndicates/create"
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-blue-500/25"
                    >
                        <Plus className="w-5 h-5" />
                        Create Syndicate
                    </Link>
                )}
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-xl p-6 border border-blue-700/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-300 text-sm">Active Syndicates</p>
                                <p className="text-3xl font-bold text-white mt-1">{stats.activeSyndicates}</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                <Target className="w-6 h-6 text-blue-400" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-xl p-6 border border-green-700/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-300 text-sm">Total Raised</p>
                                <p className="text-3xl font-bold text-white mt-1">
                                    ${((stats.totalRaised || 0) / 1000).toFixed(0)}K
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-green-400" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-xl p-6 border border-purple-700/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-300 text-sm">Target Amount</p>
                                <p className="text-3xl font-bold text-white mt-1">
                                    ${((stats.totalTarget || 0) >= 1000000
                                        ? ((stats.totalTarget || 0) / 1000000).toFixed(1) + 'M'
                                        : ((stats.totalTarget || 0) / 1000).toFixed(0) + 'K'
                                    )}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-purple-400" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 rounded-xl p-6 border border-amber-700/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-amber-300 text-sm">Total Members</p>
                                <p className="text-3xl font-bold text-white mt-1">{stats.totalMembers || 0}</p>
                            </div>
                            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                                <Users className="w-6 h-6 text-amber-400" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex space-x-2 mb-6">
                {['all', 'OPEN', 'FORMING', 'FUNDED'].map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status as any)}
                        className={`px-4 py-2 rounded-lg transition-all ${filter === status
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {status === 'all' ? 'All' : status}
                    </button>
                ))}
            </div>

            {/* Syndicates Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredSyndicates.map((syndicate) => (
                    <div key={syndicate.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-blue-500/50 transition-all group">
                        {/* Header */}
                        <div className="p-6 pb-4">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-xl font-bold text-white">{syndicate.name}</h3>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(syndicate.status)}`}>
                                            {syndicate.status}
                                        </span>
                                    </div>
                                    <p className="text-gray-400 text-sm line-clamp-2">{syndicate.description}</p>
                                </div>
                            </div>

                            {/* Lead Investor */}
                            {syndicate.leadInvestor && (
                                <div className="flex items-center gap-2 mb-4">
                                    <Star className="w-4 h-4 text-amber-400" />
                                    <span className="text-sm text-gray-400">Lead Investor:</span>
                                    <span className="text-sm text-white font-medium">{syndicate.leadInvestor.name}</span>
                                    <span className="text-xs text-gray-500">({syndicate.leadInvestor.type})</span>
                                </div>
                            )}

                            {/* Deal Info */}
                            {syndicate.deal && (
                                <div className="bg-gray-700/50 rounded-lg p-3 mb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ArrowUpRight className="w-4 h-4 text-blue-400" />
                                            <span className="text-sm text-white">{syndicate.deal.title}</span>
                                        </div>
                                        <span className="text-sm font-bold text-green-400">${(syndicate.deal.amount / 1000).toFixed(0)}K</span>
                                    </div>
                                </div>
                            )}

                            {/* Progress Bar */}
                            <div className="mb-4">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-400">Raised</span>
                                    <span className="text-white font-medium">
                                        ${(syndicate.raisedAmount / 1000).toFixed(0)}K / ${(syndicate.targetAmount / 1000).toFixed(0)}K
                                    </span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-3">
                                    <div
                                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all"
                                        style={{ width: `${Math.min(syndicate.progress, 100)}%` }}
                                    />
                                </div>
                                <div className="text-right mt-1">
                                    <span className="text-xs text-blue-400">{syndicate.progress}% funded</span>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="bg-gray-700/50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400">Min Investment</p>
                                    <p className="text-sm font-bold text-white">${syndicate.minInvestment.toLocaleString()}</p>
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400">Members</p>
                                    <p className="text-sm font-bold text-white">{syndicate.memberCount}</p>
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-3">
                                    <p className="text-xs text-gray-400">Fees</p>
                                    <p className="text-sm font-bold text-white">{syndicate.managementFee}% / {syndicate.carryFee}%</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-800/80 border-t border-gray-700 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <Clock className="w-4 h-4" />
                                <span>Closes: {new Date(syndicate.closingDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex gap-2">
                                <Link
                                    href={`/syndicates/${syndicate.id}`}
                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-1 transition-colors"
                                >
                                    Details
                                    <ChevronRight className="w-4 h-4" />
                                </Link>
                                {syndicate.status === 'OPEN' && isInvestor && (
                                    <button
                                        onClick={() => handleJoinClick(syndicate)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-1 transition-colors"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Join
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredSyndicates.length === 0 && (
                <div className="text-center py-16">
                    <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No syndicates found</p>
                    <p className="text-gray-500 text-sm mt-2">Try adjusting your filters or create a new syndicate</p>
                </div>
            )}

            {/* Join Modal */}
            {showJoinModal && selectedSyndicate && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-4">Join Syndicate</h3>
                        <p className="text-gray-400 mb-6">
                            You are about to request to join <strong className="text-white">{selectedSyndicate.name}</strong>
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Investment Amount ($)</label>
                                <input
                                    type="number"
                                    value={joinAmount}
                                    onChange={(e) => setJoinAmount(e.target.value)}
                                    min={selectedSyndicate.minInvestment}
                                    max={selectedSyndicate.maxInvestment || undefined}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Min: ${selectedSyndicate.minInvestment.toLocaleString()}
                                    {selectedSyndicate.maxInvestment && ` | Max: $${selectedSyndicate.maxInvestment.toLocaleString()}`}
                                </p>
                            </div>

                            {/* Token Calculation for Tokenized Syndicates */}
                            {selectedSyndicate.isTokenized && selectedSyndicate.tokenPrice && joinAmount && parseFloat(joinAmount) > 0 && (
                                <div className="bg-cyan-900/20 border border-cyan-700/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-cyan-400 mb-1">You will receive</p>
                                            <p className="text-2xl font-bold text-white">
                                                {(parseFloat(joinAmount) / selectedSyndicate.tokenPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                <span className="text-sm text-cyan-400 ml-2">{selectedSyndicate.tokenSymbol}</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Token Price</p>
                                            <p className="text-sm font-medium text-white">${selectedSyndicate.tokenPrice.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-gray-300">
                                        Your request will be reviewed by the lead investor. You will be notified once approved.
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowJoinModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleJoinSyndicate}
                                    disabled={isJoining || parseFloat(joinAmount) < selectedSyndicate.minInvestment}
                                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isJoining ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-5 h-5" />
                                            Submit Request
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}
