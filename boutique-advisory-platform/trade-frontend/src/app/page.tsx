'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, CandlestickChart, ShieldCheck, Wallet } from 'lucide-react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { CORE_FRONTEND_URL } from '@/lib/platform'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.16),transparent_32%),linear-gradient(180deg,#020617,#0f172a)]">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500">
              <CandlestickChart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">CamboBia Trading</h1>
              <p className="text-sm text-slate-400">Dedicated secondary market for eligible tokenized units</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link href="/auth/login" className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-blue-700">
              Login
            </Link>
            <Link href={CORE_FRONTEND_URL} className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 font-medium text-white transition-colors hover:border-slate-500">
              Back to main portal
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1 text-sm text-cyan-200">
            <ShieldCheck className="h-4 w-4" />
            Trading platform only: listings, order flow, portfolio, surveillance
          </div>
          <div className="space-y-5">
            <h2 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
              Trade eligible CamboBia tokenized units with a dedicated secondary market interface.
            </h2>
            <p className="max-w-3xl text-lg leading-8 text-slate-300">
              CamboBia Trading is separate from the fundraising portal. Investors access listed units, live market data,
              trade history, and portfolio views here, while platform operators manage market governance, surveillance, and fees.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/auth/login" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700">
              Open trading access
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/secondary-trading" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3 font-semibold text-white transition hover:border-slate-500">
              View market
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Listings & market depth', 'Track eligible unit listings, pricing, volume, and live order activity.'],
              ['Portfolio & wallet', 'Review holdings, trade confirmations, and settlement-linked balances.'],
              ['Exchange operations', 'Support market surveillance, issuer controls, investor KYC, and reconciliation.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/20">
          <h3 className="text-xl font-semibold text-white">What belongs in CamboBia Trading</h3>
          <div className="mt-6 space-y-5">
            {[
              [BarChart3, 'Markets', 'Live prices, listed units, liquidity signals, and trading dashboards.'],
              [Wallet, 'Trader portfolio', 'Holdings, realized activity, trade history, and wallet-linked balances.'],
              [ShieldCheck, 'Platform controls', 'Operator oversight for listings, compliance, cases, and fee operations.'],
            ].map(([Icon, title, body]) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                <div className="mt-1 rounded-xl bg-cyan-500/15 p-2 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-medium text-white">{title}</h4>
                  <p className="mt-1 text-sm text-slate-400">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  )
}
