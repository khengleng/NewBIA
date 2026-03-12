'use client'

import React, { useMemo, useState } from 'react'
import { CheckCircle2, Clock3, ShieldCheck, X } from 'lucide-react'

interface SumsubKycProps {
    onClose: () => void
    onComplete?: () => void
}

type MockStatus = 'IDLE' | 'RUNNING' | 'REVIEW' | 'APPROVED'

export default function SumsubKyc({ onClose, onComplete }: SumsubKycProps) {
    const [status, setStatus] = useState<MockStatus>('IDLE')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const statusMeta = useMemo(() => {
        if (status === 'APPROVED') {
            return {
                label: 'Approved',
                description: 'Identity verification has been completed in mock mode.',
                className: 'text-green-300'
            }
        }

        if (status === 'REVIEW') {
            return {
                label: 'Needs Review',
                description: 'Submitted for manual compliance review in mock mode.',
                className: 'text-amber-300'
            }
        }

        if (status === 'RUNNING') {
            return {
                label: 'In Progress',
                description: 'Mock verification checks are running.',
                className: 'text-blue-300'
            }
        }

        return {
            label: 'Not Started',
            description: 'Start mock identity verification for testing.',
            className: 'text-gray-300'
        }
    }, [status])

    const runMock = async (target: Exclude<MockStatus, 'IDLE' | 'RUNNING'>) => {
        setIsSubmitting(true)
        setStatus('RUNNING')
        await new Promise((resolve) => setTimeout(resolve, 900))
        setStatus(target)
        setIsSubmitting(false)

        if (target === 'APPROVED') {
            onComplete?.()
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-700 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-900/50">
                    <h3 className="text-white font-bold">Identity Verification (Mock)</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-2" type="button">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                        <p className="text-blue-200 text-sm">
                            Mock mode is active. No Sumsub API call is made and no real KYC decision is issued.
                        </p>
                    </div>

                    <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-4">
                        <p className={`font-semibold ${statusMeta.className}`}>{statusMeta.label}</p>
                        <p className="text-gray-300 text-sm mt-1">{statusMeta.description}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-lg bg-gray-900/50 border border-gray-700 p-3">
                            <div className="flex items-center gap-2 text-gray-200 text-sm font-medium">
                                <ShieldCheck className="w-4 h-4 text-blue-400" />
                                Document Check
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Passport/ID upload simulated</p>
                        </div>
                        <div className="rounded-lg bg-gray-900/50 border border-gray-700 p-3">
                            <div className="flex items-center gap-2 text-gray-200 text-sm font-medium">
                                <Clock3 className="w-4 h-4 text-amber-400" />
                                Face Match
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Liveness flow simulated</p>
                        </div>
                        <div className="rounded-lg bg-gray-900/50 border border-gray-700 p-3">
                            <div className="flex items-center gap-2 text-gray-200 text-sm font-medium">
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                                Final Decision
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Compliance result simulated</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => void runMock('APPROVED')}
                            disabled={isSubmitting}
                            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white font-semibold"
                        >
                            {isSubmitting ? 'Processing...' : 'Mark Verified'}
                        </button>
                        <button
                            type="button"
                            onClick={() => void runMock('REVIEW')}
                            disabled={isSubmitting}
                            className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white font-semibold"
                        >
                            Send to Review
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-white font-semibold"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
