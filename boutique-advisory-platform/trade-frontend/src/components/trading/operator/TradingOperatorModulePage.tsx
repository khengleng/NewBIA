'use client'

import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'

type MetricTone = 'neutral' | 'positive' | 'warning'

interface ModuleMetric {
  label: string
  value: string
  tone?: MetricTone
}

interface ModuleAction {
  href: string
  title: string
  description: string
}

interface TradingOperatorModulePageProps {
  title: string
  description: string
  metrics?: ModuleMetric[]
  actions?: ModuleAction[]
  note?: string
}

const toneClass: Record<MetricTone, string> = {
  neutral: 'text-blue-300 border-blue-500/30 bg-blue-500/10',
  positive: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  warning: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
}

export default function TradingOperatorModulePage({
  title,
  description,
  metrics = [],
  actions = [],
  note,
}: TradingOperatorModulePageProps) {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          <p className="text-gray-400 mt-2">{description}</p>
        </section>

        {metrics.length > 0 && (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className={`rounded-xl border p-4 ${toneClass[metric.tone || 'neutral']}`}
              >
                <p className="text-xs uppercase tracking-wide">{metric.label}</p>
                <p className="text-2xl font-semibold mt-2 text-white">{metric.value}</p>
              </div>
            ))}
          </section>
        )}

        {actions.length > 0 && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-blue-500/40 transition-colors"
              >
                <h2 className="text-lg text-white font-semibold">{action.title}</h2>
                <p className="text-gray-400 mt-2">{action.description}</p>
              </Link>
            ))}
          </section>
        )}

        {note && (
          <section className="bg-gray-800/70 border border-gray-700 rounded-xl p-5">
            <p className="text-sm text-gray-300">{note}</p>
          </section>
        )}
      </div>
    </DashboardLayout>
  )
}
