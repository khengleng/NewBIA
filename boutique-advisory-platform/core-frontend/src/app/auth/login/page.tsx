'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from '../../../hooks/useTranslations'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, Building2 } from 'lucide-react'
import { apiRequest } from '../../../lib/api'
import { normalizeRole } from '@/lib/roles'
import { hasPermission } from '@/lib/permissions'

export default function LoginPage() {
  const { t } = useTranslations()
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials')
  const [tempToken, setTempToken] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [showResendVerification, setShowResendVerification] = useState(false)
  const [resendStatus, setResendStatus] = useState('')
  const [nextPath, setNextPath] = useState('')

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const getPostLoginPath = (role?: string) => {
    const normalizedRole = normalizeRole(role)
    return hasPermission(normalizedRole, 'admin.read') ? '/admin/dashboard' : '/dashboard'
  }

  const syncSessionUser = async (fallbackUser?: any, expectedEmail?: string) => {
    try {
      const meResponse = await apiRequest('/api/auth/me', { method: 'GET', credentials: 'include' })
      if (meResponse.ok) {
        const meData = await meResponse.safeJson()
        const sessionUser = meData?.user
        if (sessionUser) {
          const normalizedExpected = String(expectedEmail || '').trim().toLowerCase()
          const normalizedActual = String(sessionUser?.email || '').trim().toLowerCase()
          if (normalizedExpected && normalizedActual && normalizedExpected !== normalizedActual) {
            return fallbackUser || null
          }
          return sessionUser
        }
      }
    } catch {
      // fall back to login payload user
    }
    return fallbackUser || null
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search)
    const verify = params.get('verify')
    const email = params.get('email')
    const next = params.get('next')

    if (email) {
      setFormData(prev => ({ ...prev, email }))
    }

    if (verify === '1') {
      setResendStatus('Registration successful. Please verify your email before logging in.')
    }

    // Prevent open redirects by allowing only same-origin absolute paths.
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      setNextPath(next)
    }
  }, [])

  const handleResendVerification = async () => {
    if (!formData.email) {
      setErrors({ general: 'Please enter your email first' });
      return;
    }
    setIsLoading(true)
    setResendStatus('')

    try {
      const response = await apiRequest('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: formData.email })
      })

      const data = await response.safeJson()

      if (response.ok) {
        setResendStatus('Verification email sent! Please check your inbox.')
        setShowResendVerification(false)
        setErrors({})
      } else {
        setErrors({ general: data.error || 'Failed to send email' })
      }
    } catch (error: any) {
      setErrors({ general: error.message || 'Network error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await apiRequest('/api/auth/verify-2fa', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ tempToken, code: twoFactorCode })
      })

      if (response.ok) {
        const data = await response.safeJson()
        // localStorage.setItem('token', data.token)
        const sessionUser = await syncSessionUser(data?.user, formData.email)
        if (!sessionUser) {
          setErrors({ general: 'Unable to establish session. Please try again.' })
          return
        }
        localStorage.removeItem('user')
        localStorage.setItem('user', JSON.stringify(sessionUser))
        window.dispatchEvent(new Event('auth:changed'))
        router.push(nextPath || getPostLoginPath(sessionUser?.role))
      } else {
        const errorData = await response.safeJson()
        setErrors({ general: errorData.error || 'Invalid code' })
      }
    } catch (error: any) {
      setErrors({ general: error.message || 'Network error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)

    try {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await response.safeJson()

      if (response.ok) {

        if (data.require2fa) {
          setTempToken(data.tempToken)
          setStep('2fa')
          setErrors({})
        } else {
          // localStorage.setItem('token', data.token) // Token is now in HttpOnly cookie
          const sessionUser = await syncSessionUser(data?.user, formData.email)
          if (!sessionUser) {
            setErrors({ general: 'Unable to establish session. Please try again.' })
            return
          }
          localStorage.removeItem('user')
          localStorage.setItem('user', JSON.stringify(sessionUser))
          window.dispatchEvent(new Event('auth:changed'))
          router.push(nextPath || getPostLoginPath(sessionUser?.role))
        }
      } else {
        const errorMsg = data.error || 'Login failed';
        setErrors({ general: errorMsg })

        if (errorMsg.toLowerCase().includes('verify')) {
          setShowResendVerification(true)
        }
      }
    } catch (error: any) {
      console.error('Login error:', error)
      const message = String(error?.message || '')
      if (message.includes('503')) {
        setErrors({ general: 'Service is temporarily unavailable. Please try again in a few seconds.' })
      } else {
        setErrors({ general: 'Network error. Please try again.' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(30,64,175,0.22),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(15,118,110,0.18),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,1))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full items-center px-4 py-10 sm:px-6 lg:px-10 max-w-md justify-center">

        <section className="w-full">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/78 p-6 shadow-2xl backdrop-blur sm:p-8">
            <div className="mx-auto mb-6 h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-center text-3xl font-bold text-white">
              {step === '2fa' ? 'Two-Factor Authentication' : t('auth.login')}
            </h2>
            <p className="mt-2 text-center text-sm text-slate-300">
              {step === '2fa'
                ? 'Enter the 6-digit code from your authenticator app'
                : 'Sign in to your CamboBia Platform account'}
            </p>

      {step === '2fa' ? (
        <form className="mt-8 space-y-6" onSubmit={handle2faSubmit}>
          {errors.general && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-400 text-sm">{errors.general}</p>
            </div>
          )}
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-300">
              Authentication Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              maxLength={6}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={twoFactorCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setTwoFactorCode(val);
                if (val.length === 6 && !isLoading) {
                  // Optional: Auto-submit when 6 digits reached? 
                  // Let's force manual click or Enter to avoid accidental submits, unless requested.
                  // For responsiveness complaint, ensuring the button works reliably is key.
                }
              }}
              className="mt-1 appearance-none block w-full px-3 py-3 border border-gray-600 placeholder-gray-400 text-white bg-gray-800/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-[0.5em] text-2xl font-mono"
              placeholder="000000"
              autoFocus
            />
          </div>

          <div className="flex flex-col space-y-4">
            <button
              type="submit"
              disabled={isLoading || twoFactorCode.length !== 6}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </span>
              ) : 'Verify Code'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('credentials');
                setTempToken('');
                setTwoFactorCode('');
                setErrors({});
              }}
              className="w-full text-sm text-gray-400 hover:text-white transition-colors"
            >
              Back to Login
            </button>
          </div>
        </form>
      ) : (
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {errors.general && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-400 text-sm">{errors.general}</p>
              {showResendVerification && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="mt-2 text-sm font-medium text-blue-400 hover:text-blue-300 underline focus:outline-none"
                >
                  Resend Verification Email
                </button>
              )}
            </div>
          )}
          {resendStatus && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-green-400 text-sm">{resendStatus}</p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                {t('auth.email')}
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`appearance-none relative block w-full pl-10 pr-3 py-3 border ${errors.email ? 'border-red-500' : 'border-gray-600'
                    } placeholder-gray-400 text-white bg-gray-800/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                {t('auth.password')}
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`appearance-none relative block w-full pl-10 pr-12 py-3 border ${errors.password ? 'border-red-500' : 'border-gray-600'
                    } placeholder-gray-400 text-white bg-gray-800/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-400">{errors.password}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                checked={formData.rememberMe}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-800"
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-300">
                {t('auth.rememberMe')}
              </label>
            </div>

            <div className="text-sm">
              <Link
                href="/auth/forgot-password"
                className="font-medium text-blue-400 hover:text-blue-300"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : t('auth.login')}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-300">
              Don&apos;t have an account?{' '}
              <Link
                href="/auth/register"
                className="font-medium text-blue-400 hover:text-blue-300"
              >
                {t('auth.register')}
              </Link>
            </p>
          </div>
        </form>
      )}
          </div>
        </section>
      </div>
    </div>

  )
}
