'use client';

import { useState, useEffect } from 'react';
import {
    Send,
    Users,
    Wifi,
    WifiOff,
    AlertCircle,
    CheckCircle2,
    MessageSquare,
    Loader2,
    Database,
    ExternalLink,
    Settings,
    ShieldCheck,
    Lock
} from 'lucide-react';
import { authorizedRequest } from '@/lib/api';

export default function AdminBotPage() {
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showSetup, setShowSetup] = useState(false);
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');

    // Token Setup State
    const [newToken, setNewToken] = useState('');
    const [isUpdatingToken, setIsUpdatingToken] = useState(false);

    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            const response = await authorizedRequest('/api/admin/bot/stats');
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch bot stats', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateToken = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newToken) return;

        setIsUpdatingToken(true);
        setFeedback(null);

        try {
            const response = await authorizedRequest('/api/admin/bot/config', {
                method: 'POST',
                body: JSON.stringify({ token: newToken })
            });

            if (response.ok) {
                setFeedback({
                    type: 'success',
                    message: 'Bot token updated and live-reloaded successfully!'
                });
                setNewToken('');
                fetchStats();
            } else {
                setFeedback({
                    type: 'error',
                    message: 'Failed to update token. Please check backend logs.'
                });
            }
        } catch (error) {
            setFeedback({
                type: 'error',
                message: 'Connection error while updating token.'
            });
        } finally {
            setIsUpdatingToken(false);
        }
    };

    const handleBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!broadcastMessage) return;

        setIsBroadcasting(true);
        setFeedback(null);

        try {
            const response = await authorizedRequest('/api/admin/bot/broadcast', {
                method: 'POST',
                body: JSON.stringify({
                    title: broadcastTitle || 'Admin Broadcast',
                    message: broadcastMessage
                })
            });

            if (response.ok) {
                const data = await response.json();
                setFeedback({
                    type: 'success',
                    message: `Broadcast sent successfully to ${data.recipients || 0} users!`
                });
                setBroadcastMessage('');
                setBroadcastTitle('');
            } else {
                setFeedback({
                    type: 'error',
                    message: 'Failed to send broadcast. Check Bot Service status.'
                });
            }
        } catch (error) {
            setFeedback({
                type: 'error',
                message: 'An unexpected error occurred during broadcast.'
            });
        } finally {
            setIsBroadcasting(false);
        }
    };

    if (isLoading && !stats) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-blue-400" />
                        Telegram Bot Management
                    </h1>
                    <p className="text-gray-400 mt-1">Manage the SMEs Trading companion bot and broadcasts.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowSetup(!showSetup)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${showSetup
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                    >
                        {showSetup ? 'View Dashboard' : 'Configure Token'}
                    </button>
                    <button
                        onClick={fetchStats}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {feedback && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${feedback.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}>
                    {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="text-sm font-medium">{feedback.message}</span>
                </div>
            )}

            {showSetup ? (
                <div className="space-y-6">
                    {/* Token Update Card */}
                    <div className="bg-gray-800 border border-gray-700 rounded-3xl overflow-hidden">
                        <div className="p-8 border-b border-gray-700 bg-gray-900/40 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Lock className="w-5 h-5 text-blue-400" />
                                    Dynamic Bot Token
                                </h2>
                                <p className="text-sm text-gray-400">Update your bot credentials instantly without redeploying.</p>
                            </div>
                            {stats?.hasCustomToken && (
                                <div className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full flex items-center gap-2">
                                    <ShieldCheck className="w-3 h-3 text-green-400" />
                                    <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Active Custom Token</span>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleUpdateToken} className="p-8 space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                    New Telegram API Token
                                </label>
                                <div className="flex gap-4">
                                    <input
                                        type="password"
                                        value={newToken}
                                        onChange={(e) => setNewToken(e.target.value)}
                                        placeholder="Paste token from @BotFather..."
                                        className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isUpdatingToken || !newToken}
                                        className={`px-6 py-3 rounded-xl font-bold transition-all ${isUpdatingToken || !newToken
                                            ? 'bg-gray-700 text-gray-500'
                                            : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                                            }`}
                                    >
                                        {isUpdatingToken ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Apply Token'}
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-4 leading-relaxed">
                                    * This token is saved securely in the database. Updating here will bypass the Railway environment variable and re-initialize the companion service immediately.
                                </p>
                            </div>
                        </form>
                    </div>

                    {/* Guide Card */}
                    <div className="bg-blue-600/10 border border-blue-500/20 rounded-3xl p-8 space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <Settings className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Bot Configuration Guide</h2>
                                <p className="text-blue-200/70 text-sm mt-1">First time setting up? Follow these steps.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Step 1: Get Token</h3>
                                <div className="bg-gray-900/50 rounded-2xl p-4 text-sm text-gray-300 border border-gray-700">
                                    Open <a href="https://t.me/botfather" target="_blank" className="text-blue-400 font-bold underline">@BotFather</a> on Telegram, create a new bot, and copy the <b>API Token</b>.
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Step 2: Authenticate</h3>
                                <div className="bg-gray-900/50 rounded-2xl p-4 text-sm text-gray-300 border border-gray-700">
                                    Paste the token in the form above and click <b>Apply Token</b>. The dashboard status should turn green within seconds.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Status Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-400">Service Status</span>
                                {stats?.serviceHealth === 'online' ? (
                                    <Wifi className="w-4 h-4 text-green-400" />
                                ) : (
                                    <WifiOff className="w-4 h-4 text-red-400" />
                                )}
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-2xl font-bold ${stats?.serviceHealth === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                                    {stats?.serviceHealth || 'Unknown'}
                                </span>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-widest leading-none">
                                Companion Microservice
                            </p>
                        </div>

                        <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-400">Linked Users</span>
                                <Users className="w-4 h-4 text-blue-400" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-white">
                                    {stats?.linkedUsersCount || 0}
                                </span>
                                <span className="text-sm text-gray-500 text-xs">Investors</span>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-widest leading-none">
                                Active Portfolios
                            </p>
                        </div>

                        <div className="bg-gray-800/50 border border-gray-700 p-6 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-400">Bot CLI</span>
                                <Database className="w-4 h-4 text-purple-400" />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white truncate">
                                    @{stats?.botUsername || 'CamboBiaBot'}
                                </span>
                                <a
                                    href={`https://t.me/${stats?.botUsername || 'CamboBiaBot'}`}
                                    target="_blank"
                                    className="p-1 text-gray-500 hover:text-white"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-widest leading-none">
                                Telegram Namespace
                            </p>
                        </div>
                    </div>

                    {/* Broadcast Section */}
                    <div className="bg-gray-800 border border-gray-700 rounded-3xl overflow-hidden">
                        <div className="p-8 border-b border-gray-700 bg-gray-900/40">
                            <h2 className="text-xl font-bold text-white mb-2">System Broadcast</h2>
                            <p className="text-sm text-gray-400">Send an immediate push notification to all linked Telegram participants.</p>
                        </div>

                        <form onSubmit={handleBroadcast} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                        Broadcast Title
                                    </label>
                                    <input
                                        type="text"
                                        value={broadcastTitle}
                                        onChange={(e) => setBroadcastTitle(e.target.value)}
                                        placeholder="e.g. Market Update"
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                                        Message Body (Markdown Supported)
                                    </label>
                                    <textarea
                                        rows={4}
                                        value={broadcastMessage}
                                        onChange={(e) => setBroadcastMessage(e.target.value)}
                                        placeholder="Enter system update or investment alert..."
                                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={isBroadcasting || !broadcastMessage}
                                    className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold transition-all ${isBroadcasting || !broadcastMessage
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                                        }`}
                                >
                                    {isBroadcasting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Send className="w-5 h-5" />
                                    )}
                                    {isBroadcasting ? 'Broadcasting...' : 'Dispatch Broadcast'}
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
}

function RefreshCw(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
        </svg>
    )
}
