'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Users, Handshake, Shield, TrendingUp } from 'lucide-react'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useTranslations } from '../hooks/useTranslations'
import { IS_TRADING_PLATFORM, resolveTradingRuntime } from '@/lib/platform'

export default function HomePage() {
  const { t } = useTranslations()
  const [isTradingRuntime, setIsTradingRuntime] = useState(IS_TRADING_PLATFORM)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsTradingRuntime(resolveTradingRuntime(window.location.hostname, window.location.pathname))
  }, [])

  if (isTradingRuntime) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">CamboBia Trading</h1>
              </div>
              <div className="flex items-center space-x-4">
                <LanguageSwitcher />
                <Link
                  href="/auth/login"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  {t('auth.login', 'Login')}
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium border border-white/20 transition-colors"
                >
                  {t('auth.register', 'Register')}
                </Link>
              </div>
            </div>
          </div>
        </header>
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              CamboBia Token <span className="text-blue-400">Trading</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              A separate marketplace for investors to buy and sell eligible tokenized positions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/secondary-trading"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors"
              >
                Open Marketplace
              </Link>
              <Link
                href="/auth/register"
                className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-lg font-medium text-lg border border-white/20 transition-colors"
              >
                Create Investor Account
              </Link>
            </div>
          </div>
        </section>
      </div>
    )
  }

  const features = [
    {
      icon: Building2,
      title: t('home.features.sme.title', 'SME Platform'),
      description: t('home.features.sme.description', 'Connect SMEs with investors through our comprehensive platform')
    },
    {
      icon: Users,
      title: t('home.features.investor.title', 'Investor Portal'),
      description: t('home.features.investor.description', 'Find and invest in verified SMEs with transparent processes')
    },
    {
      icon: Handshake,
      title: t('home.features.advisory.title', 'Advisory Services'),
      description: t('home.features.advisory.description', 'Professional advisory services for investment readiness')
    },
    {
      icon: Shield,
      title: t('home.features.security.title', 'Security & Compliance'),
      description: t('home.features.security.description', 'Multi-tenant architecture with DID-based authentication')
    },
    {
      icon: TrendingUp,
      title: t('home.features.analytics.title', 'Analytics & Reporting'),
      description: t('home.features.analytics.description', 'Comprehensive dashboards and performance tracking')
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">Boutique Advisory</h1>
            </div>

            <div className="flex items-center space-x-4">
              <LanguageSwitcher />

              <Link
                href="/auth/login"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {t('auth.login', 'Login')}
              </Link>

              <Link
                href="/auth/register"
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium border border-white/20 transition-colors"
              >
                {t('auth.register', 'Register')}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            {t('home.hero.title', 'Bridging')} <span className="text-blue-400">{t('home.hero.sme', 'SMEs')}</span> {t('home.hero.and', 'and')}{' '}
            <span className="text-purple-400">{t('home.hero.investors', 'Investors')}</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            {t('home.hero.description', 'A comprehensive platform connecting Small and Medium Enterprises with qualified investors, featuring advanced DID integration, multi-tenant architecture, and professional advisory services.')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors"
            >
              {t('home.hero.getStarted', 'Get Started')}
            </Link>
            <Link
              href="/dashboard"
              className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-lg font-medium text-lg border border-white/20 transition-colors"
            >
              {t('home.hero.viewDemo', 'View Demo')}
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Platform Features</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Comprehensive tools and services designed to facilitate successful SME-investor connections
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 hover:border-white/20 transition-colors">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Advanced Integrations</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Seamlessly integrated with existing DID, CM, and RWA infrastructure
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">DID Infrastructure</h3>
              <p className="text-gray-300">Decentralized Identity for secure authentication and verifiable credentials</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Case Management</h3>
              <p className="text-gray-300">Comprehensive case tracking and workflow management</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">RWA Platform</h3>
              <p className="text-gray-300">Real World Assets tokenization and investment management</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/20 border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold text-white">Boutique Advisory</span>
              </div>
              <p className="text-gray-300">
                Connecting SMEs with investors through innovative technology and professional services.
              </p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link href="/auth/login" className="hover:text-white transition-colors">Login</Link></li>
                <li><Link href="/auth/register" className="hover:text-white transition-colors">Register</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">Services</h3>
              <ul className="space-y-2 text-gray-300">
                <li>SME Onboarding</li>
                <li>Investor Matching</li>
                <li>Advisory Services</li>
                <li>Compliance Management</li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-gray-300">
                <li>contact@cambobia.com</li>
                <li>+855 12875798</li>
                <li>24/7 Support Available</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-8 pt-8 text-center text-gray-300">
            <p>&copy; 2024 Boutique Advisory Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
