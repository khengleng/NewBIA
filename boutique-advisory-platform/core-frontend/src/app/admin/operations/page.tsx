'use client'

import { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, Siren, Ticket, Zap } from 'lucide-react'

interface Subscription {
  id: string
  plan: string
  status: string
  billingCycle: string
  seatsIncluded: number
  seatsUsed: number
  nextBillingDate?: string
}

interface SupportTicket {
  id: string
  subject: string
  status: string
  priority: string
  category: string
  createdAt: string
  responseDueAt?: string
  requester?: { firstName?: string; lastName?: string; email?: string }
}

export default function OperationsReadinessPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRunningEscalation, setIsRunningEscalation] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      setError('')

      const [subRes, ticketRes] = await Promise.all([
        authorizedRequest('/api/operations/subscriptions/current'),
        authorizedRequest('/api/operations/support-tickets')
      ])

      if (!subRes.ok || !ticketRes.ok) {
        setError('Failed to load operations readiness data')
        return
      }

      const subJson = await subRes.json()
      const ticketJson = await ticketRes.json()

      setSubscription(subJson.subscription || null)
      setTickets(ticketJson.tickets || [])
    } catch {
      setError('Unable to load operations readiness data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const runEscalation = async () => {
    setIsRunningEscalation(true)
    setError('')
    setMessage('')

    try {
      const res = await authorizedRequest('/api/operations/escalations/run', { method: 'POST' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error || 'Failed to run escalation scan')
        return
      }

      setMessage(`Escalation completed. Escalated tickets: ${payload?.escalatedTickets ?? 0}, stale workflows: ${payload?.staleWorkflows ?? 0}`)
      await load()
    } catch {
      setError('Failed to run escalation scan')
    } finally {
      setIsRunningEscalation(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-400" />
            Operations Readiness
          </h1>
          <p className="text-gray-400 mt-1">Subscription controls, support ticket SLA queue, and escalation runner.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}
        {message && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-blue-300" /> Subscription</h2>
            {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-blue-400" /> : subscription ? (
              <div className="space-y-2 text-sm">
                <p className="text-gray-300">Plan: <span className="text-white font-semibold">{subscription.plan}</span></p>
                <p className="text-gray-300">Status: <span className="text-white font-semibold">{subscription.status}</span></p>
                <p className="text-gray-300">Cycle: <span className="text-white font-semibold">{subscription.billingCycle}</span></p>
                <p className="text-gray-300">Seats: <span className="text-white font-semibold">{subscription.seatsUsed} / {subscription.seatsIncluded}</span></p>
                <p className="text-gray-300">Next Billing: <span className="text-white font-semibold">{subscription.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString() : '-'}</span></p>
              </div>
            ) : <p className="text-gray-400">No subscription found</p>}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><Siren className="w-4 h-4 text-amber-300" /> Escalations</h2>
            <p className="text-sm text-gray-400 mb-4">Escalates overdue support tickets and reports stale workflows (&gt;48h pending/in-progress).</p>
            <button
              onClick={runEscalation}
              disabled={isRunningEscalation}
              className="px-4 py-2 rounded-lg bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 disabled:opacity-60"
            >
              {isRunningEscalation ? 'Running...' : 'Run Escalation Scan'}
            </button>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><Ticket className="w-4 h-4 text-blue-300" /> Support Ticket Queue</h2>
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700">
                    <th className="py-2 pr-3">Subject</th>
                    <th className="py-2 pr-3">Requester</th>
                    <th className="py-2 pr-3">Priority</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="border-b border-gray-800 text-gray-200">
                      <td className="py-3 pr-3">{t.subject}</td>
                      <td className="py-3 pr-3">{t.requester?.email || '-'}</td>
                      <td className="py-3 pr-3">{t.priority}</td>
                      <td className="py-3 pr-3">{t.status}</td>
                      <td className="py-3 pr-3">{t.responseDueAt ? new Date(t.responseDueAt).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                  {tickets.length === 0 && (
                    <tr><td colSpan={5} className="py-10 text-center text-gray-500">No support tickets found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
