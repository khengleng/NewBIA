'use client'

import { useState, useEffect } from 'react'
import {
    ShieldCheck,
    CheckCircle,
    AlertCircle,
    Lock,
} from 'lucide-react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useToast } from '../../contexts/ToastContext'
import { authorizedRequest } from '../../lib/api'
import SumsubKyc from '../../components/SumsubKyc'

export default function KYCPage() {
    const { addToast } = useToast()
    const [kycStatus, setKycStatus] = useState<string>('PENDING')
    const [showSumsub, setShowSumsub] = useState(false)

    useEffect(() => {
        const fetchKycStatus = async () => {
            try {
                const response = await authorizedRequest('/api/investors/profile')
                if (response.ok) {
                    const data = await response.json()
                    setKycStatus(data.investor?.kycStatus || 'PENDING')
                }
            } catch (error) {
                console.error('Error fetching KYC status:', error)
            }
        }
        fetchKycStatus()
    }, [])

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Lock className="w-8 h-8 text-green-400" />
                        Investor Verification (KYC)
                    </h1>
                    <p className="text-gray-400 mt-2">To comply with financial regulations and access high-value deals, please verify your identity.</p>
                </div>

                {kycStatus === 'VERIFIED' ? (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center">
                        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">You are Verified!</h2>
                        <p className="text-gray-400">Your account is fully compliant. You have unrestricted access to the deal marketplace.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 space-y-8 flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
                                    <ShieldCheck className="w-10 h-10 text-green-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Identity Verification (Mock)</h2>
                                    <p className="text-gray-400 max-w-md mx-auto">
                                        Mock KYC mode is enabled for testing. This flow does not call external KYC providers and no real verification decision is issued.
                                    </p>
                                </div>

                                <div className="w-full space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-left">
                                        <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Method</p>
                                            <p className="text-sm text-white font-medium">Mock Decision</p>
                                        </div>
                                        <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Time</p>
                                            <p className="text-sm text-white font-medium">~1 Minute</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowSumsub(true)}
                                        disabled={kycStatus === 'UNDER_REVIEW'}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-green-900/40 disabled:opacity-50 flex items-center justify-center gap-3 text-lg"
                                    >
                                        <ShieldCheck className="w-6 h-6" />
                                        {kycStatus === 'UNDER_REVIEW' ? 'Review in Progress' : 'Start Mock Verification'}
                                    </button>
                                </div>

                                <p className="text-xs text-gray-500">
                                    By clicking start, you agree to our processing of your identity data for compliance purposes.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6">
                                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                                    Why Verify?
                                </h3>
                                <ul className="space-y-3 text-sm text-gray-400">
                                    <li className="flex gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        Access exclusive deals
                                    </li>
                                    <li className="flex gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        Participate in Syndicates
                                    </li>
                                    <li className="flex gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        Direct Messaging with CEOs
                                    </li>
                                    <li className="flex gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        Priority Support
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6">
                                <h3 className="text-yellow-400 font-bold mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    Testing Note
                                </h3>
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    This is a non-production test flow. Use it to validate UX and permissions before enabling live KYC provider integration.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showSumsub && (
                <SumsubKyc
                    onClose={() => setShowSumsub(false)}
                    onComplete={() => {
                        setShowSumsub(false);
                        setKycStatus('UNDER_REVIEW');
                        addToast('success', 'Identity verification submitted. We will review it shortly.');
                    }}
                />
            )}
        </DashboardLayout>
    )
}
