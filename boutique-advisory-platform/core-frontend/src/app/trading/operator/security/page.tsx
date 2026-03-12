'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'
import { AlertTriangle, History, KeyRound, ShieldCheck, Users } from 'lucide-react'

interface SecurityOverview {
  policy: {
    enforceAdminMfa: boolean
    loginAttemptLimit: number
    lockoutWindowMinutes: number
    sessionTtlDays: number
    passwordMinLength: number
    platformBoundaryMode: string
  }
  metrics: {
    operatorAccounts: number
    operatorMfaEnabled: number
    operatorMfaCoverage: number
    activeSessionCount: number
    suspiciousLoginAttempts24h: number
    blockedIpCount: number
  }
  blockedIps: string[]
  recentEvents: Array<{
    timestamp: string
    action: string
    detail: string
    ipAddress: string | null
    result: string
  }>
}

const controls = [
  {
    title: 'Session Governance',
    description: 'Review and revoke active operator sessions across browsers and devices.',
    href: '/trading/sessions',
    cta: 'Manage Sessions',
    icon: Users,
  },
  {
    title: 'Role & Access Controls',
    description: 'Apply least-privilege role grants for trading operations and compliance.',
    href: '/trading/operator/role-lifecycle',
    cta: 'Open Role Lifecycle',
    icon: KeyRound,
  },
  {
    title: 'Security Audit Trail',
    description: 'Inspect immutable access and policy change logs for investigations.',
    href: '/trading/operator/audit',
    cta: 'Open Audit Trail',
    icon: History,
  },
]

export default function TradingOperatorSecurityPage() {
  const [overview, setOverview] = useState<SecurityOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const response = await authorizedRequest('/api/admin/security/overview')
        if (!response.ok) {
          throw new Error('Failed to load security overview')
        }
        const payload = await response.json()
        setOverview(payload)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load security overview')
      } finally {
        setIsLoading(false)
      }
    }

    void loadOverview()
  }, [])

  const metricCards = useMemo(() => {
    if (!overview) return []
    return [
      { label: 'Operator Accounts', value: overview.metrics.operatorAccounts },
      { label: 'MFA Coverage', value: `${overview.metrics.operatorMfaCoverage}%` },
      { label: 'Active Sessions', value: overview.metrics.activeSessionCount },
      { label: 'Blocked IPs', value: overview.metrics.blockedIpCount },
    ]
  }, [overview])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-blue-400 mt-1" />
            <div>
              <h1 className="text-3xl font-bold text-white">Trading Platform Security</h1>
              <p className="text-gray-400 mt-2">
                Configure operator-level safeguards for listing controls, transaction oversight, and incident response.
              </p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 text-gray-300">Loading security overview...</div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-5 text-red-100">{error}</div>
        )}

        {overview && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {metricCards.map((metric) => (
                <div key={metric.label} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                  <div className="text-sm text-gray-400">{metric.label}</div>
                  <div className="text-3xl font-bold text-white mt-2">{metric.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {controls.map((control) => {
                const Icon = control.icon
                return (
                  <div key={control.title} className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                    <Icon className="w-6 h-6 text-blue-400" />
                    <h2 className="text-xl font-semibold text-white mt-4">{control.title}</h2>
                    <p className="text-gray-400 mt-2">{control.description}</p>
                    <Link
                      href={control.href}
                      className="inline-flex mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                    >
                      {control.cta}
                    </Link>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white">Policy Baseline</h2>
                <div className="mt-4 space-y-3 text-sm text-gray-300">
                  <div className="flex justify-between gap-4"><span>Admin MFA enforcement</span><span>{overview.policy.enforceAdminMfa ? 'Enabled' : 'Disabled'}</span></div>
                  <div className="flex justify-between gap-4"><span>Login attempt limit</span><span>{overview.policy.loginAttemptLimit}</span></div>
                  <div className="flex justify-between gap-4"><span>Lockout window</span><span>{overview.policy.lockoutWindowMinutes} min</span></div>
                  <div className="flex justify-between gap-4"><span>Session TTL</span><span>{overview.policy.sessionTtlDays} days</span></div>
                  <div className="flex justify-between gap-4"><span>Password minimum</span><span>{overview.policy.passwordMinLength} chars</span></div>
                  <div className="flex justify-between gap-4"><span>Boundary mode</span><span>{overview.policy.platformBoundaryMode}</span></div>
                </div>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-white">Blocked IP Inventory</h2>
                <div className="mt-4 space-y-2 text-sm text-gray-300">
                  {overview.blockedIps.length === 0 ? (
                    <div className="text-gray-500">No blocked IPs.</div>
                  ) : (
                    overview.blockedIps.map((ip) => (
                      <div key={ip} className="px-3 py-2 bg-gray-900 rounded-lg border border-gray-700">{ip}</div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white">Recent Security Events</h2>
              <div className="mt-4 space-y-3">
                {overview.recentEvents.length === 0 ? (
                  <div className="text-gray-500">No recent operator security events.</div>
                ) : (
                  overview.recentEvents.map((event, index) => (
                    <div key={`${event.timestamp}-${index}`} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 px-4 py-3 bg-gray-900 rounded-lg border border-gray-700">
                      <div>
                        <div className="text-white font-medium">{event.action}</div>
                        <div className="text-sm text-gray-400">{event.detail}</div>
                      </div>
                      <div className="text-sm text-gray-400">
                        <div>{new Date(event.timestamp).toLocaleString()}</div>
                        <div>{event.ipAddress || 'No IP recorded'} • {event.result}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-300 mt-0.5" />
          <p className="text-amber-100 text-sm">
            Trading operator credentials are isolated from trader accounts. Use operator roles only for exchange governance,
            compliance, surveillance, and platform operations.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
