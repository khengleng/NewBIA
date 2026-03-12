'use client'

import { useState, useEffect } from 'react'
import {
    CheckCircle,
    XCircle,
    Clock,
    FileText,
    Building2,
    ShieldCheck,
    Eye,
    MessageSquare,
    ChevronRight,
    Search,
    AlertCircle
} from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { useToast } from '../../../contexts/ToastContext'
import { authorizedRequest } from '../../../lib/api'

interface CertificationRequest {
    id: string
    smeId: string
    sme: {
        name: string
        sector: string
        stage: string
    }
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    createdAt: string
}

export default function AdvisorCertificationsPage() {
    const { addToast } = useToast()
    const [requests, setRequests] = useState<CertificationRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')

    const fetchRequests = async () => {
        try {
            const response = await authorizedRequest('/api/advisory/certifications')
            if (response.ok) {
                const data = await response.json()
                setRequests(data.certifications || [])
            }
        } catch (error) {
            console.error('Error fetching certs:', error)
            addToast('error', 'Failed to load certification requests')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchRequests()
    }, [])

    const handleAction = async (id: string, action: 'APPROVED' | 'REJECTED') => {
        try {
            const response = await authorizedRequest(`/api/advisory/certifications/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: action })
            })

            if (response.ok) {
                addToast('success', `Request ${action.toLowerCase()} successfully`)
                fetchRequests()
            }
        } catch (error) {
            addToast('error', `Failed to ${action.toLowerCase()} request`)
        }
    }

    const filteredRequests = requests.filter(r =>
        r.sme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.sme.sector.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <DashboardLayout>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-indigo-400" />
                        Advisor Certification Queue
                    </h1>
                    <p className="text-gray-400 mt-2">Diligently verify SMEs and empower them for the marketplace</p>
                </div>
                <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                    <div className="px-4 py-2 text-sm text-gray-400 border-r border-gray-700">
                        <span className="text-white font-bold">{requests.filter(r => r.status === 'PENDING').length}</span> Pending
                    </div>
                    <div className="px-4 py-2 text-sm text-gray-400">
                        <span className="text-green-400 font-bold">{requests.filter(r => r.status === 'APPROVED').length}</span> Approved
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="mb-8 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Search by SME name or sector..."
                    className="w-full bg-gray-800 border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white focus:ring-indigo-500 focus:border-indigo-500 transition-all border"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    {Array(3).fill(0).map((_, i) => (
                        <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse"></div>
                    ))}
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="text-center py-20 bg-gray-800 rounded-2xl border border-gray-700">
                    <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg">No certification requests found.</p>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden divide-y divide-gray-700">
                    {filteredRequests.map((req) => (
                        <div key={req.id} className="p-6 flex flex-wrap items-center justify-between gap-6 hover:bg-gray-700/30 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-lg group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{req.sme.name}</h3>
                                    <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                                        <span>{req.sme.sector}</span>
                                        <span>•</span>
                                        <span>{req.sme.stage}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-8">
                                <div className="text-center">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Status</p>
                                    <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${req.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500' :
                                            req.status === 'APPROVED' ? 'bg-green-500/20 text-green-500' :
                                                'bg-red-500/20 text-red-500'
                                        }`}>
                                        {req.status === 'PENDING' ? <Clock className="w-3 h-3" /> :
                                            req.status === 'APPROVED' ? <CheckCircle className="w-3 h-3" /> :
                                                <XCircle className="w-3 h-3" />}
                                        {req.status}
                                    </span>
                                </div>

                                <div className="text-center">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Requested</p>
                                    <p className="text-sm text-white">{new Date(req.createdAt).toLocaleDateString()}</p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-all" title="View Documents">
                                        <FileText className="w-5 h-5" />
                                    </button>
                                    <button className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-all" title="Chat with Founder">
                                        <MessageSquare className="w-5 h-5" />
                                    </button>

                                    {req.status === 'PENDING' && (
                                        <>
                                            <div className="w-px h-8 bg-gray-700 mx-2"></div>
                                            <button
                                                onClick={() => handleAction(req.id, 'REJECTED')}
                                                className="px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg text-sm font-bold transition-all border border-red-500/50"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleAction(req.id, 'APPROVED')}
                                                className="px-4 py-2 bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white rounded-lg text-sm font-bold transition-all border border-green-500/50"
                                            >
                                                Approve
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-8 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6">
                <div className="flex gap-4">
                    <ShieldCheck className="w-8 h-8 text-indigo-400 shrink-0" />
                    <div>
                        <h4 className="text-white font-bold mb-2 text-lg uppercase tracking-tight">The Boutique Advisory Standard</h4>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Your certification is the bedrock of trust in this ecosystem. When you approve an SME, you are testifying to the validity of their
                            financials and business model. Approved SMEs get priority visibility for top-tier investors.
                        </p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
