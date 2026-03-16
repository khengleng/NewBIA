'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
    Users,
    ArrowLeft,
    DollarSign,
    Target,
    Clock,
    Star,
    CheckCircle2,
    XCircle,
    ArrowUpRight,
    TrendingUp,
    ShieldCheck,
    Calendar,
    UserPlus,
    AlertCircle
} from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { useToast } from '../../../contexts/ToastContext'
import usePermissions from '../../../hooks/usePermissions'
import { authorizedRequest } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003'

interface Author {
    id: string
    name: string
    role: string
    avatar: string | null
}

interface Member {
    id: string
    investorId: string
    investor: {
        id: string
        name: string
        type: string
    }
    amount: number
    tokens?: number
    status: string
    joinedAt: string
}

interface Syndicate {
    id: string
    name: string
    description: string
    leadInvestor: {
        id: string
        name: string
        type: string
        userId?: string
    }
    leadInvestorId: string
    targetAmount: number
    raisedAmount: number
    minInvestment: number
    maxInvestment: number | null
    managementFee: number
    carryFee: number
    status: string
    isTokenized: boolean
    tokenName?: string
    tokenSymbol?: string
    pricePerToken?: number
    totalTokens?: number
    tokensSold?: number
    deal?: {
        id: string
        title: string
        amount: number
        sme?: {
            id: string
            name: string
        }
    }
    members: Member[]
    memberCount: number
    closingDate: string
    progress: number
    createdAt: string
}

