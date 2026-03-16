'use client'

import { useEffect, useState } from 'react'
import {
    Wallet,
    UserPlus,
    ShieldCheck,
    Briefcase,
    LifeBuoy,
    Lock,
    AlertTriangle,
    CheckCircle2,
    Loader2
} from 'lucide-react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'

type SectionKey = 'billing' | 'onboarding' | 'compliance' | 'dealops' | 'support' | 'security'

interface OpsSection {
    key: SectionKey
    title: string
    metrics: Record<string, number>
    focus: string
}

interface OpsResponse {
    generatedAt: string
    overview: OpsSection[]
}

const sectionIcons: Record<SectionKey, React.ComponentType<{ className?: string }>> = {
    billing: Wallet,
    onboarding: UserPlus,
    compliance: ShieldCheck,
    dealops: Briefcase,
    support: LifeBuoy,
    security: Lock
}

const prettyLabel = (value: string) =>
    value
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (char) => char.toUpperCase())
        .trim()

export default function BusinessOpsPage() {
    const [data, setData] = useState<OpsResponse | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true)
                setError('')

                const res = await authorizedRequest('/api/admin/business-ops/overview')
                if (!res.ok) {
                    const payload = await res.json().catch(() => null)
                    setError(payload?.error || 'Failed to load business operations data')
                    return
                }

                const payload = await res.json()
                setData(payload)
            } catch {
                setError('Unable to load business operations data')
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [])

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Business Operations</h1>
                        <p className="text-gray-400 mt-1">Cross-functional command center for billing, onboarding, compliance, deal ops, support, and security.</p>
                    </div>
                    {data?.generatedAt && (
                        <div className="text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                            Updated: {new Date(data.generatedAt).toLocaleString()}
                        </div>
                    )}
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        {data?.overview?.map((section) => {
                            const Icon = sectionIcons[section.key]
                            const lowerFocus = section.focus.toLowerCase()
                            const hasWarning = ['review', 'escalate', 'prioritize', 'investigate', 'resolve'].some((word) => lowerFocus.includes(word))

                            return (
                                <div
                                    key={section.key}
                                    className="bg-gray-800 border border-gray-700 rounded-2xl p-5"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-lg bg-blue-600/15 border border-blue-500/30">
                                                <Icon className="w-5 h-5 text-blue-300" />
                                            </div>
                                            <h2 className="text-white font-semibold text-lg">{section.title}</h2>
                                        </div>
                                        {hasWarning ? (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">Attention</span>
                                        ) : (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/30">Healthy</span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {Object.entries(section.metrics).map(([name, value]) => (
                                            <div key={name} className="rounded-xl bg-gray-900/70 border border-gray-700 p-3">
                                                <p className="text-[11px] text-gray-400 uppercase tracking-wide">{prettyLabel(name)}</p>
                                                <p className="text-2xl font-bold text-white mt-1">{value.toLocaleString()}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-3 text-sm text-gray-300 flex items-start gap-2">
                                        {hasWarning ? (
                                            <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5" />
                                        ) : (
                                            <CheckCircle2 className="w-4 h-4 text-green-300 mt-0.5" />
                                        )}
                                        <span>{section.focus}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
