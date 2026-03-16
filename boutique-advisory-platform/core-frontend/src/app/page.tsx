'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, Building2, FileText, ShieldCheck, Users } from 'lucide-react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { TRADING_FRONTEND_URL } from '@/lib/platform'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_28%),linear-gradient(180deg,#020617,#0f172a)]">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">CamboBia Platform</h1>
              <p className="text-sm text-slate-400">SME fundraising, investor access, and platform operations</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link href="/auth/login" className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-blue-700">
              Login
            </Link>
            <Link href="/auth/register" className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 font-medium text-white transition-colors hover:border-slate-500">
              Register
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-24">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-sm text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            Primary portal for SME owners, investors, advisors, and platform operators
          </div>
          <div className="space-y-5">
            <h2 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
              Raise capital, manage diligence, and run your funding journey in one place.
            </h2>
            <p className="max-w-3xl text-lg leading-8 text-slate-300">
              CamboBia Platform is the main operating portal for SME owners to present their business, prepare investor materials,
              coordinate advisory workflows, and manage fundraising with qualified investors.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/auth/register" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700">
              Create SME account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/auth/login" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3 font-semibold text-white transition hover:border-slate-500">
              Sign in
            </Link>
            <Link href={TRADING_FRONTEND_URL} className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-6 py-3 font-semibold text-cyan-200 transition hover:bg-cyan-500/20">
              Visit secondary market
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['SME fundraising', 'Publish your business profile, financials, milestones, and investor narrative.'],
              ['Investor access', 'Review SME opportunities, diligence materials, and network activity in one portal.'],
              ['Operations ready', 'Run onboarding, compliance, messaging, and reporting from the same platform.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-blue-950/20">
          <h3 className="text-xl font-semibold text-white">What belongs in CamboBia Platform</h3>
          <div className="mt-6 space-y-5">
            {[
              [Building2, 'My Business', 'Company profile, funding story, diligence readiness, and issuer operations.'],
              [Users, 'Investor Network', 'Qualified investor discovery, relationship tracking, and engagement workflows.'],
              [FileText, 'Data Room & documents', 'Secure file sharing, checklists, and fundraising materials.'],
              [BarChart3, 'Advisory & operations', 'Advisor collaboration, admin oversight, compliance and platform operations.'],
            ].map(([Icon, title, body]) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
                <div className="mt-1 rounded-xl bg-blue-600/15 p-2 text-blue-300">
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
