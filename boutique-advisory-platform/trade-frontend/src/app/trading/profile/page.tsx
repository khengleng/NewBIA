'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'
import usePermissions from '../../../hooks/usePermissions'
import { isTradingOperatorRole, normalizeRole } from '../../../lib/roles'

interface TraderProfileResponse {
    mode?: 'TRADER' | 'OPERATOR'
    operator?: {
        userId?: string
        role?: string
        tenantId?: string
    }
    investor?: {
        id: string
        name: string
        type: string
        kycStatus: string
    }
    profile: {
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
        investmentHorizon: 'SHORT' | 'MID' | 'LONG'
        strategy: 'VALUE' | 'GROWTH' | 'MOMENTUM' | 'INCOME' | 'MIXED'
        maxPositionSize: number
        preferredSectors: string[]
        notifications: {
            priceAlerts: boolean
            executionUpdates: boolean
            marketAnnouncements: boolean
        }
        watchlistCount?: number
    }
}

const SECTOR_OPTIONS = [
    'Fintech',
    'Agriculture',
    'Energy',
    'Healthcare',
    'Manufacturing',
    'Retail',
    'Logistics',
    'Education',
    'Real Estate',
    'Technology'
]

export default function TradingProfilePage() {
    const { user, isLoading: isRoleLoading } = usePermissions()
    const { addToast } = useToast()
    const [profile, setProfile] = useState<TraderProfileResponse | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const isOperatorMode = profile?.mode === 'OPERATOR'

    useEffect(() => {
        if (isRoleLoading) return
        const role = normalizeRole(user?.role)
        const isOperator = isTradingOperatorRole(role)

        if (isOperator) {
            setProfile({
                mode: 'OPERATOR',
                operator: {
                    userId: user?.id,
                    role,
                    tenantId: user?.tenantId
                },
                profile: {
                    riskLevel: 'MEDIUM',
                    investmentHorizon: 'MID',
                    strategy: 'VALUE',
                    maxPositionSize: 10,
                    preferredSectors: [],
                    notifications: {
                        priceAlerts: true,
                        executionUpdates: true,
                        marketAnnouncements: true
                    },
                    watchlistCount: 0
                }
            })
            return
        }

        const fetchProfile = async () => {
            const response = await authorizedRequest('/api/secondary-trading/trader-profile')
            if (!response.ok) {
                if (response.status === 404) {
                    setProfile({
                        mode: isOperator ? 'OPERATOR' : 'TRADER',
                        operator: isOperator ? {
                            userId: user?.id,
                            role,
                            tenantId: user?.tenantId
                        } : undefined,
                        investor: isOperator ? undefined : {
                            id: user?.id || '',
                            name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Investor',
                            type: 'INDIVIDUAL',
                            kycStatus: 'PENDING',
                        },
                        profile: {
                            riskLevel: 'MEDIUM',
                            investmentHorizon: 'MID',
                            strategy: 'VALUE',
                            maxPositionSize: 10,
                            preferredSectors: [],
                            notifications: {
                                priceAlerts: true,
                                executionUpdates: true,
                                marketAnnouncements: true
                            },
                            watchlistCount: 0
                        }
                    })
                    return
                }
                if (isOperator) {
                    setProfile({
                        mode: 'OPERATOR',
                        operator: {
                            userId: user?.id,
                            role,
                            tenantId: user?.tenantId
                        },
                        profile: {
                            riskLevel: 'MEDIUM',
                            investmentHorizon: 'MID',
                            strategy: 'VALUE',
                            maxPositionSize: 10,
                            preferredSectors: [],
                            notifications: {
                                priceAlerts: true,
                                executionUpdates: true,
                                marketAnnouncements: true
                            },
                            watchlistCount: 0
                        }
                    })
                    return
                }
                addToast('error', 'Failed to load trader profile')
                return
            }

            const data = await response.json()
            setProfile(data)
        }

        fetchProfile()
    }, [addToast, isRoleLoading, user?.id, user?.role, user?.tenantId])

    const handleSave = async () => {
        if (!profile || isOperatorMode) return
        setIsSaving(true)

        const response = await authorizedRequest('/api/secondary-trading/trader-profile', {
            method: 'PUT',
            body: JSON.stringify({
                ...profile.profile,
                preferredSectors: profile.profile.preferredSectors || []
            })
        })

        setIsSaving(false)
        if (!response.ok) {
            addToast('error', 'Failed to update investor profile')
            return
        }

        addToast('success', 'Investor profile updated')
    }

    if (isRoleLoading || !profile) {
        return (
            <DashboardLayout>
                <div className="text-gray-300">Loading trader profile...</div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">{isOperatorMode ? 'Operator Profile' : 'Investor Profile'}</h1>
                    <p className="text-gray-400 mt-1">
                        {isOperatorMode
                            ? 'Superadmin/admin accounts operate the marketplace and do not use trader preference settings.'
                            : 'Configure your risk, strategy, and trading notifications.'}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">{isOperatorMode ? 'Operator Role' : 'Trader Name'}</p>
                        <p className="text-white font-semibold">{isOperatorMode ? (profile.operator?.role || 'OPERATOR') : (profile.investor?.name || 'Investor')}</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">{isOperatorMode ? 'Tenant' : 'KYC Status'}</p>
                        <p className="text-white font-semibold">{isOperatorMode ? (profile.operator?.tenantId || 'N/A') : (profile.investor?.kycStatus || 'PENDING')}</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">{isOperatorMode ? 'Profile Mode' : 'Watchlist Items'}</p>
                        <p className="text-white font-semibold">{profile.profile.watchlistCount || 0}</p>
                    </div>
                </div>

                {isOperatorMode && (
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                        <h2 className="text-lg font-semibold text-white mb-2">Operator Access</h2>
                        <p className="text-sm text-gray-300">
                            Use Trading Operations, Market Monitor, Cases, and Platform Security from the left navigation.
                            Trader preference and watchlist settings are only for investor/trader accounts.
                        </p>
                    </div>
                )}

                {!isOperatorMode && (
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-300 mb-2">Risk Level</label>
                            <select
                                value={profile.profile.riskLevel}
                                onChange={(e) => setProfile(prev => prev ? { ...prev, profile: { ...prev.profile, riskLevel: e.target.value as TraderProfileResponse['profile']['riskLevel'] } } : prev)}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                            >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-2">Investment Horizon</label>
                            <select
                                value={profile.profile.investmentHorizon}
                                onChange={(e) => setProfile(prev => prev ? { ...prev, profile: { ...prev.profile, investmentHorizon: e.target.value as TraderProfileResponse['profile']['investmentHorizon'] } } : prev)}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                            >
                                <option value="SHORT">Short Term</option>
                                <option value="MID">Mid Term</option>
                                <option value="LONG">Long Term</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-300 mb-2">Trading Strategy</label>
                            <select
                                value={profile.profile.strategy}
                                onChange={(e) => setProfile(prev => prev ? { ...prev, profile: { ...prev.profile, strategy: e.target.value as TraderProfileResponse['profile']['strategy'] } } : prev)}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                            >
                                <option value="VALUE">Value</option>
                                <option value="GROWTH">Growth</option>
                                <option value="MOMENTUM">Momentum</option>
                                <option value="INCOME">Income</option>
                                <option value="MIXED">Mixed</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-300 mb-2">Max Position Size (%)</label>
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={profile.profile.maxPositionSize}
                                onChange={(e) => setProfile(prev => prev ? { ...prev, profile: { ...prev.profile, maxPositionSize: Number(e.target.value) } } : prev)}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-300 mb-2">Preferred Sectors</label>
                        <select
                            multiple
                            value={profile.profile.preferredSectors || []}
                            onChange={(e) => {
                                const selected = Array.from(e.target.selectedOptions).map((option) => option.value).slice(0, 10)
                                setProfile(prev => prev ? { ...prev, profile: { ...prev.profile, preferredSectors: selected } } : prev)
                            }}
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white min-h-36"
                        >
                            {SECTOR_OPTIONS.map((sector) => (
                                <option key={sector} value={sector}>{sector}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-2">Hold `Ctrl`/`Cmd` to choose multiple sectors.</p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm text-gray-300">Notifications</p>
                        {[
                            ['priceAlerts', 'Price alerts'],
                            ['executionUpdates', 'Execution updates'],
                            ['marketAnnouncements', 'Market announcements']
                        ].map(([key, label]) => (
                            <label key={key} className="flex items-center gap-3 text-sm text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={Boolean(profile.profile.notifications[key as keyof TraderProfileResponse['profile']['notifications']])}
                                    onChange={(e) => setProfile(prev => prev ? {
                                        ...prev,
                                        profile: {
                                            ...prev.profile,
                                            notifications: {
                                                ...prev.profile.notifications,
                                                [key]: e.target.checked
                                            }
                                        }
                                    } : prev)}
                                    className="rounded bg-gray-900 border-gray-600 text-blue-500"
                                />
                                {label}
                            </label>
                        ))}
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg"
                    >
                        {isSaving ? 'Saving...' : 'Save Investor Profile'}
                    </button>
                </div>
                )}
            </div>
        </DashboardLayout>
    )
}
