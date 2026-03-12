'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Search, MessageSquare } from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { toast } from 'react-hot-toast'

interface Dispute {
    id: string;
    reason: string;
    description: string;
    status: string;
    createdAt: string;
    initiator: {
        firstName: string;
        lastName: string;
        email: string;
    };
    deal: {
        title: string;
    },
    resolver?: {
        firstName: string;
        lastName: string;
        email: string;
    };
    resolution?: string;
}

export default function DisputesPage() {
    const [disputes, setDisputes] = useState<Dispute[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED'>('ALL')
    const [resolvingId, setResolvingId] = useState<string | null>(null)
    const [resolutionText, setResolutionText] = useState('')
    const [rejectingId, setRejectingId] = useState<string | null>(null)
    const [rejectionText, setRejectionText] = useState('')

    const fetchDisputes = async () => {
        try {
            const query = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`
            const response = await authorizedRequest(`/api/admin/action-center/disputes${query}`)
            if (response.ok) {
                const data = await response.json()
                setDisputes(data)
            }
        } catch (error) {
            console.error('Error fetching disputes:', error)
            toast.error('Failed to load disputes')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchDisputes()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter])

    const handleStartMediation = async (id: string) => {
        try {
            const response = await authorizedRequest(`/api/admin/action-center/disputes/${id}/start-mediation`, {
                method: 'POST'
            })

            if (response.ok) {
                toast.success('Mediation started')
                setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: 'IN_PROGRESS' } : d))
            } else {
                toast.error('Failed to start mediation')
            }
        } catch (error) {
            console.error('Error starting mediation:', error)
            toast.error('Error starting mediation')
        }
    }

    const handleResolve = async (id: string) => {
        if (!resolutionText.trim()) {
            toast.error('Please provide a resolution description')
            return
        }

        try {
            const response = await authorizedRequest(`/api/admin/action-center/disputes/${id}/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolution: resolutionText })
            });

            if (response.ok) {
                toast.success('Dispute resolved')
                setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: 'RESOLVED', resolution: resolutionText } : d))
                setResolvingId(null)
                setResolutionText('')
            } else {
                toast.error('Failed to resolve dispute')
            }
        } catch (error) {
            console.error('Error resolving dispute:', error)
            toast.error('Error: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
    }

    const handleReject = async (id: string) => {
        if (!rejectionText.trim() || rejectionText.trim().length < 10) {
            toast.error('Please provide at least 10 characters for rejection reason')
            return
        }

        try {
            const response = await authorizedRequest(`/api/admin/action-center/disputes/${id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: rejectionText })
            })

            if (response.ok) {
                toast.success('Dispute rejected')
                setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: 'REJECTED', resolution: rejectionText } : d))
                setRejectingId(null)
                setRejectionText('')
            } else {
                const data = await response.json()
                toast.error(data.error || 'Failed to reject dispute')
            }
        } catch (error) {
            console.error('Error rejecting dispute:', error)
            toast.error('Failed to reject dispute')
        }
    }

    const handleReopen = async (id: string) => {
        try {
            const response = await authorizedRequest(`/api/admin/action-center/disputes/${id}/reopen`, {
                method: 'POST'
            })

            if (response.ok) {
                toast.success('Dispute reopened')
                setDisputes(prev => prev.map(d => d.id === id ? { ...d, status: 'IN_PROGRESS' } : d))
            } else {
                const data = await response.json()
                toast.error(data.error || 'Failed to reopen dispute')
            }
        } catch (error) {
            console.error('Error reopening dispute:', error)
            toast.error('Failed to reopen dispute')
        }
    }

    const filteredDisputes = disputes.filter(d =>
        d.deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.initiator.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.reason.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Deal Disputes</h1>
                        <p className="text-gray-400 mt-2">Mediate and resolve conflicts between parties.</p>
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search disputes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-gray-800 border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${statusFilter === status
                                ? 'bg-blue-600 text-white border-blue-500'
                                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                                }`}
                        >
                            {status === 'ALL' ? 'All' : status.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : filteredDisputes.length === 0 ? (
                    <div className="text-center py-12 bg-gray-800/50 rounded-2xl border border-gray-700 border-dashed">
                        <p className="text-gray-400">No active disputes found.</p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {filteredDisputes.map((dispute) => (
                            <div key={dispute.id} className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden shadow-lg">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter mb-2 inline-block ${dispute.status === 'OPEN' ? 'text-red-400 bg-red-400/10' :
                                                    dispute.status === 'IN_PROGRESS' ? 'text-orange-400 bg-orange-400/10' :
                                                        dispute.status === 'RESOLVED' ? 'text-green-400 bg-green-400/10' :
                                                            'text-gray-400 bg-gray-400/10'
                                                }`}>
                                                {dispute.status.replace('_', ' ')}
                                            </span>
                                            <h3 className="text-xl font-bold text-white">{dispute.deal.title}</h3>
                                            <p className="text-gray-400 text-sm mt-1">
                                                Initiated by: {dispute.initiator.firstName} {dispute.initiator.lastName} ({dispute.initiator.email})
                                            </p>
                                            {dispute.resolver && (
                                                <p className="text-gray-500 text-xs mt-1">
                                                    Assigned: {dispute.resolver.firstName} {dispute.resolver.lastName}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right text-xs text-gray-500">
                                            {new Date(dispute.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 mb-6">
                                        <p className="text-white font-bold mb-1 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4 text-orange-400" />
                                            Reason: {dispute.reason}
                                        </p>
                                        <p className="text-gray-400 text-sm whitespace-pre-wrap">{dispute.description}</p>
                                    </div>

                                    {dispute.resolution && (
                                        <div className="bg-green-600/10 p-4 rounded-xl border border-green-600/20 mb-6">
                                            <p className="text-green-400 font-bold mb-1 flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4" />
                                                Resolution
                                            </p>
                                            <p className="text-gray-300 text-sm whitespace-pre-wrap">{dispute.resolution}</p>
                                        </div>
                                    )}

                                    {resolvingId === dispute.id ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                            <textarea
                                                placeholder="Describe the resolution..."
                                                value={resolutionText}
                                                onChange={(e) => setResolutionText(e.target.value)}
                                                className="w-full bg-gray-900 border border-blue-500/50 rounded-xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none h-32"
                                            />
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    onClick={() => { setResolvingId(null); setResolutionText(''); }}
                                                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleResolve(dispute.id)}
                                                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Submit Resolution
                                                </button>
                                            </div>
                                        </div>
                                    ) : rejectingId === dispute.id ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                            <textarea
                                                placeholder="Describe why this dispute is rejected..."
                                                value={rejectionText}
                                                onChange={(e) => setRejectionText(e.target.value)}
                                                className="w-full bg-gray-900 border border-red-500/50 rounded-xl p-4 text-white focus:ring-2 focus:ring-red-500 outline-none h-32"
                                            />
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    onClick={() => { setRejectingId(null); setRejectionText('') }}
                                                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleReject(dispute.id)}
                                                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2 rounded-xl transition-all flex items-center gap-2"
                                                >
                                                    Reject Dispute
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end gap-3">
                                            {dispute.status === 'OPEN' && (
                                                <button
                                                    onClick={() => handleStartMediation(dispute.id)}
                                                    className="bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 font-bold px-6 py-2 rounded-xl border border-orange-600/30 transition-all flex items-center gap-2"
                                                >
                                                    Start Mediation
                                                </button>
                                            )}
                                            {dispute.status !== 'RESOLVED' && dispute.status !== 'REJECTED' && (
                                                <>
                                                    <button
                                                        onClick={() => setRejectingId(dispute.id)}
                                                        className="bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold px-6 py-2 rounded-xl border border-red-600/30 transition-all"
                                                    >
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={() => setResolvingId(dispute.id)}
                                                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2"
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                        {dispute.status === 'IN_PROGRESS' ? 'Resolve Now' : 'Resolve Early'}
                                                    </button>
                                                </>
                                            )}
                                            {(dispute.status === 'RESOLVED' || dispute.status === 'REJECTED') && (
                                                <button
                                                    onClick={() => handleReopen(dispute.id)}
                                                    className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
                                                >
                                                    Reopen
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
