'use client';

import { useEffect } from 'react';

export default function OfflinePage() {
    useEffect(() => {
        // Check if we're back online
        const handleOnline = () => {
            window.location.reload();
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center">
                {/* Offline Icon */}
                <div className="mb-8">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                        <svg
                            className="w-12 h-12 text-blue-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656m-7.072 7.072a4 4 0 010-5.656m-3.536 9.192a9 9 0 010-12.728"
                            />
                            <line
                                x1="4"
                                y1="4"
                                x2="20"
                                y2="20"
                                strokeLinecap="round"
                                strokeWidth={2}
                                className="text-red-400"
                            />
                        </svg>
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-white mb-4">
                    You&apos;re Offline
                </h1>

                {/* Description */}
                <p className="text-slate-400 mb-8 leading-relaxed">
                    It looks like you&apos;ve lost your internet connection.
                    Don&apos;t worry, some features are still available offline.
                    We&apos;ll reconnect automatically when you&apos;re back online.
                </p>

                {/* Status Indicator */}
                <div className="flex items-center justify-center space-x-2 mb-8">
                    <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
                    <span className="text-amber-400 text-sm font-medium">
                        Waiting for connection...
                    </span>
                </div>

                {/* Retry Button */}
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                >
                    Try Again
                </button>

                {/* Tips */}
                <div className="mt-12 text-left bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                    <h3 className="text-white font-semibold mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Available Offline
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li className="flex items-center">
                            <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            View cached pages and data
                        </li>
                        <li className="flex items-center">
                            <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Access previously loaded SME profiles
                        </li>
                        <li className="flex items-center">
                            <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Review saved investor information
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
