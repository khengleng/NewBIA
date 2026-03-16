'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Send, PlusCircle } from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

interface TemplateStep {
    title: string
    description?: string
    required?: boolean
    dueDays?: number
}

interface OnboardingTemplate {
    id: string
    role: string
    name: string
    description?: string | null
    version: number
    isActive: boolean
    steps: TemplateStep[]
}

interface OnboardingTask {
    id: string
    title: string
    status: string
    dueAt?: string | null
    user: { id: string; email: string; firstName: string; lastName: string; role: string }
    assignee?: { id: string; firstName: string; lastName: string; role: string } | null
    template: { id: string; name: string; role: string; version: number }
}

interface UserRecord {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
    status: string
}

export default function AdminOnboardingPage() {
    const { addToast } = useToast()
    const [templates, setTemplates] = useState<OnboardingTemplate[]>([])
    const [tasks, setTasks] = useState<OnboardingTask[]>([])
    const [users, setUsers] = useState<UserRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [roleFilter, setRoleFilter] = useState<'ALL' | 'SME' | 'INVESTOR' | 'ADVISOR'>('ALL')
    const [taskStatusFilter, setTaskStatusFilter] = useState('ALL')
    const [search, setSearch] = useState('')

    const [showCreateTemplate, setShowCreateTemplate] = useState(false)
    const [templateForm, setTemplateForm] = useState({
        role: 'SME',
        name: '',
        description: '',
        stepTitle: '',
        stepDescription: '',
        stepDueDays: '7'
    })
    const [templateSteps, setTemplateSteps] = useState<TemplateStep[]>([])

    const load = async () => {
        setIsLoading(true)
        try {
            const roleQuery = roleFilter === 'ALL' ? '' : `?role=${roleFilter}`
            const taskQuery = new URLSearchParams()
            if (roleFilter !== 'ALL') taskQuery.set('role', roleFilter)
            if (taskStatusFilter !== 'ALL') taskQuery.set('status', taskStatusFilter)
            if (search.trim()) taskQuery.set('search', search.trim())

            const [templateRes, taskRes, userRes] = await Promise.all([
                authorizedRequest(`/api/admin/onboarding/templates${roleQuery}`),
                authorizedRequest(`/api/admin/onboarding/tasks?${taskQuery.toString()}`),
                authorizedRequest('/api/admin/users')
            ])

            if (templateRes.ok) {
                const data = await templateRes.json()
                setTemplates(data.templates || [])
            }
            if (taskRes.ok) {
                const data = await taskRes.json()
                setTasks(data.tasks || [])
            }
            if (userRes.ok) {
                const data = await userRes.json()
                setUsers(data.users || [])
            }
        } catch (error) {
            console.error('Load onboarding data error:', error)
            addToast('error', 'Failed to load onboarding data')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roleFilter, taskStatusFilter])

    const opsUsers = useMemo(
        () => users.filter((user) => ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'].includes(user.role) && user.status === 'ACTIVE'),
        [users]
    )

    const addStep = () => {
        if (!templateForm.stepTitle.trim()) {
            addToast('error', 'Step title is required')
            return
        }
        setTemplateSteps((prev) => [
            ...prev,
            {
                title: templateForm.stepTitle.trim(),
                description: templateForm.stepDescription.trim() || undefined,
                required: true,
                dueDays: Number(templateForm.stepDueDays || '0') || undefined
            }
        ])
        setTemplateForm((prev) => ({ ...prev, stepTitle: '', stepDescription: '' }))
    }

    const createTemplate = async () => {
        if (!templateForm.name.trim()) return addToast('error', 'Template name is required')
        if (templateSteps.length === 0) return addToast('error', 'Add at least one step')

        try {
            const res = await authorizedRequest('/api/admin/onboarding/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: templateForm.role,
                    name: templateForm.name,
                    description: templateForm.description,
                    steps: templateSteps,
                    isActive: true
                })
            })
            const data = await res.json()
            if (!res.ok) return addToast('error', data.error || 'Failed to create template')
            addToast('success', 'Template created')
            setShowCreateTemplate(false)
            setTemplateSteps([])
            setTemplateForm({
                role: 'SME',
                name: '',
                description: '',
                stepTitle: '',
                stepDescription: '',
                stepDueDays: '7'
            })
            await load()
        } catch (error) {
            console.error('Create template error:', error)
            addToast('error', 'Failed to create template')
        }
    }

    const applyTemplate = async (templateId: string) => {
        try {
            const res = await authorizedRequest(`/api/admin/onboarding/templates/${templateId}/apply`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) return addToast('error', data.error || 'Failed to apply template')
            addToast('success', `Template applied. ${data.created || 0} tasks generated.`)
            await load()
        } catch (error) {
            console.error('Apply template error:', error)
            addToast('error', 'Failed to apply template')
        }
    }

    const toggleTemplate = async (template: OnboardingTemplate) => {
        try {
            const res = await authorizedRequest(`/api/admin/onboarding/templates/${template.id}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !template.isActive })
            })
            const data = await res.json()
            if (!res.ok) return addToast('error', data.error || 'Failed to update template state')
            addToast('success', template.isActive ? 'Template unpublished' : 'Template published')
            await load()
        } catch (error) {
            console.error('Toggle template error:', error)
            addToast('error', 'Failed to update template')
        }
    }

    const updateTask = async (taskId: string, payload: Record<string, string>) => {
        try {
            const res = await authorizedRequest(`/api/admin/onboarding/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            if (!res.ok) return addToast('error', data.error || 'Failed to update task')
            addToast('success', 'Task updated')
            await load()
        } catch (error) {
            console.error('Update task error:', error)
            addToast('error', 'Failed to update task')
        }
    }

    const sendReminder = async (taskId: string) => {
        try {
            const res = await authorizedRequest(`/api/admin/onboarding/tasks/${taskId}/remind`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) return addToast('error', data.error || 'Failed to send reminder')
            addToast('success', 'Reminder sent')
            await load()
        } catch (error) {
            console.error('Reminder error:', error)
            addToast('error', 'Failed to send reminder')
        }
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Onboarding Orchestration</h1>
                        <p className="text-gray-400 mt-1">Manage role-based onboarding templates and task queue.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={load} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-sm flex items-center gap-2">
                            <RefreshCw className="w-4 h-4" /> Refresh
                        </button>
                        <button onClick={() => setShowCreateTemplate(true)} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm flex items-center gap-2">
                            <PlusCircle className="w-4 h-4" /> New Template
                        </button>
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex flex-wrap gap-2">
                    {(['ALL', 'SME', 'INVESTOR', 'ADVISOR'] as const).map((role) => (
                        <button
                            key={role}
                            onClick={() => setRoleFilter(role)}
                            className={`px-3 py-1 rounded-lg text-xs border ${roleFilter === role ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-300'}`}
                        >
                            {role}
                        </button>
                    ))}
                    <select
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1 text-sm text-white"
                        value={taskStatusFilter}
                        onChange={(e) => setTaskStatusFilter(e.target.value)}
                    >
                        <option value="ALL">All Task Statuses</option>
                        {['PENDING', 'IN_PROGRESS', 'BLOCKED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAIVED'].map((status) => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                    <input
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1 text-sm text-white flex-1 min-w-[220px]"
                        placeholder="Search tasks by user/title..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                        <h2 className="text-white font-semibold">Templates</h2>
                        {isLoading ? (
                            <p className="text-gray-400 text-sm">Loading templates...</p>
                        ) : templates.length === 0 ? (
                            <p className="text-gray-400 text-sm">No templates found.</p>
                        ) : templates.map((template) => (
                            <div key={template.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                                <div className="flex justify-between gap-2">
                                    <div>
                                        <p className="text-white font-medium">{template.name}</p>
                                        <p className="text-xs text-gray-400">{template.role} • v{template.version} • {template.steps.length} steps</p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${template.isActive ? 'bg-green-500/20 text-green-300' : 'bg-gray-700 text-gray-300'}`}>
                                        {template.isActive ? 'ACTIVE' : 'INACTIVE'}
                                    </span>
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <button onClick={() => applyTemplate(template.id)} className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">Apply to Role Users</button>
                                    <button onClick={() => toggleTemplate(template)} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white">
                                        {template.isActive ? 'Unpublish' : 'Publish'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                        <h2 className="text-white font-semibold">Task Queue</h2>
                        {isLoading ? (
                            <p className="text-gray-400 text-sm">Loading tasks...</p>
                        ) : tasks.length === 0 ? (
                            <p className="text-gray-400 text-sm">No onboarding tasks in queue.</p>
                        ) : tasks.map((task) => (
                            <div key={task.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
                                <div className="flex justify-between gap-2">
                                    <div>
                                        <p className="text-white text-sm font-medium">{task.title}</p>
                                        <p className="text-xs text-gray-400">
                                            {task.user.firstName} {task.user.lastName} ({task.user.role}) • {task.template.name}
                                        </p>
                                    </div>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">{task.status}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <select
                                        value={task.status}
                                        onChange={(e) => updateTask(task.id, { status: e.target.value })}
                                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                    >
                                        {['PENDING', 'IN_PROGRESS', 'BLOCKED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAIVED'].map((status) => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={task.assignee?.id || ''}
                                        onChange={(e) => updateTask(task.id, { assigneeId: e.target.value })}
                                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                    >
                                        <option value="">Unassigned</option>
                                        {opsUsers.map((user) => (
                                            <option key={user.id} value={user.id}>{user.firstName} {user.lastName} ({user.role})</option>
                                        ))}
                                    </select>
                                    <button onClick={() => sendReminder(task.id)} className="text-xs px-2 py-1 rounded bg-orange-600/20 border border-orange-600/40 text-orange-300 flex items-center gap-1">
                                        <Send className="w-3 h-3" /> Remind
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showCreateTemplate && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-3">
                        <h3 className="text-white text-lg font-semibold">Create Onboarding Template</h3>
                        <div className="grid md:grid-cols-2 gap-2">
                            <select
                                value={templateForm.role}
                                onChange={(e) => setTemplateForm((prev) => ({ ...prev, role: e.target.value }))}
                                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                            >
                                <option value="SME">SME</option>
                                <option value="INVESTOR">INVESTOR</option>
                                <option value="ADVISOR">ADVISOR</option>
                            </select>
                            <input
                                value={templateForm.name}
                                onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="Template name"
                                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                            />
                        </div>
                        <textarea
                            value={templateForm.description}
                            onChange={(e) => setTemplateForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Template description"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                            rows={2}
                        />
                        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 space-y-2">
                            <p className="text-sm text-gray-200">Add Steps</p>
                            <div className="grid md:grid-cols-3 gap-2">
                                <input
                                    value={templateForm.stepTitle}
                                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, stepTitle: e.target.value }))}
                                    placeholder="Step title"
                                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                                />
                                <input
                                    value={templateForm.stepDescription}
                                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, stepDescription: e.target.value }))}
                                    placeholder="Step description"
                                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                                />
                                <input
                                    value={templateForm.stepDueDays}
                                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, stepDueDays: e.target.value }))}
                                    placeholder="Due days"
                                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                                />
                            </div>
                            <button onClick={addStep} className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">Add Step</button>
                            <div className="space-y-1 max-h-28 overflow-auto">
                                {templateSteps.map((step, idx) => (
                                    <p key={`${step.title}-${idx}`} className="text-xs text-gray-300">
                                        {idx + 1}. {step.title} {step.dueDays ? `(due in ${step.dueDays} days)` : ''}
                                    </p>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowCreateTemplate(false)} className="px-3 py-2 rounded-lg bg-gray-800 text-white">Cancel</button>
                            <button onClick={createTemplate} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Create Template</button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    )
}
