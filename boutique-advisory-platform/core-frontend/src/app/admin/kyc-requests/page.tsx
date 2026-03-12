'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Search, Filter } from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { toast } from 'react-hot-toast'

interface KYCRequest {
    id: string;
    kycStatus: string;
    user: {
        firstName: string;
        lastName: string;
        email: string;
    }
}

export default function KYCRequestsPage() {
    const [requests, setRequests] = useState<KYCRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    const fetchRequests = async () => {
        try {
            const response = await authorizedRequest('/api/admin/action-center/kyc-requests')
            if (response.ok) {
                const data = await response.json()
                setRequests(data)
            }
        } catch (error) {
            console.error('Error fetching KYC requests:', error)
            toast.error('Failed to load requests')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchRequests()
    }, [])

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        try {
            // Optimistic update
            setRequests(prev => prev.filter(r => r.id !== id));

            const endpoint = `/api/admin/action-center/kyc/${id}/${action}`;
            // If rejecting, we could prompt for a reason, but for MVP we send default/empty
            const body = action === 'reject' ? { reason: 'Profile incomplete or verification failed.' } : {};

            const response = await authorizedRequest(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                toast.success(`KYC request ${action}d successfully`);
            } else {
                // Revert on failure (simple refetch for now)
                fetchRequests();
                toast.error(`Failed to ${action} request`);
            }
        } catch (error) {
            console.error(`Error ${action}ing request:`, error);
            fetchRequests();
            toast.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    const filteredRequests = requests.filter(req =>
        req.user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.user.email.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-white">KYC Requests</h1>
                        <p className="text-gray-400 mt-2">Manage pending investor verifications.</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search users..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-800 border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                        </div>
                        <button className="bg-gray-800 p-2 rounded-lg border border-gray-700 hover:bg-gray-700 text-gray-400">
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="text-center py-12 bg-gray-800/50 rounded-2xl border border-gray-700 border-dashed">
                        <p className="text-gray-400">No pending KYC requests found.</p>
                    </div>
                ) : (
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase font-medium">
                                <tr>
                                    <th className="px-6 py-4 text-left">User</th>
                                    <th className="px-6 py-4 text-left">Email</th>
                                    <th className="px-6 py-4 text-left">Request Date (Placeholder)</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {filteredRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="text-white font-medium">{req.user.firstName} {req.user.lastName}</div>
                                            <div className="text-xs text-gray-500">ID: {req.id.substring(0, 8)}...</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-300">{req.user.email}</td>
                                        <td className="px-6 py-4 text-gray-400 text-sm">Just now</td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleAction(req.id, 'approve')}
                                                    className="flex items-center gap-1 bg-green-500/10 text-green-400 px-3 py-1.5 rounded-lg border border-green-500/20 hover:bg-green-500 hover:text-white transition-all text-xs font-bold"
                                                >
                                                    <CheckCircle className="w-3 h-3" />
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleAction(req.id, 'reject')}
                                                    className="flex items-center gap-1 bg-red-500/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-xs font-bold"
                                                >
                                                    <XCircle className="w-3 h-3" />
                                                    Reject
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
