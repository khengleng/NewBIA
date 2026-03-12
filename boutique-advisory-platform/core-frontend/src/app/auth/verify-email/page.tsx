'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2, Building2 } from 'lucide-react'
import { apiRequest } from '../../../lib/api'

function VerifyEmailContent() {
    const searchParams = useSearchParams()
    const token = searchParams.get('token')
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
    const [message, setMessage] = useState('')
    const [countdown, setCountdown] = useState(5)
    const router = useRouter()

    useEffect(() => {
        if (!token) {
            setStatus('error')
            setMessage('No verification token found in the URL.')
            return
        }

        const verifyEmail = async () => {
            try {
                const response = await apiRequest('/api/auth/verify-email', {
                    method: 'POST',
                    body: JSON.stringify({ token }),
                })

                const data = await response.json()

                if (response.ok) {
                    setStatus('success')
                    setMessage(data.message || 'Email verified successfully!')

                    // Start countdown redirect
                    const timer = setInterval(() => {
                        setCountdown((prev) => {
                            if (prev <= 1) {
                                clearInterval(timer)
                                router.push('/auth/login')
                                return 0
                            }
                            return prev - 1
                        })
                    }, 1000)

                    return () => clearInterval(timer)
                } else {
                    setStatus('error')
                    setMessage(data.error || 'Failed to verify email. The token may be invalid or expired.')
                }
            } catch (error) {
                console.error('Verification error:', error)
                setStatus('error')
                setMessage('An error occurred while connecting to the server.')
            }
        }

        verifyEmail()
    }, [token, router])

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-8 space-y-8">
                <div className="text-center">
                    <div className="mx-auto h-16 w-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-6">
                        <Building2 className="h-8 w-8 text-white" />
                    </div>

                    <h2 className="text-3xl font-extrabold text-white mb-2">
                        Email Verification
                    </h2>

                    <div className="mt-8 flex flex-col items-center justify-center space-y-4">
                        {status === 'verifying' && (
                            <>
                                <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                                <p className="text-gray-300 text-lg">Verifying your email address...</p>
                            </>
                        )}

                        {status === 'success' && (
                            <>
                                <CheckCircle className="h-16 w-16 text-green-500" />
                                <p className="text-green-400 text-lg font-medium">{message}</p>
                                <p className="text-gray-400 text-sm">Redirecting to login in {countdown} seconds...</p>
                                <Link
                                    href="/auth/login"
                                    className="mt-4 inline-flex items-center px-6 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Go to Login
                                </Link>
                            </>
                        )}

                        {status === 'error' && (
                            <>
                                <XCircle className="h-16 w-16 text-red-500" />
                                <p className="text-red-400 text-lg font-medium text-center">{message}</p>
                                <div className="mt-4 space-y-3 w-full">
                                    <Link
                                        href="/auth/login"
                                        className="block w-full text-center px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
                                    >
                                        Back to Login
                                    </Link>
                                    <Link
                                        href="/auth/register" // Or a resend verification page if it existed
                                        className="block w-full text-center text-sm text-blue-400 hover:text-blue-300"
                                    >
                                        Register a new account
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>}>
            <VerifyEmailContent />
        </Suspense>
    )
}
