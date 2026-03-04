'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { authorizedRequest } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { CheckCircle, Shield, Smartphone, XCircle } from 'lucide-react'

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

export default function TradingSecurityPage() {
    const { addToast } = useToast()
    const [isLoading, setIsLoading] = useState(true)
    const [roleLabel, setRoleLabel] = useState('Investor')
    const [accountEmail, setAccountEmail] = useState('')
    const [is2faEnabled, setIs2faEnabled] = useState(false)
    const [sessions, setSessions] = useState<Session[]>([])
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
    const [twoFaSetup, setTwoFaSetup] = useState<TwoFaSetup | null>(null)

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [twoFaCode, setTwoFaCode] = useState('')
    const [disable2faPassword, setDisable2faPassword] = useState('')

    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [isSettingUp2fa, setIsSettingUp2fa] = useState(false)
    const [isActivating2fa, setIsActivating2fa] = useState(false)
    const [isDisabling2fa, setIsDisabling2fa] = useState(false)
    const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const [meRes, sessionsRes] = await Promise.all([
                    authorizedRequest('/api/auth/me'),
                    authorizedRequest('/api/auth/sessions')
                ])

                if (meRes.ok) {
                    const me = await meRes.json()
                    setIs2faEnabled(Boolean(me?.user?.twoFactorEnabled))
                    setAccountEmail(me?.user?.email || '')
                    const role = String(me?.user?.role || '').toUpperCase()
                    setRoleLabel(role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'SUPPORT' ? 'Operator' : 'Investor')
                }

                if (sessionsRes.ok) {
                    const data = await sessionsRes.json()
                    setSessions(Array.isArray(data.sessions) ? data.sessions : [])
                    setCurrentSessionId(data.currentSessionId || null)
                }
            } catch (error) {
                console.error('Failed loading investor security data', error)
                addToast('error', 'Failed to load investor security settings')
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
                    <p className="text-gray-400 mt-1">Manage password, MFA/2FA, active sessions, and account protection.</p>
                </div>

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
                                                {session.userAgent || 'Unknown device'}
                                                {currentSessionId === session.id && (
                                                    <span className="ml-2 px-2 py-0.5 text-[10px] bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">Current</span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-400">{session.ipAddress} • Started {new Date(session.createdAt).toLocaleString()}</p>
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
                        Keep MFA enabled and regularly review sessions to protect your investor account.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    )
}
