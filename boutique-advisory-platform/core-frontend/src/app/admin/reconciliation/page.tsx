'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

interface Run {
  id: string
  status: string
  periodStart: string
  periodEnd: string
  expectedPayout: number
  actualPayout: number
  discrepancyAmount: number
  createdAt: string
  exceptions: { id: string; status: string; severity: string }[]
}

interface ReconciliationException {
  id: string
  type: string
  severity: string
  status: string
  referenceType?: string
  referenceId?: string
  reason: string
  delta?: number | null
  createdAt: string
  assignedTo?: { firstName: string; lastName: string; email: string } | null
}

interface Overview {
  openExceptions: number
  resolvedExceptions: number
  criticalOpenExceptions: number
  lastRun?: {
    id: string
    status: string
    createdAt: string
    discrepancyAmount: number
  } | null
}

export default function ReconciliationPage() {
  const { addToast } = useToast()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [exceptions, setExceptions] = useState<ReconciliationException[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = async () => {
    setIsLoading(true)
    try {
      const [overviewRes, runsRes, exceptionsRes] = await Promise.all([
        authorizedRequest('/api/admin/reconciliation/overview'),
        authorizedRequest('/api/admin/reconciliation/runs'),
        authorizedRequest('/api/admin/reconciliation/exceptions')
      ])

      if (overviewRes.ok) {
        const data = await overviewRes.json()
        setOverview(data.overview)
      }
      if (runsRes.ok) {
        const data = await runsRes.json()
        setRuns(data.runs || [])
      }
      if (exceptionsRes.ok) {
        const data = await exceptionsRes.json()
        setExceptions(data.exceptions || [])
      }
    } catch (_error) {
      addToast('error', 'Failed to load reconciliation operations')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runReconciliation = async () => {
    try {
      const response = await authorizedRequest('/api/admin/reconciliation/runs', {
        method: 'POST',
        body: JSON.stringify({})
      })

      if (!response.ok) {
        addToast('error', 'Unable to execute reconciliation run')
        return
      }

      const data = await response.json()
      addToast('success', `Reconciliation completed (${data.exceptionsCreated} exceptions)`)
      load()
    } catch (_error) {
      addToast('error', 'Unable to execute reconciliation run')
    }
  }

  const updateException = async (id: string, status: string) => {
    try {
      const response = await authorizedRequest(`/api/admin/reconciliation/exceptions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      })

      if (!response.ok) {
        addToast('error', 'Unable to update exception status')
        return
      }

      addToast('success', 'Exception updated')
      load()
    } catch (_error) {
      addToast('error', 'Unable to update exception status')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white">Financial Reconciliation Ops</h1>
            <p className="text-gray-400 mt-1">Settlement mismatch detection, exception queue, and payout integrity controls.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={runReconciliation} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">Run Daily Reconciliation</button>
            <button onClick={load} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {overview && (
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Open Exceptions</p><p className="text-2xl font-bold text-yellow-300">{overview.openExceptions}</p></div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Resolved</p><p className="text-2xl font-bold text-emerald-300">{overview.resolvedExceptions}</p></div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Critical Open</p><p className="text-2xl font-bold text-red-300">{overview.criticalOpenExceptions}</p></div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4"><p className="text-xs text-gray-400">Last Discrepancy</p><p className="text-2xl font-bold text-purple-300">${Number(overview.lastRun?.discrepancyAmount || 0).toLocaleString()}</p></div>
          </div>
        )}

        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700"><h2 className="text-white font-semibold">Recent Reconciliation Runs</h2></div>
          {runs.length === 0 ? <div className="p-6 text-gray-400">No runs yet.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-900/50 text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3">Expected</th>
                    <th className="px-4 py-3">Actual</th>
                    <th className="px-4 py-3">Discrepancy</th>
                    <th className="px-4 py-3">Exceptions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-3 text-gray-300">{new Date(run.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-300">{new Date(run.periodStart).toLocaleDateString()} - {new Date(run.periodEnd).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-gray-300">${run.expectedPayout.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-300">${run.actualPayout.toLocaleString()}</td>
                      <td className={`px-4 py-3 ${run.discrepancyAmount === 0 ? 'text-emerald-300' : 'text-red-300'}`}>${run.discrepancyAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-300">{run.exceptions.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700"><h2 className="text-white font-semibold">Exception Queue</h2></div>
          {isLoading ? <div className="p-6 text-gray-400">Loading exceptions...</div> : exceptions.length === 0 ? <div className="p-6 text-gray-400">No exceptions.</div> : (
            <div className="divide-y divide-gray-700">
              {exceptions.map((item) => (
                <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">{item.type} · {item.referenceType || 'GENERAL'} {item.referenceId || ''}</p>
                    <p className="text-sm text-gray-400">{item.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">Severity: {item.severity} · Delta: ${Number(item.delta || 0).toLocaleString()} · {new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={item.status}
                      onChange={(event) => updateException(item.id, event.target.value)}
                      className="px-2 py-1 rounded bg-gray-900 border border-gray-700 text-white"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="DISMISSED">DISMISSED</option>
                    </select>
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
