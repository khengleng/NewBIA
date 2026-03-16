'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'

export default function SsoLaunchPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const launch = async () => {
      const params = new URLSearchParams(window.location.search)
      const prompt = params.get('prompt')
      if (prompt === 'login') {
        // Force explicit account selection for cross-platform SSO launches.
        await apiRequest('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        }).catch(() => null)
        router.replace('/auth/login?next=%2Fauth%2Fsso&prompt=login')
        return
      }

      try {
        const response = await apiRequest('/api/auth/sso/trading-link', {
          method: 'GET',
          credentials: 'include',
        })

        if (response.status === 401) {
          router.replace('/auth/login?next=%2Fauth%2Fsso')
          return
        }

        const data = await response.safeJson()
        if (!response.ok || !data?.redirectUrl) {
          setError(data?.error || 'Failed to start SSO. Please try again.')
          return
        }

        window.location.href = data.redirectUrl
      } catch {
        setError('Unable to reach the SSO service. Please try again.')
      }
    }

    launch()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800/70 border border-gray-700 rounded-xl p-6 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-white">Redirecting to Trading Platform</h1>
        {!error && <p className="text-gray-300">Preparing your secure single sign-on session...</p>}
        {error && (
          <>
            <p className="text-red-400">{error}</p>
            <div className="flex items-center justify-center gap-4 text-sm">
              <Link href="/auth/login" className="text-blue-400 hover:text-blue-300">Back to Login</Link>
              <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">Back to Dashboard</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
