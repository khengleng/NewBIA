'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { isTradingOperatorRole, normalizeRole } from '@/lib/roles'
import { AlertTriangle, CheckCircle, Shield, Smartphone, XCircle } from 'lucide-react'

interface Session {
    id: string
    ipAddress: string
    userAgent: string
    createdAt: string
    expiresAt: string
}

interface TwoFaSetup {
    secret: string
    qrCode: string
}

interface PlatformSecurityOverview {
    policy: {
        enforceAdminMfa: boolean
        loginAttemptLimit: number
        lockoutWindowMinutes: number
        sessionTtlDays: number
        passwordMinLength: number
        platformBoundaryMode: string
    }
    metrics: {
        operatorAccounts: number
        operatorMfaEnabled: number
        operatorMfaCoverage: number
        activeSessionCount: number
        suspiciousLoginAttempts24h: number
        blockedIpCount: number
    }
    blockedIps: string[]
    recentEvents: Array<{
        timestamp: string
        action: string
        detail: string
        ipAddress?: string | null
        result: 'ALLOWED' | 'DENIED' | string
    }>
}

const getEmbeddedPlatform = (uaRaw: string) => {
    const match = (uaRaw || '').match(/\[platform:([^\]]+)\]/i)
    return match?.[1]?.trim().toLowerCase() || ''
}

const getCleanUserAgent = (uaRaw: string) => {
    return (uaRaw || '').replace(/\[platform:[^\]]+\]\s*/i, '')
}

