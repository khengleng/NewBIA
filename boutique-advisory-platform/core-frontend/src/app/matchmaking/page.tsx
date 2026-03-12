'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    Sparkles,
    Users,
    Building2,
    Heart,
    HeartHandshake,
    TrendingUp,
    Filter,
    Search,
    Eye,
    MessageSquare,
    CheckCircle,
    XCircle,
    Clock,
    BarChart3,
    ArrowRight,
    Star,
    Target
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { API_URL, authorizedRequest } from '@/lib/api'

interface Match {
    id: string
    investor: {
        id: string
        userId: string
        name: string
        type: string
    }
    sme: {
        id: string
        userId: string
        name: string
        sector: string
        stage: string
    }
    score: number
    factors: any
    interests: { userId: string; interest: boolean }[]
}

interface MatchStats {
    totalPossibleMatches: number
    highScoreMatches: number
    mediumScoreMatches: number
    mutualInterests: number
}

interface User {
    id: string
    role: string
    firstName: string
    lastName: string
}

export default function MatchmakingPage() {
    const { addToast } = useToast()
    const [user, setUser] = useState<User | null>(null)
    const [matches, setMatches] = useState<Match[]>([])
    const [stats, setStats] = useState<MatchStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isRecomputing, setIsRecomputing] = useState(false)
    const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'mutual'>('all')
    const [searchQuery, setSearchQuery] = useState('')

    const fetchData = async () => {
        try {
            const userData = localStorage.getItem('user')

            if (!userData) {
                window.location.href = '/auth/login'
                return
            }

            setUser(JSON.parse(userData))

            const response = await authorizedRequest('/api/matches')

            if (response.ok) {
                const data = await response.json()
                setMatches(data.matches || [])
                setStats(data.stats || null)
            } else {
                addToast('error', 'Failed to fetch matches')
            }
        } catch (error) {
            console.error('Error fetching matches:', error)
            addToast('error', 'Error loading matchmaking data')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [addToast])

    const handleRecompute = async () => {
        setIsRecomputing(true)
        try {
            const response = await authorizedRequest('/api/matches/recompute', {
                method: 'POST'
            })
            if (response.ok) {
                addToast('success', 'Matches recomputed successfully!')
                fetchData()
            }
        } catch (error) {
            addToast('error', 'Failed to recompute matches')
        } finally {
            setIsRecomputing(false)
        }
    }

    const handleInterest = async (matchId: string, interest: boolean) => {
        try {
            const response = await authorizedRequest(`/api/matches/${matchId}/interest`, {
                method: 'POST',
                body: JSON.stringify({ interest })
            })

            if (response.ok) {
                addToast('success', interest ? 'Liked!' : 'Dismissed')
                fetchData()
            }
        } catch (error) {
            addToast('error', 'Failed to record interest')
        }
    }

    const checkMutualInterest = (m: Match) => {
        if (!m.investor || !m.sme || !m.interests) return false
        const investorLiked = m.interests.some(i => i.interest === true && i.userId === m.investor.userId)
        const smeLiked = m.interests.some(i => i.interest === true && i.userId === m.sme.userId)
        return investorLiked && smeLiked
    }

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400'
        if (score >= 50) return 'text-yellow-400'
        return 'text-red-400'
    }

    const getScoreBgColor = (score: number) => {
        if (score >= 80) return 'bg-green-500/20'
        if (score >= 50) return 'bg-yellow-500/20'
        return 'bg-red-500/20'
    }

    const filteredMatches = (matches || []).filter(match => {
        if (filter === 'high' && match.score < 80) return false
        if (filter === 'medium' && (match.score < 50 || match.score >= 80)) return false
        if (filter === 'mutual' && !checkMutualInterest(match)) return false

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            return (
                (match.investor?.name?.toLowerCase() || '').includes(query) ||
                (match.sme?.name?.toLowerCase() || '').includes(query) ||
                (match.sme?.sector?.toLowerCase() || '').includes(query)
            )
        }
        return true
    })

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
                        <Sparkles className="w-8 h-8 text-purple-400" />
                        Refined Matchmaking
                    </h1>
                    <p className="text-gray-400 mt-2">Persistence-backed scientific scoring for perfect SME-Investor alignment</p>
                </div>
                {(user?.role === 'ADMIN' || user?.role === 'ADVISOR') && (
                    <button
                        onClick={handleRecompute}
                        disabled={isRecomputing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center transition-all disabled:opacity-50"
                    >
                        {isRecomputing ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        ) : (
                            <TrendingUp className="w-4 h-4 mr-2" />
                        )}
                        Recompute All Matches
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                        <p className="text-gray-400 text-sm">Total Opps</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.totalPossibleMatches}</p>
                    </div>
                    <div className="bg-green-500/10 rounded-xl p-6 border border-green-500/20">
                        <p className="text-green-400 text-sm">High Match (80%+)</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.highScoreMatches}</p>
                    </div>
                    <div className="bg-pink-500/10 rounded-xl p-6 border border-pink-500/20">
                        <p className="text-pink-400 text-sm">Mutual Interests</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.mutualInterests}</p>
                    </div>
                    <div className="bg-blue-500/10 rounded-xl p-6 border border-blue-500/20">
                        <p className="text-blue-400 text-sm">Medium Match</p>
                        <p className="text-3xl font-bold text-white mt-1">{stats.mediumScoreMatches}</p>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="bg-gray-800 rounded-xl p-4 mb-8 border border-gray-700 flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[300px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search sectors, companies..."
                        className="w-full bg-gray-700 border-none rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-purple-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex bg-gray-700 p-1 rounded-lg">
                    {['all', 'high', 'mutual'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === f ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Matches Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredMatches.map((match) => {
                    const isMutual = checkMutualInterest(match)
                    const userInterest = match.interests?.find(i => i.userId === user?.id)

                    return (
                        <div key={match.id} className={`bg-gray-800 rounded-2xl border transition-all hover:translate-y-[-4px] overflow-hidden ${isMutual ? 'border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.1)]' : 'border-gray-700'}`}>
                            {/* Score Header */}
                            <div className={`px-6 py-4 flex justify-between items-center ${getScoreBgColor(match.score)}`}>
                                <div className="flex items-center gap-2">
                                    <Star className={`w-4 h-4 ${getScoreColor(match.score)} fill-current`} />
                                    <span className={`font-bold ${getScoreColor(match.score)}`}>{match.score}% Score</span>
                                </div>
                                {isMutual && <span className="bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Mutual Interest</span>}
                            </div>

                            <div className="p-6">
                                {/* Connection Line */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{match.investor?.name}</p>
                                            <p className="text-gray-400 text-xs">{match.investor?.type}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-center h-4 relative">
                                        <div className="w-0.5 bg-gradient-to-b from-blue-500 to-green-500 absolute h-full top-0"></div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center text-green-400">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-white font-bold">{match.sme?.name}</p>
                                            <p className="text-gray-400 text-xs">{match.sme?.sector} • {match.sme?.stage}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Factor Breakdown */}
                                <div className="mt-6 pt-6 border-t border-gray-700/50">
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(match.factors || {}).map(([key, val]: [string, any]) => (
                                            <div key={key} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${val.score > 0 ? 'bg-green-500/10 text-green-400' : 'bg-gray-700 text-gray-500'}`} title={val.details}>
                                                {val.score > 0 ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                {key.charAt(0).toUpperCase() + key.slice(1)}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Interest Actions */}
                                <div className="mt-6 flex gap-3">
                                    {userInterest ? (
                                        <div className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border ${userInterest.interest ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-gray-700 border-gray-600 text-gray-400'}`}>
                                            {userInterest.interest ? <Heart className="w-4 h-4 fill-current" /> : <XCircle className="w-4 h-4" />}
                                            {userInterest.interest ? 'Liked' : 'Dismissed'}
                                        </div>
                                    ) : (
                                        <>
                                            <button onClick={() => handleInterest(match.id, false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2.5 rounded-xl transition-all flex items-center justify-center">
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => handleInterest(match.id, true)} className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-xl transition-all shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2 font-bold">
                                                <Heart className="w-4 h-4" />
                                                Interested
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Detail Links */}
                                <div className="mt-4 flex gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                    <Link href={`/smes/${match.sme?.id}`} className="hover:text-blue-400">View Proposal</Link>
                                    <span>•</span>
                                    <Link href={`/investors/${match.investor?.id}`} className="hover:text-blue-400">View Thesis</Link>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {filteredMatches.length === 0 && (
                <div className="text-center py-12">
                    <Sparkles className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No matches found for the selected filter.</p>
                    <p className="text-gray-500 text-sm mt-2">Try adjusting your search or filter criteria.</p>
                </div>
            )}
        </DashboardLayout>
    )
}
