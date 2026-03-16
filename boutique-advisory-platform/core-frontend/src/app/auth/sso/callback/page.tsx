'use client'

import { useEffect, useState } from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { CORE_FRONTEND_URL } from '@/lib/platform'
import { isTradingOperatorRole, normalizeRole } from '@/lib/roles'
import { TRADING_OPERATOR_HOME } from '@/lib/tradingOperatorRoutes'

function SsoCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const completeSso = async () => {
      const code = searchParams.get('code')
      if (!code) {
        setError('Missing SSO code. Please start again from Cambobia.')
        return
      }

      try {
        localStorage.removeItem('user')
        window.dispatchEvent(new Event('auth:changed'))

        const response = await apiRequest('/api/auth/sso/trading/exchange', {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ code }),
        })

        const data = await response.safeJson()
        if (!response.ok) {
          setError(data?.error || 'SSO login failed.')
          return
        }

        let sessionUser = data?.user || null
        try {
          const meResponse = await apiRequest('/api/auth/me', { method: 'GET', credentials: 'include' })
          if (meResponse.ok) {
            const meData = await meResponse.safeJson()
            if (meData?.user) {
              sessionUser = meData.user
            }
          }
        } catch {
          // keep exchange payload fallback
        }

        if (sessionUser) {
          localStorage.setItem('user', JSON.stringify(sessionUser))
          window.dispatchEvent(new Event('auth:changed'))
        }
        const role = normalizeRole(sessionUser?.role)
        const isOperator = isTradingOperatorRole(role)
        router.replace(isOperator ? TRADING_OPERATOR_HOME : '/secondary-trading')
      } catch {
        setError('Unable to complete SSO login. Please try again.')
      }
    }

    completeSso()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800/70 border border-gray-700 rounded-xl p-6 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-white">Signing In</h1>
        {!error && <p className="text-gray-300">Finalizing your secure trading session...</p>}
        {error && (
          <>
            <p className="text-red-400">{error}</p>
            <div className="flex items-center justify-center gap-4 text-sm">
              <Link href="/auth/login" className="text-blue-400 hover:text-blue-300">Use Trading Login</Link>
              <a href={`${CORE_FRONTEND_URL}/auth/sso`} className="text-blue-400 hover:text-blue-300">Retry SSO</a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function SsoCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800/70 border border-gray-700 rounded-xl p-6 text-center">
          <p className="text-gray-300">Loading secure sign-in...</p>
        </div>
      </div>
    }>
      <SsoCallbackContent />
    </Suspense>
  )
}
