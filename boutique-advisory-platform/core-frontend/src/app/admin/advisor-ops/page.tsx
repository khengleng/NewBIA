'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'
import { RefreshCw } from 'lucide-react'

interface Overview {
    advisors: number
    openAssignments: number
    overdueAssignments: number
    pendingConflicts: number
    avgUtilizationPct: number
}

interface AdvisorRow {
    id: string
    name: string
    status: string
    specialization: string[]
    user: { firstName: string; lastName: string; email: string }
    capacity: { weeklyCapacityHours: number; activeAssignments: number; utilizationPct: number } | null
}

interface Assignment {
    id: string
    advisorId: string
    title: string
    status: string
    priority: string
    dueAt?: string | null
    advisor: { name: string }
}

interface Conflict {
    id: string
    entityName: string
    conflictType: string
    details: string
    status: string
    advisor: { name: string }
}

export default function AdvisorOpsPage() {
    const { addToast } = useToast()
    const [overview, setOverview] = useState<Overview | null>(null)
    const [advisors, setAdvisors] = useState<AdvisorRow[]>([])
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [conflicts, setConflicts] = useState<Conflict[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const [newAssignment, setNewAssignment] = useState({
        advisorId: '',
        title: '',
        priority: 'MEDIUM',
        dueAt: ''
    })

    const load = async () => {
        setIsLoading(true)
        try {
            const [overviewRes, advisorRes, assignmentRes, conflictRes] = await Promise.all([
                authorizedRequest('/api/admin/advisor-ops/overview'),
                authorizedRequest('/api/admin/advisor-ops/advisors'),
                authorizedRequest('/api/admin/advisor-ops/assignments'),
                authorizedRequest('/api/admin/advisor-ops/conflicts')
            ])
            if (overviewRes.ok) setOverview((await overviewRes.json()).overview)
            if (advisorRes.ok) setAdvisors((await advisorRes.json()).advisors || [])
            if (assignmentRes.ok) setAssignments((await assignmentRes.json()).assignments || [])
            if (conflictRes.ok) setConflicts((await conflictRes.json()).conflicts || [])
        } catch (error) {
            console.error('Advisor ops load error:', error)
            addToast('error', 'Failed to load advisor ops')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const updateCapacity = async (advisorId: string, weeklyCapacityHours: number) => {
        try {
            const res = await authorizedRequest(`/api/admin/advisor-ops/capacity/${advisorId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weeklyCapacityHours })
            })
            const data = await res.json()
            if (!res.ok) return addToast('error', data.error || 'Failed to update capacity')
            addToast('success', 'Capacity updated')
            await load()
        } catch (error) {
            addToast('error', 'Failed to update capacity')
        }
    }

    const createAssignment = async () => {
        if (!newAssignment.advisorId || !newAssignment.title.trim()) {
            return addToast('error', 'Advisor and title are required')
        }
        try {
            const res = await authorizedRequest('/api/admin/advisor-ops/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAssignment)
            })
            const data = await res.json()
            if (!res.ok) return addToast('error', data.error || 'Failed to create assignment')
            addToast('success', 'Assignment created')
            setNewAssignment({ advisorId: '', title: '', priority: 'MEDIUM', dueAt: '' })
            await load()
        } catch (error) {
            addToast('error', 'Failed to create assignment')
        }
    }

    const updateAssignment = async (id: string, payload: Record<string, string>) => {
        try {
            const res = await authorizedRequest(`/api/admin/advisor-ops/assignments/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            if (!res.ok) return addToast('error', data.error || 'Failed to update assignment')
            addToast('success', 'Assignment updated')
            await load()
        } catch (error) {
            addToast('error', 'Failed to update assignment')
        }
    }

    const reviewConflict = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        const reviewNote = window.prompt(`${status} note`) || ''
        try {
            const res = await authorizedRequest(`/api/admin/advisor-ops/conflicts/${id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, reviewNote })
            })
            const data = await res.json()
            if (!res.ok) return addToast('error', data.error || 'Failed to review conflict')
            addToast('success', 'Conflict reviewed')
            await load()
        } catch (error) {
            addToast('error', 'Failed to review conflict')
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Advisor Ops Hub</h1>
                        <p className="text-gray-400 mt-1">Capacity, workload, assignment and conflict-of-interest operations.</p>
                    </div>
                    <button onClick={load} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>

                {overview && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Advisors</p><p className="text-2xl text-white font-bold">{overview.advisors}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Open Assignments</p><p className="text-2xl text-blue-300 font-bold">{overview.openAssignments}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Overdue</p><p className="text-2xl text-red-300 font-bold">{overview.overdueAssignments}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Pending Conflicts</p><p className="text-2xl text-yellow-300 font-bold">{overview.pendingConflicts}</p></div>
                        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Avg Utilization</p><p className="text-2xl text-purple-300 font-bold">{overview.avgUtilizationPct}%</p></div>
                    </div>
                )}

                <div className="grid lg:grid-cols-2 gap-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                        <h2 className="text-white font-semibold">Advisor Capacity</h2>
                        {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : advisors.map((advisor) => (
                            <div key={advisor.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                                <p className="text-white text-sm font-medium">{advisor.name}</p>
                                <p className="text-xs text-gray-400">{advisor.user.email}</p>
                                <div className="mt-2 flex items-center gap-2 text-xs">
                                    <span className="text-gray-300">Capacity:</span>
                                    <input
                                        type="number"
                                        min={1}
                                        defaultValue={advisor.capacity?.weeklyCapacityHours || 40}
                                        className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
                                        onBlur={(e) => updateCapacity(advisor.id, Number(e.target.value || 40))}
                                    />
                                    <span className="text-gray-400">hrs/week</span>
                                    <span className="ml-auto text-blue-300">{advisor.capacity?.utilizationPct || 0}% util</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                        <h2 className="text-white font-semibold">Assignment Queue</h2>
                        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
                            <select className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white" value={newAssignment.advisorId} onChange={(e) => setNewAssignment((p) => ({ ...p, advisorId: e.target.value }))}>
                                <option value="">Select advisor</option>
                                {advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.name}</option>)}
                            </select>
                            <input className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white" placeholder="Assignment title" value={newAssignment.title} onChange={(e) => setNewAssignment((p) => ({ ...p, title: e.target.value }))} />
                            <div className="grid grid-cols-2 gap-2">
                                <select className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white" value={newAssignment.priority} onChange={(e) => setNewAssignment((p) => ({ ...p, priority: e.target.value }))}>
                                    <option value="LOW">LOW</option>
                                    <option value="MEDIUM">MEDIUM</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="URGENT">URGENT</option>
                                </select>
                                <input type="datetime-local" className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white" value={newAssignment.dueAt} onChange={(e) => setNewAssignment((p) => ({ ...p, dueAt: e.target.value }))} />
                            </div>
                            <button onClick={createAssignment} className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">Create Assignment</button>
                        </div>

                        <div className="space-y-2 max-h-80 overflow-auto">
                            {assignments.map((assignment) => (
                                <div key={assignment.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                                    <p className="text-sm text-white">{assignment.title}</p>
                                    <p className="text-xs text-gray-400">{assignment.advisor.name} • {assignment.priority}</p>
                                    <div className="mt-2 flex gap-2">
                                        <select className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" value={assignment.status} onChange={(e) => updateAssignment(assignment.id, { status: e.target.value })}>
                                            {['OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'].map((status) => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <h2 className="text-white font-semibold mb-3">Conflict Declarations</h2>
                    <div className="space-y-2">
                        {conflicts.length === 0 ? (
                            <p className="text-gray-400 text-sm">No conflict declarations.</p>
                        ) : conflicts.map((conflict) => (
                            <div key={conflict.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <p className="text-white text-sm font-medium">{conflict.advisor.name} • {conflict.entityName}</p>
                                        <p className="text-xs text-gray-400">{conflict.conflictType}</p>
                                        <p className="text-xs text-gray-300 mt-1">{conflict.details}</p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${conflict.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-gray-700 text-gray-300'}`}>{conflict.status}</span>
                                </div>
                                {conflict.status === 'PENDING' && (
                                    <div className="mt-2 flex gap-2">
                                        <button onClick={() => reviewConflict(conflict.id, 'APPROVED')} className="text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white">Approve</button>
                                        <button onClick={() => reviewConflict(conflict.id, 'REJECTED')} className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white">Reject</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
