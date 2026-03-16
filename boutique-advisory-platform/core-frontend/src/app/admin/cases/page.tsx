'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Plus, RefreshCw, ShieldAlert, UserCheck } from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'ESCALATED' | 'RESOLVED' | 'CLOSED' | 'REJECTED'

interface CaseRecord {
    id: string
    type: string
    title: string
    description: string
    status: CaseStatus
    priority: string
    assigneeId?: string | null
    createdAt: string
    dueAt?: string | null
    assignee?: { firstName: string; lastName: string; email: string } | null
    requester?: { firstName: string; lastName: string; email: string } | null
}

interface UserRecord {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
    status: string
}

export default function AdminCasesPage() {
    const { addToast } = useToast()
    const [cases, setCases] = useState<CaseRecord[]>([])
    const [stats, setStats] = useState({ open: 0, inProgress: 0, escalated: 0, resolved: 0 })
    const [users, setUsers] = useState<UserRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<'ALL' | CaseStatus>('ALL')
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [createForm, setCreateForm] = useState({
        type: 'OTHER',
        title: '',
        description: '',
        priority: 'MEDIUM',
        assigneeId: ''
    })

    const load = async () => {
        setIsLoading(true)
        try {
            const query = new URLSearchParams()
            if (statusFilter !== 'ALL') query.set('status', statusFilter)
            if (search.trim()) query.set('search', search.trim())

            const [caseRes, statRes, userRes] = await Promise.all([
                authorizedRequest(`/api/admin/cases?${query.toString()}`),
                authorizedRequest('/api/admin/cases/stats'),
                authorizedRequest('/api/admin/users')
            ])

            if (caseRes.ok) {
                const data = await caseRes.json()
                setCases(data.cases || [])
            }
            if (statRes.ok) {
                const data = await statRes.json()
                setStats(data.stats || { open: 0, inProgress: 0, escalated: 0, resolved: 0 })
            }
            if (userRes.ok) {
                const data = await userRes.json()
                const list = Array.isArray(data.users) ? data.users : []
                setUsers(list.filter((u: UserRecord) => ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'].includes(u.role) && u.status === 'ACTIVE'))
            }
        } catch (error) {
            console.error('Load cases error:', error)
            addToast('error', 'Failed to load case data')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter])

    const filtered = useMemo(() => {
        if (!search.trim()) return cases
        const q = search.toLowerCase()
        return cases.filter((item) =>
            item.title.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.id.toLowerCase().includes(q)
        )
    }, [cases, search])

    const updateCase = async (id: string, payload: Record<string, string>) => {
        try {
            const res = await authorizedRequest(`/api/admin/cases/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            if (!res.ok) {
                const data = await res.json()
                addToast('error', data.error || 'Update failed')
                return
            }
            addToast('success', 'Case updated')
            await load()
        } catch (error) {
            console.error('Case update failed:', error)
            addToast('error', 'Case update failed')
        }
    }

    const assignCase = async (id: string, assigneeId: string) => {
        try {
            const res = await authorizedRequest(`/api/admin/cases/${id}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assigneeId })
            })
            if (!res.ok) {
                const data = await res.json()
                addToast('error', data.error || 'Assignment failed')
                return
            }
            addToast('success', 'Case assigned')
            await load()
        } catch (error) {
            console.error('Case assignment failed:', error)
            addToast('error', 'Case assignment failed')
        }
    }

    const escalateCase = async (id: string) => {
        try {
            const res = await authorizedRequest(`/api/admin/cases/${id}/escalate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: 'Escalated from admin queue' })
            })
            if (!res.ok) {
                const data = await res.json()
                addToast('error', data.error || 'Escalation failed')
                return
            }
            addToast('success', 'Case escalated')
            await load()
        } catch (error) {
            console.error('Case escalation failed:', error)
            addToast('error', 'Case escalation failed')
        }
    }

    const createCase = async () => {
        if (!createForm.title.trim() || !createForm.description.trim()) {
            addToast('error', 'Title and description are required')
            return
        }

        try {
            const res = await authorizedRequest('/api/admin/cases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...createForm,
                    assigneeId: createForm.assigneeId || undefined
                })
            })
            if (!res.ok) {
                const data = await res.json()
                addToast('error', data.error || 'Failed to create case')
                return
            }
            addToast('success', 'Case created')
            setShowCreate(false)
            setCreateForm({
                type: 'OTHER',
                title: '',
                description: '',
                priority: 'MEDIUM',
                assigneeId: ''
            })
            await load()
        } catch (error) {
            console.error('Create case failed:', error)
            addToast('error', 'Failed to create case')
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Case Management</h1>
                        <p className="text-gray-400 mt-1">Unified operations queue for disputes, onboarding, support, and compliance issues.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={load} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm flex items-center gap-2">
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                        <button onClick={() => setShowCreate(true)} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            New Case
                        </button>
                    </div>
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-gray-400 text-xs">Open</p><p className="text-2xl text-white font-bold">{stats.open}</p></div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-gray-400 text-xs">In Progress</p><p className="text-2xl text-white font-bold">{stats.inProgress}</p></div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-gray-400 text-xs">Escalated</p><p className="text-2xl text-red-400 font-bold">{stats.escalated}</p></div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-gray-400 text-xs">Resolved/Closed</p><p className="text-2xl text-green-400 font-bold">{stats.resolved}</p></div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex flex-col md:flex-row gap-3">
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by title, id, description..."
                        className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    />
                    <div className="flex gap-2 flex-wrap">
                        {(['ALL', 'OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REJECTED'] as const).map((value) => (
                            <button
                                key={value}
                                onClick={() => setStatusFilter(value)}
                                className={`px-2 py-1 rounded-lg text-xs border ${statusFilter === value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300'}`}
                            >
                                {value === 'ALL' ? 'All' : value.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    {isLoading ? (
                        <div className="text-gray-400">Loading cases...</div>
                    ) : filtered.length === 0 ? (
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center text-gray-400">No cases found.</div>
                    ) : filtered.map((item) => (
                        <div key={item.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs px-2 py-0.5 rounded-full border border-gray-600 text-gray-300">{item.type}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${item.status === 'ESCALATED' ? 'border-red-500 text-red-300' : 'border-blue-500 text-blue-300'}`}>{item.status.replace('_', ' ')}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full border border-orange-500 text-orange-300">{item.priority}</span>
                                    </div>
                                    <p className="text-white font-semibold mt-1">{item.title}</p>
                                    <p className="text-xs text-gray-400">#{item.id} • Created {new Date(item.createdAt).toLocaleString()}</p>
                                </div>
                                <div className="text-xs text-gray-400">
                                    {item.assignee ? `Assignee: ${item.assignee.firstName} ${item.assignee.lastName}` : 'Unassigned'}
                                </div>
                            </div>
                            <p className="text-sm text-gray-300">{item.description}</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={item.assigneeId || ''}
                                    onChange={(e) => assignCase(item.id, e.target.value)}
                                    className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white"
                                >
                                    <option value="">Unassigned</option>
                                    {users.map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.firstName} {user.lastName} ({user.role})
                                        </option>
                                    ))}
                                </select>
                                {item.status !== 'RESOLVED' && item.status !== 'CLOSED' && item.status !== 'REJECTED' && (
                                    <>
                                        <button onClick={() => updateCase(item.id, { status: 'IN_PROGRESS' })} className="px-2 py-1 rounded-lg bg-gray-900 text-gray-200 text-xs border border-gray-700 flex items-center gap-1">
                                            <UserCheck className="w-3 h-3" /> In Progress
                                        </button>
                                        <button onClick={() => escalateCase(item.id)} className="px-2 py-1 rounded-lg bg-red-600/20 text-red-300 text-xs border border-red-600/40 flex items-center gap-1">
                                            <ShieldAlert className="w-3 h-3" /> Escalate
                                        </button>
                                        <button onClick={() => updateCase(item.id, { status: 'RESOLVED' })} className="px-2 py-1 rounded-lg bg-green-600/20 text-green-300 text-xs border border-green-600/40">
                                            Resolve
                                        </button>
                                    </>
                                )}
                                {(item.status === 'RESOLVED' || item.status === 'REJECTED') && (
                                    <button onClick={() => updateCase(item.id, { status: 'IN_PROGRESS' })} className="px-2 py-1 rounded-lg bg-blue-600/20 text-blue-300 text-xs border border-blue-600/40">
                                        Reopen
                                    </button>
                                )}
                                {item.status !== 'CLOSED' && (
                                    <button onClick={() => updateCase(item.id, { status: 'CLOSED' })} className="px-2 py-1 rounded-lg bg-gray-900 text-gray-200 text-xs border border-gray-700 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> Close
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {showCreate && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-full max-w-xl space-y-3">
                        <h2 className="text-white text-lg font-semibold">Create New Case</h2>
                        <div className="grid md:grid-cols-2 gap-3">
                            <select
                                value={createForm.type}
                                onChange={(e) => setCreateForm((prev) => ({ ...prev, type: e.target.value }))}
                                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                            >
                                <option value="OTHER">OTHER</option>
                                <option value="KYC">KYC</option>
                                <option value="DISPUTE">DISPUTE</option>
                                <option value="ONBOARDING">ONBOARDING</option>
                                <option value="SUPPORT">SUPPORT</option>
                                <option value="COMPLIANCE">COMPLIANCE</option>
                                <option value="DEAL_OPS">DEAL OPS</option>
                            </select>
                            <select
                                value={createForm.priority}
                                onChange={(e) => setCreateForm((prev) => ({ ...prev, priority: e.target.value }))}
                                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                            >
                                <option value="LOW">LOW</option>
                                <option value="MEDIUM">MEDIUM</option>
                                <option value="HIGH">HIGH</option>
                                <option value="URGENT">URGENT</option>
                            </select>
                        </div>
                        <input
                            value={createForm.title}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Case title"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                        />
                        <textarea
                            value={createForm.description}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Case description"
                            rows={4}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                        />
                        <select
                            value={createForm.assigneeId}
                            onChange={(e) => setCreateForm((prev) => ({ ...prev, assigneeId: e.target.value }))}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                        >
                            <option value="">No assignee</option>
                            {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                    {user.firstName} {user.lastName} ({user.role})
                                </option>
                            ))}
                        </select>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowCreate(false)} className="px-3 py-2 rounded-lg bg-gray-800 text-white">Cancel</button>
                            <button onClick={createCase} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Create</button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}
