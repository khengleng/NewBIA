'use client'

import { useState, useEffect } from 'react'
import { authorizedRequest } from '@/lib/api'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Shield, Smartphone, Globe, XCircle, Clock, CheckCircle } from 'lucide-react'

interface Session {
    id: string
    ipAddress: string
    userAgent: string
    createdAt: string
    expiresAt: string
}

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
        fetchSessions()
    }, [])

    const fetchSessions = async () => {
        setIsLoading(true)
        setError('')
        try {
            const res = await authorizedRequest('/api/auth/sessions')
            if (res.ok) {
                const data = await res.json()
                setSessions(data.sessions)
                setCurrentSessionId(data.currentSessionId || null)
            } else {
                setError('Failed to load active sessions')
            }
        } catch {
            setError('An error occurred while fetching sessions')
        } finally {
            setIsLoading(false)
        }
    }

    const revokeSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to revoke this session? You will be logged out on that device.')) {
            return
        }

        setRevokingSessionId(sessionId)
        setError('')
        setMessage('')
        try {
            const res = await authorizedRequest(`/api/auth/sessions/${sessionId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                const isCurrentSession = currentSessionId === sessionId
                setMessage(isCurrentSession ? 'Current session logged out. Redirecting...' : 'Session logged out successfully.')
                await fetchSessions()
                if (isCurrentSession) {
                    localStorage.removeItem('user')
                    window.location.href = '/'
                    return
                }
            } else {
                const payload = await res.json().catch(() => null)
                setError(payload?.error || 'Failed to revoke session')
            }
        } catch {
            setError('Error revoking session')
        } finally {
            setRevokingSessionId(null)
        }
    }

    const getEmbeddedPlatform = (uaRaw: string) => {
        const match = (uaRaw || '').match(/\[platform:([^\]]+)\]/i)
        return match?.[1]?.trim().toLowerCase() || ''
    }

    const getCleanUserAgent = (uaRaw: string) => {
        return (uaRaw || '').replace(/\[platform:[^\]]+\]\s*/i, '')
    }

    const parseUserAgent = (uaRaw: string) => {
        const platform = getEmbeddedPlatform(uaRaw)
        const ua = getCleanUserAgent(uaRaw).toLowerCase()

        if (platform.includes('mac')) return 'Mac'
        if (platform.includes('win')) return 'Windows PC'
        if (platform.includes('android')) return 'Android Device'
        if (platform.includes('iphone') || platform.includes('ios')) return 'iPhone'
        if (platform.includes('ipad')) return 'iPad'
        if (platform.includes('linux')) return 'Linux Device'

        // Prefer desktop signatures first to avoid false "Android" labels on mixed strings.
        if (ua.includes('macintosh') || ua.includes('mac os x')) return 'Mac'
        if (ua.includes('windows nt')) return 'Windows PC'
        if (ua.includes('iphone')) return 'iPhone'
        if (ua.includes('ipad')) return 'iPad'
        if (ua.includes('android')) return 'Android Device'
        if (ua.includes('linux')) return 'Linux Device'
        return 'Unknown Device'
    }

    const parseBrowser = (uaRaw: string) => {
        const ua = getCleanUserAgent(uaRaw).toLowerCase()
        if (ua.includes('edg/')) return 'Edge'
        if (ua.includes('firefox/')) return 'Firefox'
        if (ua.includes('chrome/')) return 'Chrome'
        if (ua.includes('safari/')) return 'Safari'
        return 'Web Browser'
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-blue-600/20 rounded-xl">
                        <Shield className="w-8 h-8 text-blue-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">Active Sessions</h1>
                        <p className="text-gray-400">Manage your active logins across all devices</p>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-500 mb-6 flex items-center gap-3">
                        <XCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}
                {message && (
                    <div className="bg-green-500/10 border border-green-500/50 p-4 rounded-xl text-green-400 mb-6 flex items-center gap-3">
                        <CheckCircle className="w-5 h-5" />
                        {message}
                    </div>
                )}

                <div className="space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : sessions.length > 0 ? (
                        sessions.map((session) => {
                            const isCurrentSession = currentSessionId === session.id
                            const displayUserAgent = session.userAgent || ''
                            const displayDevice = parseUserAgent(displayUserAgent)

                            return (
                            <div key={session.id} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 transition-all hover:border-gray-600 shadow-xl">
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-4">
                                        <div className="p-3 bg-gray-700 rounded-xl">
                                            <Smartphone className="w-6 h-6 text-gray-300" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-xl font-semibold text-white">
                                                    {displayDevice}
                                                </h3>
                                                {isCurrentSession && (
                                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded">
                                                        Current
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-gray-400 text-sm mb-3">
                                                {parseBrowser(displayUserAgent)} • {session.ipAddress}
                                            </p>

                                            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-4 h-4" />
                                                    Started: {new Date(session.createdAt).toLocaleString()}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <CheckCircle className="w-4 h-4 text-green-500/50" />
                                                    Expires: {new Date(session.expiresAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => revokeSession(session.id)}
                                        disabled={revokingSessionId === session.id}
                                        className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-lg text-sm font-medium transition-colors border border-red-500/20"
                                    >
                                        {revokingSessionId === session.id ? 'Logging out...' : 'Log Out'}
                                    </button>
                                </div>
                            </div>
                        )})
                    ) : (
                        <div className="text-center py-12 bg-gray-800 rounded-2xl border border-dashed border-gray-700">
                            <Globe className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400 text-lg font-medium">No other active sessions found</p>
                            <p className="text-gray-500 text-sm px-4">You are currently only logged in on this browser.</p>
                        </div>
                    )}
                </div>

                <div className="mt-8 bg-blue-600/5 border border-blue-500/20 rounded-2xl p-6">
                    <h4 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Security Tip
                    </h4>
                    <p className="text-sm text-gray-400 leading-relaxed">
                        If you see a session or device that you do not recognize, log out immediately and consider changing your password. Enabling Two-Factor Authentication (2FA) adds an extra layer of security to your account.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    )
}
