'use client'

import { useState, useEffect } from 'react'
import {
    Shield,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Users,
    DollarSign,
    Target,
    Building2,
    BarChart3,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    FileText,
    Award
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { authorizedRequest } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003'

interface DueDiligence {
    id: string
    smeId: string
    sme: {
        id: string
        name: string
        sector: string
    }
    advisor?: {
        id: string
        name: string
    }
    financialScore: number
    teamScore: number
    marketScore: number
    productScore: number
    legalScore: number
    operationalScore: number
    overallScore: number
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
    redFlags: string[]
    status: string
    completedAt: string | null
    expiresAt: string | null
    createdAt: string
}

interface DDStats {
    total: number
    completed: number
    pending: number
    inProgress: number
    averageScore: number
    riskDistribution: {
        LOW: number
        MEDIUM: number
        HIGH: number
        VERY_HIGH: number
    }
}

const ScoreBar = ({ score, label, color }: { score: number; label: string; color: string }) => (
    <div className="space-y-1">
        <div className="flex justify-between text-sm">
            <span className="text-gray-400">{label}</span>
            <span className="text-white font-medium">{score}/100</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
            <div
                className={`h-2 rounded-full transition-all ${color}`}
                style={{ width: `${score}%` }}
            />
        </div>
    </div>
)

const RiskBadge = ({ level }: { level: string }) => {
    const colors = {
        LOW: 'bg-green-500/20 text-green-400 border-green-500/30',
        MEDIUM: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        VERY_HIGH: 'bg-red-500/20 text-red-400 border-red-500/30'
    }

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors[level as keyof typeof colors] || colors.MEDIUM}`}>
            {level.replace('_', ' ')} RISK
        </span>
    )
}

const GradeCircle = ({ score }: { score: number }) => {
    const getGrade = (s: number) => {
        if (s >= 90) return { grade: 'A+', color: 'text-green-400' }
        if (s >= 85) return { grade: 'A', color: 'text-green-400' }
        if (s >= 80) return { grade: 'A-', color: 'text-green-500' }
        if (s >= 75) return { grade: 'B+', color: 'text-blue-400' }
        if (s >= 70) return { grade: 'B', color: 'text-blue-400' }
        if (s >= 65) return { grade: 'B-', color: 'text-blue-500' }
        if (s >= 60) return { grade: 'C+', color: 'text-amber-400' }
        if (s >= 55) return { grade: 'C', color: 'text-amber-400' }
        if (s >= 50) return { grade: 'C-', color: 'text-amber-500' }
        return { grade: 'D', color: 'text-red-400' }
    }

    const { grade, color } = getGrade(score)

    return (
        <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90">
                <circle cx="48" cy="48" r="40" strokeWidth="8" stroke="#374151" fill="none" />
                <circle
                    cx="48" cy="48" r="40" strokeWidth="8" fill="none"
                    className="transition-all"
                    stroke={score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'}
                    strokeDasharray={`${(score / 100) * 251.2} 251.2`}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl font-bold ${color}`}>{grade}</span>
                <span className="text-xs text-gray-400">{(score || 0).toFixed(0)}%</span>
            </div>
        </div>
    )
}

