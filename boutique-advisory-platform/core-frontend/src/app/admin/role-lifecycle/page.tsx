'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

interface RoleRequest {
    id: string
    currentRole: string
    requestedRole: string
    reason: string
    status: string
    reviewNote?: string | null
    createdAt: string
    requester: { id: string; firstName: string; lastName: string; email: string; role: string }
}

interface RoleGrant {
    id: string
    role: string
    status: string
    reason?: string | null
    expiresAt: string
    user: { id: string; firstName: string; lastName: string; email: string; role: string }
}

interface UserRecord {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
    status: string
}

export default function RoleLifecyclePage() {
    const { addToast } = useToast()
    const [requests, setRequests] = useState<RoleRequest[]>([])
    const [grants, setGrants] = useState<RoleGrant[]>([])
    const [users, setUsers] = useState<UserRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const [grantForm, setGrantForm] = useState({
        userId: '',
        role: 'SUPPORT',
        reason: '',
        expiresAt: ''
    })

    const load = async () => {
        setIsLoading(true)
        try {
            const [requestRes, grantRes, userRes] = await Promise.all([
                authorizedRequest('/api/admin/role-lifecycle/requests'),
                authorizedRequest('/api/admin/role-lifecycle/grants'),
                authorizedRequest('/api/admin/users')
            ])
            if (requestRes.ok) {
                const data = await requestRes.json()
                setRequests(data.requests || [])
            }
            if (grantRes.ok) {
                const data = await grantRes.json()
                setGrants(data.grants || [])
            }
            if (userRes.ok) {
                const data = await userRes.json()
                setUsers((data.users || []).filter((user: UserRecord) => user.status === 'ACTIVE'))
            }
        } catch (error) {
            console.error('Load role lifecycle data error:', error)
            addToast('error', 'Failed to load role lifecycle data')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const reviewRequest = async (id: string, action: 'approve' | 'reject') => {
        const note = window.prompt(action === 'approve' ? 'Approval note (optional)' : 'Rejection reason (required)')
        if (action === 'reject' && (!note || note.trim().length < 5)) {
            addToast('error', 'Rejection note must be at least 5 characters')
            return
        }
        try {
            const res = await authorizedRequest(`/api/admin/role-lifecycle/requests/${id}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reviewNote: note || '' })
            })
            const data = await res.json()
            if (!res.ok) return addToast('error', data.error || `Failed to ${action} request`)
            addToast('success', `Request ${action}d`)
            await load()
        } catch (error) {
            console.error(`Failed to ${action} request`, error)
            addToast('error', `Failed to ${action} request`)
        }
    }

    const createGrant = async () => {
        if (!grantForm.userId || !grantForm.role || !grantForm.expiresAt) {
            addToast('error', 'user, role, and expiration are required')
            return
        }
        try {
            const res = await authorizedRequest('/api/admin/role-lifecycle/grants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(grantForm)
            })
            const data = await res.json()
            if (!res.ok) return addToast('error', data.error || 'Failed to create grant')
            addToast('success', 'Temporary grant created')
            setGrantForm({ userId: '', role: 'SUPPORT', reason: '', expiresAt: '' })
            await load()
        } catch (error) {
            console.error('Create grant error:', error)
            addToast('error', 'Failed to create grant')
        }
    }

    const revokeGrant = async (id: string) => {
        const revokeReason = window.prompt('Revoke reason (optional)') || ''
        try {
            const res = await authorizedRequest(`/api/admin/role-lifecycle/grants/${id}/revoke`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ revokeReason })
            })
            const data = await res.json()
            if (!res.ok) return addToast('error', data.error || 'Failed to revoke grant')
            addToast('success', 'Grant revoked')
            await load()
        } catch (error) {
            console.error('Revoke grant error:', error)
            addToast('error', 'Failed to revoke grant')
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Role Lifecycle Controls</h1>
                        <p className="text-gray-400 mt-1">Approve role requests and manage temporary privilege grants.</p>
                    </div>
                    <button onClick={load} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                        <h2 className="text-white font-semibold">Pending Role Requests</h2>
                        {isLoading ? (
                            <p className="text-gray-400 text-sm">Loading requests...</p>
                        ) : requests.length === 0 ? (
                            <p className="text-gray-400 text-sm">No role requests.</p>
                        ) : requests.map((request) => (
                            <div key={request.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <p className="text-white text-sm font-medium">
                                            {request.requester.firstName} {request.requester.lastName} ({request.requester.email})
                                        </p>
                                        <p className="text-xs text-gray-400">{request.currentRole} → {request.requestedRole}</p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${request.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-gray-700 text-gray-300'}`}>
                                        {request.status}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-300">{request.reason}</p>
                                {request.status === 'PENDING' && (
                                    <div className="flex gap-2">
                                        <button onClick={() => reviewRequest(request.id, 'approve')} className="text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white">Approve</button>
                                        <button onClick={() => reviewRequest(request.id, 'reject')} className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white">Reject</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                        <h2 className="text-white font-semibold">Temporary Privilege Grants</h2>
                        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
                            <p className="text-sm text-gray-300 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Create Grant</p>
                            <select
                                value={grantForm.userId}
                                onChange={(e) => setGrantForm((prev) => ({ ...prev, userId: e.target.value }))}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                            >
                                <option value="">Select user</option>
                                {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.firstName} {user.lastName} ({user.email})
                                    </option>
                                ))}
                            </select>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={grantForm.role}
                                    onChange={(e) => setGrantForm((prev) => ({ ...prev, role: e.target.value }))}
                                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                                >
                                    {['SUPPORT', 'ADVISOR', 'INVESTOR', 'SME', 'ADMIN', 'SUPER_ADMIN'].map((role) => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                                <input
                                    type="datetime-local"
                                    value={grantForm.expiresAt}
                                    onChange={(e) => setGrantForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                                />
                            </div>
                            <input
                                value={grantForm.reason}
                                onChange={(e) => setGrantForm((prev) => ({ ...prev, reason: e.target.value }))}
                                placeholder="Reason (optional)"
                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                            />
                            <button onClick={createGrant} className="text-xs px-2 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white">Create Temporary Grant</button>
                        </div>

                        {isLoading ? (
                            <p className="text-gray-400 text-sm">Loading grants...</p>
                        ) : grants.length === 0 ? (
                            <p className="text-gray-400 text-sm">No grants found.</p>
                        ) : grants.map((grant) => (
                            <div key={grant.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <p className="text-sm text-white font-medium">
                                            {grant.user.firstName} {grant.user.lastName} ({grant.user.email})
                                        </p>
                                        <p className="text-xs text-gray-400">Grant role: {grant.role}</p>
                                        <p className="text-xs text-gray-500">Expires: {new Date(grant.expiresAt).toLocaleString()}</p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${grant.status === 'ACTIVE' ? 'bg-green-500/20 text-green-300' : 'bg-gray-700 text-gray-300'}`}>
                                        {grant.status}
                                    </span>
                                </div>
                                {grant.status === 'ACTIVE' && (
                                    <button onClick={() => revokeGrant(grant.id)} className="mt-2 text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white">
                                        Revoke
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
