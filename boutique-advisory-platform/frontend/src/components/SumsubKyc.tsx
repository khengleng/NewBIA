'use client'

import React, { useState } from 'react'
import SumsubWebSdk from '@sumsub/websdk-react'
import { authorizedRequest } from '../lib/api'
import { X } from 'lucide-react'

interface SumsubKycProps {
    onClose: () => void
    onComplete?: () => void
}

export default function SumsubKyc({ onClose, onComplete }: SumsubKycProps) {
    const [token, setToken] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const getFriendlyError = (status: number, apiError?: string) => {
        switch (status) {
            case 401:
                return 'Your session has expired. Please sign in again and retry verification.'
            case 403:
                return 'This account is not allowed to start identity verification.'
            case 404:
                return 'Your investor profile is not ready yet. Please complete your profile first.'
            case 503:
                return 'Identity verification is temporarily unavailable. Please try again shortly.'
            default:
                return apiError || 'We could not start verification right now. Please try again.'
        }
    }

    const fetchToken = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await authorizedRequest('/api/investors/kyc-token', { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                setToken(data.token);
            } else {
                const payload = await response.json().catch(() => ({}));
                setError(getFriendlyError(response.status, payload?.error));
            }
        } catch {
            setError('Connection error. Please check your internet.');
        } finally {
            setIsLoading(false);
        }
    }

    React.useEffect(() => {
        fetchToken();
    }, []);

    const onMessage = (type: string, payload: any) => {
        console.log('Sumsub Message:', type, payload);
        if (type === 'idCheck.onApplicantStatusChanged' && payload.reviewStatus === 'completed') {
            if (onComplete) onComplete();
        }
    };

    const onError = (error: any) => {
        console.error('Sumsub Error:', error);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-800 border border-gray-700 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-900/50">
                    <h3 className="text-white font-bold">Identity Verification</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden relative bg-[#F4F7F9]">
                    {isLoading && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center space-y-4 bg-gray-800">
                            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                            <p className="text-gray-400 font-medium">Initializing Secure Session...</p>
                        </div>
                    )}

                    {error ? (
                        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-8 text-center bg-gray-800">
                            <p className="text-red-400 font-bold mb-2">Unable to start verification</p>
                            <p className="text-gray-300 mb-5 max-w-md">{error}</p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={fetchToken}
                                    className="bg-blue-600 px-6 py-2 rounded-xl text-white font-bold"
                                >
                                    Try Again
                                </button>
                                <button
                                    onClick={onClose}
                                    className="bg-gray-700 px-6 py-2 rounded-xl text-white font-bold"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    ) : token && (
                        <div className="h-full w-full">
                            <SumsubWebSdk
                                accessToken={token}
                                expirationHandler={fetchToken}
                                onMessage={onMessage}
                                onError={onError}
                                config={{
                                    lang: 'en',
                                    i18n: {
                                        en: {
                                            "header.title": "Verification for Boutique Advisory Platform"
                                        }
                                    }
                                }}
                                options={{
                                    addViewportTag: true,
                                    adaptIframeHeight: true
                                }}
                                style={{ height: '100%', width: '100%' }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
