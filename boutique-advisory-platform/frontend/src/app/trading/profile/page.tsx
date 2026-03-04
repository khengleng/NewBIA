'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import { authorizedRequest } from '../../../lib/api'
import { useToast } from '../../../contexts/ToastContext'

interface TraderProfileResponse {
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

export default function TradingProfilePage() {
    const { addToast } = useToast()
    const [profile, setProfile] = useState<TraderProfileResponse | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [sectorInput, setSectorInput] = useState('')

    useEffect(() => {
        const fetchProfile = async () => {
            const response = await authorizedRequest('/api/secondary-trading/trader-profile')
            if (!response.ok) {
                addToast('error', 'Failed to load trader profile')
                return
            }

            const data = await response.json()
            setProfile(data)
            setSectorInput((data.profile?.preferredSectors || []).join(', '))
        }

        fetchProfile()
    }, [addToast])

    const handleSave = async () => {
        if (!profile) return
        setIsSaving(true)

        const preferredSectors = sectorInput
            .split(',')
            .map(v => v.trim())
            .filter(Boolean)
            .slice(0, 10)

        const response = await authorizedRequest('/api/secondary-trading/trader-profile', {
            method: 'PUT',
            body: JSON.stringify({
                ...profile.profile,
                preferredSectors
            })
        })

        setIsSaving(false)
        if (!response.ok) {
            addToast('error', 'Failed to update trader profile')
            return
        }

        addToast('success', 'Trader profile updated')
    }

    if (!profile) {
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
                    <h1 className="text-3xl font-bold text-white">Trader Profile</h1>
                    <p className="text-gray-400 mt-1">Configure your risk, strategy, and trading notifications.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">Trader Name</p>
                        <p className="text-white font-semibold">{profile.investor?.name || 'Investor'}</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">KYC Status</p>
                        <p className="text-white font-semibold">{profile.investor?.kycStatus || 'PENDING'}</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">Watchlist Items</p>
                        <p className="text-white font-semibold">{profile.profile.watchlistCount || 0}</p>
                    </div>
                </div>

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
                        <label className="block text-sm text-gray-300 mb-2">Preferred Sectors (comma-separated)</label>
                        <input
                            type="text"
                            value={sectorInput}
                            onChange={(e) => setSectorInput(e.target.value)}
                            placeholder="Fintech, Agriculture, Energy"
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                        />
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
                        {isSaving ? 'Saving...' : 'Save Trader Profile'}
                    </button>
                </div>
            </div>
        </DashboardLayout>
    )
}
