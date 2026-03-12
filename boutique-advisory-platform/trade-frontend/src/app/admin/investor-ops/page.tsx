'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

interface InvestorOpsOverview {
    totalInvestors: number
    activeInvestors: number
    pendingKyc: number
    underReviewKyc: number
    suspendedInvestors: number
    staleInvestors: number
    approvedCommitments: number
    committedCapital: number
}

interface InvestorOpsRow {
    id: string
    name: string
    type: string
    status: string
    kycStatus: string
    user: {
        firstName: string
        lastName: string
        email: string
        status: string
        lastLoginAt: string | null
    }
    totalInvestments: number
    approvedInvestments: number
    approvedAmount: number
    lastInvestmentAt: string | null
    updatedAt: string
}

const kycStatuses = ['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED']
const investorStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED']

export default function InvestorOpsPage() {
    const { addToast } = useToast()
    const [overview, setOverview] = useState<InvestorOpsOverview | null>(null)
    const [investors, setInvestors] = useState<InvestorOpsRow[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const load = async () => {
        setIsLoading(true)
        try {
            const [overviewRes, investorsRes] = await Promise.all([
                authorizedRequest('/api/admin/investor-ops/overview'),
                authorizedRequest('/api/admin/investor-ops/investors')
            ])

            if (overviewRes.ok) {
                const data = await overviewRes.json()
                setOverview(data.overview)
            }

            if (investorsRes.ok) {
                const data = await investorsRes.json()
                setInvestors(data.investors || [])
            }
        } catch (error) {
            addToast('error', 'Failed to load investor ops data')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const updateKyc = async (id: string, status: string) => {
        try {
            const response = await authorizedRequest(`/api/admin/investor-ops/investors/${id}/kyc-review`, {
                method: 'POST',
                body: JSON.stringify({ status })
            })

            if (!response.ok) {
                addToast('error', 'Unable to update KYC status')
                return
            }

            addToast('success', 'KYC status updated')
            load()
        } catch (error) {
            addToast('error', 'Unable to update KYC status')
        }
    }

    const updateInvestorStatus = async (id: string, status: string) => {
        try {
            const response = await authorizedRequest(`/api/admin/investor-ops/investors/${id}/status`, {
                method: 'POST',
                body: JSON.stringify({ status })
            })

            if (!response.ok) {
                addToast('error', 'Unable to update investor status')
                return
            }

            addToast('success', 'Investor status updated')
            load()
        } catch (error) {
            addToast('error', 'Unable to update investor status')
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Investor Ops Hub</h1>
                        <p className="text-gray-400 mt-1">KYC throughput, investor health, and portfolio activation controls.</p>
                    </div>
                    <button onClick={load} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                {overview && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Total Investors</p><p className="text-2xl font-bold text-white">{overview.totalInvestors}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Active Investors</p><p className="text-2xl font-bold text-emerald-300">{overview.activeInvestors}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Pending KYC</p><p className="text-2xl font-bold text-yellow-300">{overview.pendingKyc}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">KYC Under Review</p><p className="text-2xl font-bold text-blue-300">{overview.underReviewKyc}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Suspended Investors</p><p className="text-2xl font-bold text-red-300">{overview.suspendedInvestors}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Stale Investors</p><p className="text-2xl font-bold text-orange-300">{overview.staleInvestors}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Approved Commitments</p><p className="text-2xl font-bold text-cyan-300">{overview.approvedCommitments}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Committed Capital</p><p className="text-2xl font-bold text-purple-300">${overview.committedCapital.toLocaleString()}</p></div>
                    </div>
                )}

                <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-700">
                        <h2 className="text-white font-semibold">Investor Operations Queue</h2>
                    </div>
                    {isLoading ? (
                        <div className="p-6 text-gray-400">Loading investor operations...</div>
                    ) : investors.length === 0 ? (
                        <div className="p-6 text-gray-400">No investors found in scope.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-900/50 text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3">Investor</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">KYC</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Approved Amount</th>
                                        <th className="px-4 py-3">Last Investment</th>
                                        <th className="px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {investors.map((investor) => (
                                        <tr key={investor.id}>
                                            <td className="px-4 py-3">
                                                <p className="text-white font-medium">{investor.name}</p>
                                                <p className="text-xs text-gray-400">{investor.user?.email || 'No email'}</p>
                                            </td>
                                            <td className="px-4 py-3 text-gray-300">{investor.type}</td>
                                            <td className="px-4 py-3 text-gray-300">{investor.kycStatus}</td>
                                            <td className="px-4 py-3 text-gray-300">{investor.status}</td>
                                            <td className="px-4 py-3 text-gray-300">${investor.approvedAmount.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-gray-400">{investor.lastInvestmentAt ? new Date(investor.lastInvestmentAt).toLocaleDateString() : 'No investments'}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-2 min-w-[190px]">
                                                    <select
                                                        value={investor.kycStatus}
                                                        onChange={(event) => updateKyc(investor.id, event.target.value)}
                                                        className="px-2 py-1 rounded bg-gray-900 border border-gray-700 text-white"
                                                    >
                                                        {kycStatuses.map((status) => (
                                                            <option key={status} value={status}>{status}</option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        value={investor.status}
                                                        onChange={(event) => updateInvestorStatus(investor.id, event.target.value)}
                                                        className="px-2 py-1 rounded bg-gray-900 border border-gray-700 text-white"
                                                    >
                                                        {investorStatuses.map((status) => (
                                                            <option key={status} value={status}>{status}</option>
                                                        ))}
                                                    </select>
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