export default function SyndicateDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const { addToast } = useToast()
    const { isAdmin, isInvestor, user } = usePermissions()

    const [syndicate, setSyndicate] = useState<Syndicate | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isJoining, setIsJoining] = useState(false)
    const [isUpdating, setIsUpdating] = useState(false)
    const [joinAmount, setJoinAmount] = useState('')
    const [showJoinModal, setShowJoinModal] = useState(false)
    const [isLead, setIsLead] = useState(false)

    // Tokenization Form State
    const [tokenForm, setTokenForm] = useState({
        isTokenized: false,
        tokenName: '',
        tokenSymbol: '',
        pricePerToken: ''
    })

    useEffect(() => {
        fetchSyndicate()
    }, [params.id])

    useEffect(() => {
        if (syndicate) {
            setTokenForm({
                isTokenized: syndicate.isTokenized || false,
                tokenName: syndicate.tokenName || '',
                tokenSymbol: syndicate.tokenSymbol || '',
                pricePerToken: syndicate.pricePerToken?.toString() || ''
            })
        }
    }, [syndicate])

    const fetchSyndicate = async () => {
        try {
            const response = await authorizedRequest(`/api/syndicates/${params.id}`)
            if (response.ok) {
                const data = await response.json()
                setSyndicate(data)

                // Check if current user is lead investor
                const currentUserStr = localStorage.getItem('user')
                if (currentUserStr) {
                    const currentUser = JSON.parse(currentUserStr)
                    setIsLead(
                        (data.leadInvestor?.userId === currentUser.id) ||
                        (data.leadInvestorId === currentUser.id)
                    )
                }
            } else {
                addToast('error', 'Syndicate not found')
                router.push('/syndicates')
            }
        } catch (error) {
            console.error('Error fetching syndicate:', error)
            addToast('error', 'Error loading syndicate details')
        } finally {
            setIsLoading(false)
        }
    }

    const handleApproveMember = async (memberId: string) => {
        try {
            const response = await authorizedRequest(`/api/syndicates/${params.id}/members/${memberId}/approve`, {
                method: 'POST'
            })
            if (response.ok) {
                addToast('success', 'Member approved!')
                fetchSyndicate()
            } else {
                const error = await response.json()
                addToast('error', error.error || 'Failed to approve member')
            }
        } catch (error) {
            console.error('Error approving member:', error)
            addToast('error', 'Error approving member')
        }
    }

    const handleJoinSyndicate = async () => {
        if (!syndicate) return
        setIsJoining(true)

        try {
            const response = await authorizedRequest(`/api/syndicates/${syndicate.id}/join`, {
                method: 'POST',
                body: JSON.stringify({ amount: parseFloat(joinAmount) })
            })

            const data = await response.json()
            if (response.ok) {
                addToast('success', data.message || 'Request submitted successfully!')
                setShowJoinModal(false)
                fetchSyndicate()
            } else {
                addToast('error', data.error || 'Failed to join syndicate')
            }
        } catch (error) {
            console.error('Error joining syndicate:', error)
            addToast('error', 'Error joining syndicate')
        } finally {
            setIsJoining(false)
        }
    }

    const handleUpdateTokenization = async () => {
        if (!syndicate) return
        setIsUpdating(true)

        try {
            const response = await authorizedRequest(`/api/syndicates/${syndicate.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    isTokenized: tokenForm.isTokenized,
                    tokenName: tokenForm.tokenName,
                    tokenSymbol: tokenForm.tokenSymbol,
                    pricePerToken: parseFloat(tokenForm.pricePerToken)
                })
            })

            if (response.ok) {
                addToast('success', 'Syndicate tokenization updated!')
                fetchSyndicate()
            } else {
                const error = await response.json()
                addToast('error', error.error || 'Failed to update tokenization')
            }
        } catch (error) {
            console.error('Error updating tokenization:', error)
            addToast('error', 'Error updating tokenization')
        } finally {
            setIsUpdating(false)
        }
    }

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
                </div>
            </DashboardLayout>
        )
    }

    if (!syndicate) return null

    const isMember = syndicate.members.some(m => {
        const currentUserStr = localStorage.getItem('user')
        if (!currentUserStr) return false
        const currentUser = JSON.parse(currentUserStr)
        return m.investorId === currentUser.id
    })

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
                    <div>
                        <button
                            onClick={() => router.push('/syndicates')}
                            className="flex items-center text-gray-400 hover:text-white mb-4 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Syndicates
                        </button>
                        <div className="flex items-center gap-4">
                            <h1 className="text-3xl font-bold text-white">{syndicate.name}</h1>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${syndicate.status === 'OPEN' ? 'bg-green-500/20 text-green-400' :
                                syndicate.status === 'FORMING' ? 'bg-blue-500/20 text-blue-400' :
                                    'bg-purple-500/20 text-purple-400'
                                }`}>
                                {syndicate.status}
                            </span>
                        </div>
                        <p className="text-gray-400 mt-2 max-w-2xl">{syndicate.description}</p>
                    </div>

                    {!isLead && isInvestor && (syndicate.status === 'OPEN' || syndicate.status === 'FORMING') && (
                        <button
                            onClick={() => {
                                setJoinAmount(syndicate.minInvestment.toString())
                                setShowJoinModal(true)
                            }}
                            className={`${isMember ? 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-500/25' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'} text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg`}
                        >
                            {isMember ? <TrendingUp className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                            {isMember ? 'Top Up Investment' : 'Join Syndicate'}
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Details */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                                <p className="text-gray-400 text-sm mb-1">Raised Amount</p>
                                <p className="text-2xl font-bold text-white">${(syndicate.raisedAmount / 1000).toFixed(0)}K</p>
                                <div className="mt-4 w-full bg-gray-700 rounded-full h-2">
                                    <div
                                        className="bg-blue-500 h-2 rounded-full transition-all"
                                        style={{ width: `${Math.min(syndicate.progress, 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-blue-400 mt-2">{syndicate.progress}% of ${(syndicate.targetAmount / 1000).toFixed(0)}K target</p>
                            </div>

                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                                <p className="text-gray-400 text-sm mb-1">Min Investment</p>
                                <p className="text-2xl font-bold text-white">${syndicate.minInvestment.toLocaleString()}</p>
                                <p className="text-xs text-gray-500 mt-2">Max: {syndicate.maxInvestment ? `$${syndicate.maxInvestment.toLocaleString()}` : 'Unlimited'}</p>
                            </div>

                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                                <p className="text-gray-400 text-sm mb-1">Fees (Mgmt/Carry)</p>
                                <p className="text-2xl font-bold text-white">{syndicate.managementFee}% / {syndicate.carryFee}%</p>
                                <p className="text-xs text-gray-500 mt-2">Standard market rates</p>
                            </div>
                        </div>

                        {/* Token Details (if tokenized) */}
                        {syndicate.isTokenized && (
                            <div className="bg-gradient-to-r from-blue-900/40 to-cyan-900/40 rounded-xl p-6 border border-blue-500/30">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                                        Tokenized Asset Details
                                    </h3>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/10 rounded-full border border-cyan-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                                        <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest">Secondary Market Ready</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div>
                                        <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">Token Name</p>
                                        <p className="text-white font-bold">{syndicate.tokenName}</p>
                                        <p className="text-cyan-400 text-xs font-mono">{syndicate.tokenSymbol}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">Price</p>
                                        <p className="text-white font-bold text-xl">${syndicate.pricePerToken}</p>
                                        <p className="text-gray-500 text-xs">per token</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">Supply</p>
                                        <p className="text-white font-bold text-xl">{syndicate.totalTokens?.toLocaleString()}</p>
                                        <p className="text-gray-500 text-xs">total tokens</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">Sold</p>
                                        <p className="text-white font-bold text-xl">{syndicate.tokensSold?.toLocaleString()}</p>
                                        <p className="text-cyan-400 text-xs font-bold flex items-center gap-1">
                                            {syndicate.totalTokens ? ((syndicate.tokensSold || 0) / syndicate.totalTokens * 100).toFixed(1) : 0}%
                                            <span className="text-gray-500 font-normal">sold</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Management Actions (Lead/Admin Only) - Only show if NOT already tokenized */}
                        {(isLead || isAdmin) && !syndicate.isTokenized && (
                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-purple-400" />
                                    Syndicate Management
                                </h3>

                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg border border-gray-600">
                                        <div>
                                            <p className="text-white font-bold">Enable Tokenization</p>
                                            <p className="text-gray-400 text-sm">Issue digital tokens to represent equity stakes</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={tokenForm.isTokenized}
                                                onChange={(e) => setTokenForm({ ...tokenForm, isTokenized: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>

                                    {tokenForm.isTokenized && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Token Name</label>
                                                <input
                                                    type="text"
                                                    value={tokenForm.tokenName}
                                                    onChange={(e) => setTokenForm({ ...tokenForm, tokenName: e.target.value })}
                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-blue-500 transition-colors"
                                                    placeholder="e.g. Van Equity Token"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Symbol</label>
                                                <input
                                                    type="text"
                                                    value={tokenForm.tokenSymbol}
                                                    onChange={(e) => setTokenForm({ ...tokenForm, tokenSymbol: e.target.value })}
                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-blue-500 transition-colors"
                                                    placeholder="e.g. VAN"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-gray-400 text-xs font-bold uppercase mb-2">Price per Token ($)</label>
                                                <input
                                                    type="number"
                                                    value={tokenForm.pricePerToken}
                                                    onChange={(e) => setTokenForm({ ...tokenForm, pricePerToken: e.target.value })}
                                                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-blue-500 transition-colors"
                                                    placeholder="1.00"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleUpdateTokenization}
                                            disabled={isUpdating}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isUpdating ? 'Updating...' : 'Save Configuration'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Members Section (Lead/Admin Only or Public Summary) */}
                        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Users className="w-5 h-5 text-blue-400" />
                                    Syndicate Members
                                </h3>
                                <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm">
                                    {syndicate.memberCount} Approved
                                </span>
                            </div>

                            {(isAdmin || isLead || user?.role === 'ADMIN') ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-700/50 text-gray-400 text-xs uppercase tracking-widest">
                                            <tr>
                                                <th className="px-6 py-4">Investor</th>
                                                <th className="px-6 py-4">Amount / Tokens</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4">Date</th>
                                                <th className="px-6 py-4">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-700">
                                            {syndicate.members.map((member) => (
                                                <tr key={member.id} className="hover:bg-gray-700/30 transition-colors text-sm">
                                                    <td className="px-6 py-4">
                                                        <p className="text-white font-medium">{member.investor.name}</p>
                                                        <p className="text-xs text-gray-500">{member.investor.type}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-white font-bold">${member.amount.toLocaleString()}</span>
                                                            {syndicate.isTokenized && member.tokens !== undefined && member.tokens !== null && (
                                                                <span className="text-xs bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800 whitespace-nowrap">
                                                                    {member.tokens.toLocaleString()} {syndicate.tokenSymbol || 'TOKENS'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${member.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                                                            member.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                                                                'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {member.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-400">
                                                        {new Date(member.joinedAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {member.status === 'PENDING' && (
                                                            <button
                                                                onClick={() => handleApproveMember(member.id)}
                                                                className="text-blue-400 hover:text-blue-300 font-bold transition-colors"
                                                            >
                                                                Approve
                                                            </button>
                                                        )}
                                                        {member.status === 'APPROVED' && (
                                                            <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-gray-500 italic">
                                    Detailed member list is only visible to the syndicate lead.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="space-y-8">
                        {/* Lead Investor Card */}
                        <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 rounded-xl p-6 border border-blue-700/30 shadow-xl">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Star className="w-5 h-5 text-amber-400" />
                                Lead Investor
                            </h3>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-bold text-2xl text-white shadow-lg">
                                    {syndicate.leadInvestor.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-white font-bold text-xl">{syndicate.leadInvestor.name}</p>
                                    <p className="text-blue-400 text-sm font-medium">{syndicate.leadInvestor.type}</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                                    <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                                        <ShieldCheck className="w-4 h-4 text-green-400" />
                                        KYC Verified
                                    </div>
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 text-gray-300 text-sm font-medium">
                                    Experience
                                    <span className="text-white">Senior Investor</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 text-gray-300 text-sm font-medium">
                                    Syndicates Led
                                    <span className="text-white">12</span>
                                </div>
                            </div>
                        </div>

                        {/* Linked Deal Card */}
                        {syndicate.deal && (
                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-white">Investment Target</h3>
                                    <ArrowUpRight className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="p-4 bg-gray-700/50 rounded-xl border border-gray-600 mb-4">
                                    <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Project</p>
                                    <p className="text-white font-bold text-lg">{syndicate.deal.title}</p>
                                    {syndicate.deal.sme && (
                                        <p className="text-gray-400 text-sm mt-1">by {syndicate.deal.sme.name}</p>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Target Raise</span>
                                        <span className="text-white font-bold">${(syndicate.deal.amount / 1000).toFixed(0)}K</span>
                                    </div>
                                    <Link
                                        href={`/deals/${syndicate.deal.id}`}
                                        className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-center rounded-xl text-white font-bold transition-colors block mt-4"
                                    >
                                        View Full Deal Room
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* Timeline */}
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-purple-400" />
                                Key Dates
                            </h3>
                            <div className="space-y-6 relative border-l-2 border-gray-700 ml-3 pl-6">
                                <div className="relative">
                                    <div className="absolute -left-[31px] top-1 w-4 h-4 bg-green-500 rounded-full border-4 border-gray-800"></div>
                                    <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">Formation</p>
                                    <p className="text-white font-medium">{new Date(syndicate.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div className="relative">
                                    <div className="absolute -left-[31px] top-1 w-4 h-4 bg-blue-500 rounded-full border-4 border-gray-800"></div>
                                    <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">Closing Date</p>
                                    <p className="text-white font-medium">{new Date(syndicate.closingDate).toLocaleDateString()}</p>
                                </div>
                                <div className="relative">
                                    <div className="absolute -left-[31px] top-1 w-4 h-4 bg-gray-700 rounded-full border-4 border-gray-800"></div>
                                    <p className="text-gray-400 text-xs uppercase font-bold tracking-widest">Execution</p>
                                    <p className="text-gray-500 italic">Estimated Portfolio Update</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Join / Top Up Modal */}
            {showJoinModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {isMember ? 'Top Up Investment' : 'Join Syndicate'}
                        </h3>
                        <p className="text-gray-400 mb-6">
                            {isMember
                                ? <span>You are adding to your existing investment in <strong className="text-white">{syndicate.name}</strong></span>
                                : <span>You are about to request to join <strong className="text-white">{syndicate.name}</strong></span>
                            }
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Investment Amount ($)</label>
                                <input
                                    type="number"
                                    value={joinAmount}
                                    onChange={(e) => setJoinAmount(e.target.value)}
                                    min={syndicate.minInvestment}
                                    max={syndicate.maxInvestment || undefined}
                                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Min: ${syndicate.minInvestment.toLocaleString()}
                                    {syndicate.maxInvestment && ` | Max: $${syndicate.maxInvestment.toLocaleString()}`}
                                </p>
                            </div>

                            {/* Token Calculation for Tokenized Syndicates */}
                            {syndicate.isTokenized && syndicate.pricePerToken && joinAmount && parseFloat(joinAmount) > 0 && (
                                <div className="bg-cyan-900/20 border border-cyan-700/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-cyan-400 mb-1">
                                                {isMember ? 'Additional Tokens' : 'You will receive'}
                                            </p>
                                            <p className="text-2xl font-bold text-white">
                                                {(parseFloat(joinAmount) / syndicate.pricePerToken).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                <span className="text-sm text-cyan-400 ml-2">{syndicate.tokenSymbol}</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Token Price</p>
                                            <p className="text-sm font-medium text-white">${syndicate.pricePerToken.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-gray-300">
                                        {isMember
                                            ? 'Additional funds will be registered immediately. Approval updates will align with your current status.'
                                            : 'Your request will be reviewed by the lead investor. You will be notified once approved.'
                                        }
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
                                    disabled={isJoining || parseFloat(joinAmount) < syndicate.minInvestment}
                                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isJoining ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-5 h-5" />
                                            {isMember ? 'Confirm Top Up' : 'Submit Request'}
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