const parseDevice = (uaRaw: string) => {
    const platform = getEmbeddedPlatform(uaRaw)
    const ua = getCleanUserAgent(uaRaw).toLowerCase()

    if (platform.includes('mac')) return 'Mac'
    if (platform.includes('win')) return 'Windows PC'
    if (platform.includes('android')) return 'Android Device'
    if (platform.includes('iphone') || platform.includes('ios')) return 'iPhone'
    if (platform.includes('ipad')) return 'iPad'
    if (platform.includes('linux')) return 'Linux Device'

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

export default function TradingSecurityPage() {
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(true)
    const [roleLabel, setRoleLabel] = useState('Investor')
    const [isOperator, setIsOperator] = useState(false)
    const [accountEmail, setAccountEmail] = useState('')
    const [is2faEnabled, setIs2faEnabled] = useState(false)
    const [sessions, setSessions] = useState<Session[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
    const [twoFaSetup, setTwoFaSetup] = useState<TwoFaSetup | null>(null)
    const [securityOverview, setSecurityOverview] = useState<PlatformSecurityOverview | null>(null)
    const [ipToBlock, setIpToBlock] = useState('')

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [twoFaCode, setTwoFaCode] = useState('')
    const [disable2faPassword, setDisable2faPassword] = useState('')

    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [isSettingUp2fa, setIsSettingUp2fa] = useState(false)
    const [isActivating2fa, setIsActivating2fa] = useState(false)
    const [isDisabling2fa, setIsDisabling2fa] = useState(false)
    const [isBlockingIp, setIsBlockingIp] = useState(false)
    const [isRevokingAllSessions, setIsRevokingAllSessions] = useState(false)
    const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const meRes = await authorizedRequest('/api/auth/me')
                if (!meRes.ok) {
                    throw new Error('Unable to verify current user session')
                }

                const me = await meRes.json()
                setIs2faEnabled(Boolean(me?.user?.twoFactorEnabled))
                setAccountEmail(me?.user?.email || '')

                const role = normalizeRole(me?.user?.role)
                const operatorMode = isTradingOperatorRole(role)
                setIsOperator(operatorMode)
                setRoleLabel(operatorMode ? 'Operator' : 'Investor')

                const requests: Array<Promise<Response>> = [
                    authorizedRequest('/api/auth/sessions')
                ]
                if (operatorMode) {
                    requests.push(authorizedRequest('/api/admin/security/overview'))
                }

                const responses = await Promise.all(requests)
                const sessionsRes = responses[0]
                const overviewRes = responses[1]

                if (sessionsRes?.ok) {
                    const data = await sessionsRes.json()
                    setSessions(Array.isArray(data?.sessions) ? data.sessions : [])
                    setCurrentSessionId(data?.currentSessionId || null)
                } else {
                    setSessions([])
                    setCurrentSessionId(null)
                }

                if (operatorMode) {
                    if (overviewRes?.ok) {
                        const overview = await overviewRes.json()
                        setSecurityOverview(overview)
                    } else {
                        setSecurityOverview(null)
                        addToast('error', 'Failed to load platform security overview')
                    }
                } else {
                    setSecurityOverview(null)
                }
            } catch (error) {
                console.error('Failed loading account security data', error)
                addToast('error', 'Failed to load account security settings')
            } finally {
                setIsLoading(false)
            }
        }

        load()
    }, [addToast])

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            addToast('error', 'All password fields are required')
            return
        }
        if (newPassword !== confirmPassword) {
            addToast('error', 'New password and confirm password do not match')
            return
        }

        setIsChangingPassword(true)
        try {
            const response = await authorizedRequest('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword })
            })

            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
                addToast('error', payload?.error || 'Failed to change password')
                return
            }

            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            addToast('success', 'Password updated. Please login again on other devices.')
        } catch (error) {
            console.error('Change password failed', error)
            addToast('error', 'Failed to change password')
        } finally {
            setIsChangingPassword(false)
        }
    }

    const handleStart2faSetup = async () => {
        setIsSettingUp2fa(true)
        try {
            const response = await authorizedRequest('/api/auth/2fa/setup', { method: 'POST' })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
                addToast('error', payload?.error || 'Unable to setup 2FA')
                return
            }
            setTwoFaSetup({ secret: payload.secret, qrCode: payload.qrCode })
            addToast('success', '2FA setup started. Scan QR and activate.')
        } catch (error) {
            console.error('2FA setup failed', error)
            addToast('error', 'Unable to setup 2FA')
        } finally {
            setIsSettingUp2fa(false)
        }
    }

    const handleActivate2fa = async () => {
        if (!twoFaSetup?.secret || !twoFaCode) {
            addToast('error', 'Enter 2FA code from your authenticator app')
            return
        }

        setIsActivating2fa(true)
        try {
            const response = await authorizedRequest('/api/auth/2fa/activate', {
                method: 'POST',
                body: JSON.stringify({ code: twoFaCode, secret: twoFaSetup.secret })
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
                addToast('error', payload?.error || 'Failed to activate 2FA')
                return
            }

            setIs2faEnabled(true)
            setTwoFaCode('')
            setTwoFaSetup(null)
            addToast('success', '2FA enabled successfully')
        } catch (error) {
            console.error('2FA activation failed', error)
            addToast('error', 'Failed to activate 2FA')
        } finally {
            setIsActivating2fa(false)
        }
    }

    const handleDisable2fa = async () => {
        if (!disable2faPassword) {
            addToast('error', 'Password is required to disable 2FA')
            return
        }

        setIsDisabling2fa(true)
        try {
            const response = await authorizedRequest('/api/auth/2fa/disable', {
                method: 'POST',
                body: JSON.stringify({ password: disable2faPassword })
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
                addToast('error', payload?.error || 'Failed to disable 2FA')
                return
            }

            setDisable2faPassword('')
            setIs2faEnabled(false)
            addToast('success', '2FA disabled')
        } catch (error) {
            console.error('Disable 2FA failed', error)
            addToast('error', 'Failed to disable 2FA')
        } finally {
            setIsDisabling2fa(false)
        }
    }

    const handleBlockIp = async () => {
        if (!ipToBlock.trim()) {
            addToast('error', 'Enter an IP address to block')
            return
        }

        setIsBlockingIp(true)
        try {
            const response = await authorizedRequest('/api/admin/security/ip-blocklist', {
                method: 'POST',
                body: JSON.stringify({ ipAddress: ipToBlock.trim() })
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
                addToast('error', payload?.error || 'Failed to block IP')
                return
            }

            setIpToBlock('')
            setSecurityOverview((prev) => prev ? {
                ...prev,
                blockedIps: Array.from(new Set([...(prev.blockedIps || []), payload?.ipAddress || ipToBlock.trim()])),
                metrics: {
                    ...prev.metrics,
                    blockedIpCount: (prev.metrics?.blockedIpCount || 0) + 1,
                }
            } : prev)
            addToast('success', 'IP blocked successfully')
        } catch (error) {
            console.error('Block IP failed', error)
            addToast('error', 'Failed to block IP')
        } finally {
            setIsBlockingIp(false)
        }
    }

    const handleUnblockIp = async (ipAddress: string) => {
        try {
            const encoded = encodeURIComponent(ipAddress)
            const response = await authorizedRequest(`/api/admin/security/ip-blocklist/${encoded}`, {
                method: 'DELETE',
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
                addToast('error', payload?.error || 'Failed to unblock IP')
                return
            }
            setSecurityOverview((prev) => prev ? {
                ...prev,
                blockedIps: (prev.blockedIps || []).filter((entry) => entry !== ipAddress),
                metrics: {
                    ...prev.metrics,
                    blockedIpCount: Math.max(0, (prev.metrics?.blockedIpCount || 0) - 1),
                }
            } : prev)
            addToast('success', 'IP unblocked')
        } catch (error) {
            console.error('Unblock IP failed', error)
            addToast('error', 'Failed to unblock IP')
        }
    }

    const handleRevokeAllSessions = async () => {
        setIsRevokingAllSessions(true)
        try {
            const response = await authorizedRequest('/api/admin/security/revoke-sessions', {
                method: 'POST',
                body: JSON.stringify({ includeCurrent: false })
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
                addToast('error', payload?.error || 'Failed to revoke sessions')
                return
            }

            const stillCurrent = sessions.filter((session) => session.id === currentSessionId)
            setSessions(stillCurrent)
            addToast('success', `${payload?.revokedCount || 0} sessions revoked`)
        } catch (error) {
            console.error('Revoke all sessions failed', error)
            addToast('error', 'Failed to revoke sessions')
        } finally {
            setIsRevokingAllSessions(false)
        }
    }

    const revokeSession = async (sessionId: string) => {
        setRevokingSessionId(sessionId)
        try {
            const response = await authorizedRequest(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
                addToast('error', payload?.error || 'Failed to revoke session')
                return
            }

            const isCurrent = currentSessionId === sessionId
            setSessions(prev => prev.filter(s => s.id !== sessionId))
            addToast('success', 'Session revoked')

            if (isCurrent) {
                localStorage.removeItem('user')
                window.location.href = '/'
            }
        } catch (error) {
            console.error('Revoke session failed', error)
            addToast('error', 'Failed to revoke session')
        } finally {
            setRevokingSessionId(null)
        }
    }

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">{roleLabel} Security Center</h1>
                    <p className="text-gray-400 mt-1">
                        {isOperator
                            ? 'Operator controls for platform-wide security posture, access safety, and incident response.'
                            : 'Manage password, MFA/2FA, active sessions, and account protection.'}
                    </p>
                </div>

                {isOperator && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Operator MFA Coverage</p>
                                <p className="text-2xl font-semibold text-white mt-1">{securityOverview?.metrics?.operatorMfaCoverage ?? 0}%</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {securityOverview?.metrics?.operatorMfaEnabled ?? 0}/{securityOverview?.metrics?.operatorAccounts ?? 0} operator accounts
                                </p>
                            </div>
                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Suspicious Events (24h)</p>
                                <p className="text-2xl font-semibold text-white mt-1">{securityOverview?.metrics?.suspiciousLoginAttempts24h ?? 0}</p>
                                <p className="text-xs text-gray-400 mt-1">Failed login/intrusion signals</p>
                            </div>
                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                                <p className="text-xs text-gray-400">Blocked IPs</p>
                                <p className="text-2xl font-semibold text-white mt-1">{securityOverview?.metrics?.blockedIpCount ?? 0}</p>
                                <p className="text-xs text-gray-400 mt-1">Network deny list</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                            <div className="xl:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-5">
                                <h2 className="text-white text-lg font-semibold">Platform Security Policy</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm">
                                    <PolicyItem label="Admin MFA Enforced" value={securityOverview?.policy?.enforceAdminMfa ? 'Yes' : 'No'} />
                                    <PolicyItem label="Password Min Length" value={String(securityOverview?.policy?.passwordMinLength ?? 8)} />
                                    <PolicyItem label="Login Attempt Limit" value={String(securityOverview?.policy?.loginAttemptLimit ?? 5)} />
                                    <PolicyItem label="Lockout Window" value={`${securityOverview?.policy?.lockoutWindowMinutes ?? 30} min`} />
                                    <PolicyItem label="Session TTL" value={`${securityOverview?.policy?.sessionTtlDays ?? 7} day(s)`} />
                                    <PolicyItem label="Boundary Mode" value={securityOverview?.policy?.platformBoundaryMode || 'single'} />
                                </div>
                            </div>

                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
                                <h2 className="text-white text-lg font-semibold">Containment Actions</h2>
                                <button
                                    type="button"
                                    onClick={handleRevokeAllSessions}
                                    disabled={isRevokingAllSessions}
                                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white rounded-lg"
                                >
                                    {isRevokingAllSessions ? 'Revoking...' : 'Revoke All Non-Current Sessions'}
                                </button>
                                <p className="text-xs text-gray-400">
                                    Use this when suspicious activity is detected. Traders and operators will need to login again.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-3">
                                <h2 className="text-white text-lg font-semibold">IP Blocklist</h2>
                                <div className="flex gap-2">
                                    <input
                                        value={ipToBlock}
                                        onChange={(e) => setIpToBlock(e.target.value)}
                                        placeholder="203.0.113.10 or 2001:db8::1"
                                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleBlockIp}
                                        disabled={isBlockingIp}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded-lg"
                                    >
                                        {isBlockingIp ? 'Blocking...' : 'Block'}
                                    </button>
                                </div>
                                <div className="max-h-48 overflow-auto space-y-2">
                                    {(securityOverview?.blockedIps || []).length === 0 && (
                                        <p className="text-sm text-gray-400">No blocked IPs.</p>
                                    )}
                                    {(securityOverview?.blockedIps || []).map((ipAddress) => (
                                        <div key={ipAddress} className="flex items-center justify-between rounded-lg border border-gray-700 px-3 py-2">
                                            <p className="text-sm text-gray-200">{ipAddress}</p>
                                            <button
                                                type="button"
                                                onClick={() => handleUnblockIp(ipAddress)}
                                                className="text-xs text-red-300 hover:text-red-200"
                                            >
                                                Unblock
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                                <h2 className="text-white text-lg font-semibold">Recent Security Events</h2>
                                <div className="mt-3 space-y-2 max-h-56 overflow-auto">
                                    {(securityOverview?.recentEvents || []).length === 0 && (
                                        <p className="text-sm text-gray-400">No recent events available.</p>
                                    )}
                                    {(securityOverview?.recentEvents || []).map((event, index) => (
                                        <div key={`${event.timestamp}-${index}`} className="rounded-lg border border-gray-700 px-3 py-2">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm text-white">{event.action}</p>
                                                <span className={`text-[10px] px-2 py-0.5 rounded ${
                                                    event.result === 'DENIED'
                                                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                        : 'bg-green-500/20 text-green-300 border border-green-500/30'
                                                }`}>
                                                    {event.result}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">{event.detail}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {new Date(event.timestamp).toLocaleString()} {event.ipAddress ? `• ${event.ipAddress}` : ''}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                            <p className="text-yellow-200 text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Platform policies above are sourced from active backend security configuration and operator controls.
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <form
                        className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault()
                            void handleChangePassword()
                        }}
                    >
                        <input
                            type="text"
                            name="username"
                            value={accountEmail}
                            autoComplete="username"
                            readOnly
                            tabIndex={-1}
                            aria-hidden="true"
                            className="sr-only"
                        />
                        <h2 className="text-white text-lg font-semibold">Change Password</h2>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Current password"
                            autoComplete="current-password"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                        />
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="New password"
                            autoComplete="new-password"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                        />
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            autoComplete="new-password"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                        />
                        <button
                            type="submit"
                            disabled={isChangingPassword}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded-lg"
                        >
                            {isChangingPassword ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>

                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
                        <h2 className="text-white text-lg font-semibold">Multi-Factor Authentication (MFA)</h2>
                        <div className="flex items-center gap-2 text-sm">
                            {is2faEnabled ? (
                                <>
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    <span className="text-green-300">Enabled</span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-4 h-4 text-red-400" />
                                    <span className="text-red-300">Disabled</span>
                                </>
                            )}
                        </div>

                        {!is2faEnabled && (
                            <button
                                onClick={handleStart2faSetup}
                                disabled={isSettingUp2fa}
                                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded-lg"
                            >
                                {isSettingUp2fa ? 'Preparing...' : 'Setup MFA'}
                            </button>
                        )}

                        {twoFaSetup && (
                            <div className="space-y-3 pt-2 border-t border-gray-700">
                                {twoFaSetup.qrCode && (
                                    <img src={twoFaSetup.qrCode} alt="MFA QR Code" className="w-44 h-44 rounded-lg border border-gray-700 bg-white p-2" />
                                )}
                                <p className="text-xs text-gray-400 break-all">Secret: {twoFaSetup.secret}</p>
                                <input
                                    value={twoFaCode}
                                    onChange={(e) => setTwoFaCode(e.target.value)}
                                    placeholder="Enter 6-digit code"
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                />
                                <button
                                    onClick={handleActivate2fa}
                                    disabled={isActivating2fa}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded-lg"
                                >
                                    {isActivating2fa ? 'Activating...' : 'Activate MFA'}
                                </button>
                            </div>
                        )}

                        {is2faEnabled && (
                            <form
                                className="space-y-3 pt-2 border-t border-gray-700"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    void handleDisable2fa()
                                }}
                            >
                                <input
                                    type="text"
                                    name="username"
                                    value={accountEmail}
                                    autoComplete="username"
                                    readOnly
                                    tabIndex={-1}
                                    aria-hidden="true"
                                    className="sr-only"
                                />
                                <input
                                    type="password"
                                    value={disable2faPassword}
                                    onChange={(e) => setDisable2faPassword(e.target.value)}
                                    placeholder="Password to disable MFA"
                                    autoComplete="current-password"
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                                />
                                <button
                                    type="submit"
                                    disabled={isDisabling2fa}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white rounded-lg"
                                >
                                    {isDisabling2fa ? 'Disabling...' : 'Disable MFA'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white text-lg font-semibold">Active Sessions</h2>
                        <span className="text-xs text-gray-400">{sessions.length} session(s)</span>
                    </div>

                    {isLoading ? (
                        <p className="text-gray-400">Loading sessions...</p>
                    ) : sessions.length === 0 ? (
                        <p className="text-gray-400">No active sessions found.</p>
                    ) : (
                        <div className="space-y-3">
                            {sessions.slice(0, 8).map((session) => (
                                <div key={session.id} className="border border-gray-700 rounded-lg p-3 flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        <Smartphone className="w-5 h-5 text-gray-400 mt-0.5" />
                                        <div>
                                            <p className="text-white text-sm">
                                                {parseDevice(session.userAgent || '')}
                                                {currentSessionId === session.id && (
                                                    <span className="ml-2 px-2 py-0.5 text-[10px] bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">Current</span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {parseBrowser(session.userAgent || '')} • {session.ipAddress} • Started {new Date(session.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => revokeSession(session.id)}
                                        disabled={revokingSessionId === session.id}
                                        className="text-red-400 hover:text-red-300 text-sm"
                                    >
                                        {revokingSessionId === session.id ? 'Revoking...' : 'Log Out'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4">
                    <p className="text-blue-300 text-sm flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {isOperator
                            ? 'Enforce MFA for all operator accounts and review sessions regularly to protect platform operations.'
                            : 'Keep MFA enabled and regularly review sessions to protect your investor account.'}
                    </p>
                </div>
            </div>
        </DashboardLayout>
    )
}

function PolicyItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-3 py-2">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-sm text-white font-medium mt-1">{value}</p>
        </div>
    )
}
