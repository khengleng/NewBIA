'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

interface RetentionRule {
  id: string
  module: string
  retentionDays: number
  archiveBeforeDelete: boolean
  status: string
}

interface LegalHold {
  id: string
  title: string
  reason: string
  scopeType: string
  status: string
  createdAt: string
  releasedAt?: string | null
}

interface GovernanceOverview {
  activeRules: number
  pausedRules: number
  activeHolds: number
}

const moduleDefaults: Record<string, number> = {
  MESSAGES: 365,
  DOCUMENTS: 2555,
  ACTIVITY_LOGS: 365,
  SESSIONS: 90,
  DISPUTES: 2555,
  WORKFLOWS: 1095
}

export default function DataGovernancePage() {
  const { addToast } = useToast()
  const [overview, setOverview] = useState<GovernanceOverview | null>(null)
  const [rules, setRules] = useState<RetentionRule[]>([])
  const [holds, setHolds] = useState<LegalHold[]>([])
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const load = async () => {
    setIsLoading(true)
    try {
      const [overviewRes, rulesRes, holdsRes] = await Promise.all([
        authorizedRequest('/api/admin/data-governance/overview'),
        authorizedRequest('/api/admin/data-governance/retention/rules'),
        authorizedRequest('/api/admin/data-governance/legal-holds')
      ])

      if (overviewRes.ok) {
        const data = await overviewRes.json()
        setOverview(data.overview)
      }
      if (rulesRes.ok) {
        const data = await rulesRes.json()
        const existing = data.rules || []
        const merged = Object.keys(moduleDefaults).map((module) => {
          const found = existing.find((rule: RetentionRule) => rule.module === module)
          return found || {
            id: `${module}-virtual`,
            module,
            retentionDays: moduleDefaults[module],
            archiveBeforeDelete: true,
            status: 'ACTIVE'
          }
        })
        setRules(merged)
      }
      if (holdsRes.ok) {
        const data = await holdsRes.json()
        setHolds(data.holds || [])
      }
    } catch (_error) {
      addToast('error', 'Failed to load data governance controls')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateRule = async (module: string, retentionDays: number, status: string, archiveBeforeDelete: boolean) => {
    try {
      const response = await authorizedRequest(`/api/admin/data-governance/retention/rules/${module}`, {
        method: 'PUT',
        body: JSON.stringify({ retentionDays, status, archiveBeforeDelete })
      })
      if (!response.ok) {
        addToast('error', `Unable to update ${module} rule`)
        return
      }
      addToast('success', `${module} retention rule updated`)
      load()
    } catch (_error) {
      addToast('error', `Unable to update ${module} rule`)
    }
  }

  const createLegalHold = async () => {
    if (!title.trim() || !reason.trim()) {
      addToast('error', 'Title and reason are required')
      return
    }

    try {
      const response = await authorizedRequest('/api/admin/data-governance/legal-holds', {
        method: 'POST',
        body: JSON.stringify({ title, reason, scopeType: 'TENANT', scope: {} })
      })
      if (!response.ok) {
        addToast('error', 'Unable to create legal hold')
        return
      }
      setTitle('')
      setReason('')
      addToast('success', 'Legal hold created')
      load()
    } catch (_error) {
      addToast('error', 'Unable to create legal hold')
    }
  }

  const releaseHold = async (id: string) => {
    try {
      const response = await authorizedRequest(`/api/admin/data-governance/legal-holds/${id}/release`, {
        method: 'POST'
      })
      if (!response.ok) {
        addToast('error', 'Unable to release legal hold')
        return
      }
      addToast('success', 'Legal hold released')
      load()
    } catch (_error) {
      addToast('error', 'Unable to release legal hold')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white">Data Retention & Legal Hold</h1>
            <p className="text-gray-400 mt-1">Retention policies and legal hold controls to protect evidentiary data.</p>
          </div>
          <button onClick={load} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {overview && (
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Active Rules</p><p className="text-2xl font-bold text-emerald-300">{overview.activeRules}</p></div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Paused Rules</p><p className="text-2xl font-bold text-yellow-300">{overview.pausedRules}</p></div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Active Holds</p><p className="text-2xl font-bold text-red-300">{overview.activeHolds}</p></div>
          </div>
        )}

        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700"><h2 className="text-white font-semibold">Retention Rules</h2></div>
          {isLoading ? <div className="p-6 text-gray-400">Loading rules...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-900/50 text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Module</th>
                    <th className="px-4 py-3">Retention Days</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Archive</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {rules.map((rule) => (
                    <tr key={rule.module}>
                      <td className="px-4 py-3 text-white font-medium">{rule.module}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          defaultValue={rule.retentionDays}
                          min={1}
                          max={3650}
                          className="w-32 px-2 py-1 rounded bg-gray-900 border border-gray-700 text-white"
                          onBlur={(event) => updateRule(rule.module, Number(event.target.value), rule.status, rule.archiveBeforeDelete)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          defaultValue={rule.status}
                          className="px-2 py-1 rounded bg-gray-900 border border-gray-700 text-white"
                          onChange={(event) => updateRule(rule.module, rule.retentionDays, event.target.value, rule.archiveBeforeDelete)}
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="PAUSED">PAUSED</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <label className="text-gray-300 inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            defaultChecked={rule.archiveBeforeDelete}
                            onChange={(event) => updateRule(rule.module, rule.retentionDays, rule.status, event.target.checked)}
                          />
                          Enabled
                        </label>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">Changes auto-save</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          <h2 className="text-white font-semibold">Create Legal Hold</h2>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Hold title" className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white" />
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for legal hold" className="w-full px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white min-h-[90px]" />
          <button onClick={createLegalHold} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">Create Legal Hold</button>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700"><h2 className="text-white font-semibold">Legal Hold Register</h2></div>
          {holds.length === 0 ? <div className="p-6 text-gray-400">No legal holds recorded.</div> : (
            <div className="divide-y divide-gray-700">
              {holds.map((hold) => (
                <div key={hold.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">{hold.title}</p>
                    <p className="text-sm text-gray-400">{hold.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">{hold.scopeType} • {new Date(hold.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full border ${hold.status === 'ACTIVE' ? 'text-red-300 border-red-500/30 bg-red-500/10' : 'text-gray-300 border-gray-600 bg-gray-700/30'}`}>
                      {hold.status}
                    </span>
                    {hold.status === 'ACTIVE' && (
                      <button onClick={() => releaseHold(hold.id)} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm">Release</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
