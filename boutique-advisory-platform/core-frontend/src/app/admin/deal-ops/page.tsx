'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

interface Overview {
    activeDeals: number
    stalledDeals: number
    blockedByDisputes: number
    pendingWorkflows: number
    dueDiligenceDeals: number
    lowDocumentDeals: number
    avgDealAgeDays: number
}

interface AttentionDeal {
    dealId: string
    title: string
    status: string
    smeName: string
    updatedAt: string
    blockers: string[]
}

export default function DealOpsPage() {
    const { addToast } = useToast()
    const [overview, setOverview] = useState<Overview | null>(null)
    const [attention, setAttention] = useState<AttentionDeal[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const load = async () => {
        setIsLoading(true)
        try {
            const [overviewRes, attentionRes] = await Promise.all([
                authorizedRequest('/api/admin/deal-ops/overview'),
                authorizedRequest('/api/admin/deal-ops/attention?limit=100')
            ])

            if (overviewRes.ok) {
                const data = await overviewRes.json()
                setOverview(data.overview)
            }
            if (attentionRes.ok) {
                const data = await attentionRes.json()
                setAttention(data.attention || [])
            }
        } catch (error) {
            console.error('Deal ops load error:', error)
            addToast('error', 'Failed to load deal ops dashboard')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const blockerLabel: Record<string, string> = {
        STALLED_ACTIVITY: 'Stalled Activity',
        OPEN_DISPUTE: 'Open Dispute',
        PENDING_WORKFLOW: 'Pending Workflow',
        LOW_DOCUMENT_COVERAGE: 'Low Document Coverage'
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Deal Ops Console</h1>
                        <p className="text-gray-400 mt-1">Stalled deals, blockers, and intervention queue for admin operations.</p>
                    </div>
                    <button onClick={load} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                {overview && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Active Deals</p><p className="text-2xl font-bold text-white">{overview.activeDeals}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Stalled Deals</p><p className="text-2xl font-bold text-orange-300">{overview.stalledDeals}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Blocked by Disputes</p><p className="text-2xl font-bold text-red-300">{overview.blockedByDisputes}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Pending Workflows</p><p className="text-2xl font-bold text-blue-300">{overview.pendingWorkflows}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Due Diligence Deals</p><p className="text-2xl font-bold text-cyan-300">{overview.dueDiligenceDeals}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Low Document Coverage</p><p className="text-2xl font-bold text-yellow-300">{overview.lowDocumentDeals}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Avg Deal Age (days)</p><p className="text-2xl font-bold text-purple-300">{overview.avgDealAgeDays}</p></div>
                    </div>
                )}

                <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-700">
                        <h2 className="text-white font-semibold">Attention Queue</h2>
                    </div>
                    {isLoading ? (
                        <div className="p-6 text-gray-400">Loading deal blockers...</div>
                    ) : attention.length === 0 ? (
                        <div className="p-6 text-gray-400">No high-priority blockers found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-900/50 text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3">Deal</th>
                                        <th className="px-4 py-3">SME</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Updated</th>
                                        <th className="px-4 py-3">Blockers</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {attention.map((deal) => (
                                        <tr key={deal.dealId}>
                                            <td className="px-4 py-3 text-white">{deal.title}</td>
                                            <td className="px-4 py-3 text-gray-300">{deal.smeName}</td>
                                            <td className="px-4 py-3 text-gray-300">{deal.status}</td>
                                            <td className="px-4 py-3 text-gray-400">{new Date(deal.updatedAt).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {deal.blockers.map((blocker) => (
                                                        <span key={blocker} className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                                                            {blockerLabel[blocker] || blocker}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