export default function DueDiligencePage() {
    const { addToast } = useToast()

    const [reports, setReports] = useState<DueDiligence[]>([])
    const [stats, setStats] = useState<DDStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [expandedReport, setExpandedReport] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'COMPLETED' | 'PENDING' | 'IN_PROGRESS'>('all')

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

            // Fetch due diligence reports
            const reportsRes = await authorizedRequest('/api/due-diligence')
            if (reportsRes.ok) {
                setReports(await reportsRes.json())
            }

            // Fetch stats
            const statsRes = await authorizedRequest('/api/due-diligence/stats/overview')
            if (statsRes.ok) {
                setStats(await statsRes.json())
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            addToast('error', 'Error loading due diligence reports')
        } finally {
            setIsLoading(false)
        }
    }

    const filteredReports = filter === 'all'
        ? reports
        : reports.filter(r => r.status === filter)

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
                        <Shield className="w-8 h-8 text-blue-400" />
                        Due Diligence Scores
                    </h1>
                    <p className="text-gray-400 mt-2">Comprehensive SME assessment and risk analysis</p>
                </div>
            </div>

            {/* Stats Overview */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                <FileText className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Total Reports</p>
                                <p className="text-xl font-bold text-white">{stats.total}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Completed</p>
                                <p className="text-xl font-bold text-white">{stats.completed}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                                <Clock className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">In Progress</p>
                                <p className="text-xl font-bold text-white">{stats.inProgress}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                <Award className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Avg Score</p>
                                <p className="text-xl font-bold text-white">{(stats.averageScore || 0).toFixed(1)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">High Risk</p>
                                <p className="text-xl font-bold text-white">
                                    {(stats.riskDistribution?.HIGH || 0) + (stats.riskDistribution?.VERY_HIGH || 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Risk Distribution Chart */}
            {stats && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-8">
                    <h3 className="text-lg font-semibold text-white mb-4">Risk Distribution</h3>
                    <div className="grid grid-cols-4 gap-4">
                        {stats.riskDistribution && Object.entries(stats.riskDistribution).map(([level, count]) => {
                            const colors = {
                                LOW: 'bg-green-500',
                                MEDIUM: 'bg-amber-500',
                                HIGH: 'bg-orange-500',
                                VERY_HIGH: 'bg-red-500'
                            }
                            const percentage = (stats.completed || 0) > 0 ? ((count || 0) / (stats.completed || 1) * 100) : 0

                            return (
                                <div key={level} className="text-center">
                                    <div className="h-24 bg-gray-700 rounded-lg relative overflow-hidden mb-2">
                                        <div
                                            className={`absolute bottom-0 left-0 right-0 ${colors[level as keyof typeof colors]} transition-all`}
                                            style={{ height: `${percentage}%` }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-2xl font-bold text-white">{count}</span>
                                        </div>
                                    </div>
                                    <span className="text-xs text-gray-400">{level.replace('_', ' ')}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex space-x-2 mb-6">
                {['all', 'COMPLETED', 'IN_PROGRESS', 'PENDING'].map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status as any)}
                        className={`px-4 py-2 rounded-lg transition-all ${filter === status
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {status === 'all' ? 'All' : status.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {/* Due Diligence Reports */}
            <div className="space-y-4">
                {filteredReports.map((report) => (
                    <div
                        key={report.id}
                        className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
                    >
                        {/* Report Header */}
                        <div
                            className="p-6 cursor-pointer hover:bg-gray-750 transition-colors"
                            onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <GradeCircle score={report.overallScore} />

                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-bold text-white">{report.sme?.name || 'Unknown SME'}</h3>
                                            <RiskBadge level={report.riskLevel} />
                                            <span className={`px-2 py-1 rounded text-xs ${report.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                                                report.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {report.status}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-4 text-sm text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <Building2 className="w-4 h-4" />
                                                {report.sme?.sector || 'Unknown'}
                                            </span>
                                            {report.advisor && (
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-4 h-4" />
                                                    Reviewed by {report.advisor.name}
                                                </span>
                                            )}
                                            {report.completedAt && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    {new Date(report.completedAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    {report.redFlags.length > 0 && (
                                        <div className="flex items-center gap-1 text-red-400">
                                            <AlertCircle className="w-5 h-5" />
                                            <span className="text-sm font-medium">{report.redFlags.length} red flags</span>
                                        </div>
                                    )}

                                    {expandedReport === report.id ? (
                                        <ChevronUp className="w-6 h-6 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="w-6 h-6 text-gray-400" />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedReport === report.id && (
                            <div className="px-6 pb-6 border-t border-gray-700 pt-6">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Score Breakdown */}
                                    <div className="lg:col-span-2 space-y-4">
                                        <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Score Breakdown</h4>
                                        <div className="space-y-3">
                                            <ScoreBar score={report.financialScore} label="Financial Health" color="bg-green-500" />
                                            <ScoreBar score={report.teamScore} label="Team & Leadership" color="bg-blue-500" />
                                            <ScoreBar score={report.marketScore} label="Market Opportunity" color="bg-purple-500" />
                                            <ScoreBar score={report.productScore} label="Product/Service" color="bg-amber-500" />
                                            <ScoreBar score={report.legalScore} label="Legal & Compliance" color="bg-cyan-500" />
                                            <ScoreBar score={report.operationalScore} label="Operations" color="bg-pink-500" />
                                        </div>
                                    </div>

                                    {/* Assessments */}
                                    <div className="space-y-4">
                                        {/* Strengths */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Strengths
                                            </h4>
                                            <ul className="space-y-1">
                                                {report.strengths.map((s, i) => (
                                                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                                        <span className="text-green-400 mt-1">•</span>
                                                        {s}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Weaknesses */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4" />
                                                Weaknesses
                                            </h4>
                                            <ul className="space-y-1">
                                                {report.weaknesses.map((w, i) => (
                                                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                                                        <span className="text-amber-400 mt-1">•</span>
                                                        {w}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Red Flags */}
                                        {report.redFlags.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                                                    <AlertTriangle className="w-4 h-4" />
                                                    Red Flags
                                                </h4>
                                                <ul className="space-y-1">
                                                    {report.redFlags.map((r, i) => (
                                                        <li key={i} className="text-sm text-red-300 flex items-start gap-2">
                                                            <span className="text-red-400 mt-1">•</span>
                                                            {r}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Recommendations */}
                                {report.recommendations.length > 0 && (
                                    <div className="mt-6 pt-6 border-t border-gray-700">
                                        <h4 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                                            <Target className="w-4 h-4" />
                                            Recommendations
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {report.recommendations.map((r, i) => (
                                                <div key={i} className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                                    <p className="text-sm text-blue-300">{r}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {filteredReports.length === 0 && (
                <div className="text-center py-16">
                    <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No due diligence reports found</p>
                    <p className="text-gray-500 text-sm mt-2">Reports will appear here once SMEs are assessed</p>
                </div>
            )}
        </DashboardLayout>
    )
}
