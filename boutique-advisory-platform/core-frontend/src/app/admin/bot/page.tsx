'use client';

import { useState, useEffect } from 'react';
import {
    Send,
    Users,
    AlertCircle,
    CheckCircle2,
    MessageSquare,
    Loader2,
    Settings,
    ShieldCheck,
    Lock,
    RefreshCw,
    Terminal,
    Info
} from 'lucide-react';
import { authorizedRequest } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';

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
                setShowSetup(false);
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

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto space-y-12 pb-20">
                {/* Header Branding Section - MATCHES LAUNCHPAD */}
                <section className="bg-gray-800 border border-gray-700 rounded-xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <MessageSquare className="w-32 h-32 text-blue-400" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <MessageSquare className="w-8 h-8 text-blue-400" />
                                Telegram Bot Command Center
                            </h1>
                            <p className="text-gray-400 mt-2 max-w-2xl">
                                System-wide companion service governance. Orchestrate real-time investor connectivity,
                                secure credential management, and cryptographic broadcast dissemination.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowSetup(!showSetup)}
                                className={`px-6 py-3 rounded-lg font-bold transition-all flex items-center gap-2 ${showSetup
                                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20'
                                    : 'bg-gray-900 text-gray-300 border border-gray-700 hover:border-gray-600'
                                    }`}
                            >
                                <Settings className="w-5 h-5" />
                                {showSetup ? 'View Operations' : 'Security Settings'}
                            </button>
                            <button
                                onClick={fetchStats}
                                className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Sub-Metrics Grid - MATCHES LAUNCHPAD (4 Cols) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Gateway Health</p>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${stats?.serviceHealth === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                        </div>
                        <p className={`text-2xl font-bold ${stats?.serviceHealth === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                            {stats?.serviceHealth === 'online' ? 'Operational' : 'Disconnected'}
                        </p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Connected Nodes</p>
                        <p className="text-2xl font-bold text-white">{stats?.linkedUsersCount || 0}</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Namespace Binding</p>
                        <p className="text-xl font-bold text-blue-400 truncate">@{stats?.botUsername || 'CamboBiaBot'}</p>
                    </div>
                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Protocol Layer</p>
                        <p className="text-2xl font-bold text-purple-400">{stats?.hasCustomToken ? 'Secure DB' : 'Env Fallback'}</p>
                    </div>
                </div>

                {/* Main Action Layer */}
                <div className="space-y-8">
                    {feedback && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${feedback.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                            }`}>
                            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            <span className="text-sm font-medium">{feedback.message}</span>
                        </div>
                    )}

                    {showSetup ? (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-700 pb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Credential Hardening</h2>
                                    <p className="text-sm text-gray-500">Configure dynamic API gateways for the bot service.</p>
                                </div>
                            </div>

                            <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-8 space-y-8 shadow-2xl">
                                <div className="max-w-3xl space-y-6">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-3">
                                        <Lock className="w-5 h-5 text-blue-400" />
                                        Token Authorization
                                    </h3>

                                    <form onSubmit={handleUpdateToken} className="space-y-6">
                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                                Active Bot API Token
                                            </label>
                                            <div className="flex gap-4">
                                                <input
                                                    type="password"
                                                    value={newToken}
                                                    onChange={(e) => setNewToken(e.target.value)}
                                                    placeholder="123456789:ABCDEF..."
                                                    className="flex-1 bg-gray-900 border border-gray-700 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono shadow-inner"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={isUpdatingToken || !newToken}
                                                    className={`px-8 py-4 rounded-2xl font-bold transition-all flex items-center gap-2 ${isUpdatingToken || !newToken
                                                        ? 'bg-gray-800 text-gray-600'
                                                        : 'bg-blue-600 text-white hover:bg-blue-500 shadow-xl shadow-blue-600/30 active:scale-95'
                                                        }`}
                                                >
                                                    {isUpdatingToken ? <Loader2 className="w-5 h-5 animate-spin" /> : <Terminal className="w-4 h-4" />}
                                                    {isUpdatingToken ? 'Syncing...' : 'Deploy Protocol'}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-gray-500 italic mt-2">
                                                <AlertCircle className="w-3 h-3 text-amber-500" />
                                                Updating this token triggers an immediate session reload across all bot nodes.
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            </div>

                            <div className="bg-blue-600/5 border border-blue-500/10 rounded-2xl p-8 flex items-start gap-6">
                                <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Info className="w-6 h-6 text-blue-400" />
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-white">Manual Setup Guide</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <p className="text-sm text-gray-400 leading-relaxed">
                                            <b>1. Register Name:</b> Visit <a href="https://t.me/botfather" target="_blank" className="text-blue-400 font-bold underline">@BotFather</a> and create a unique identifier for your bot.
                                        </p>
                                        <p className="text-sm text-gray-400 leading-relaxed">
                                            <b>2. Bind Token:</b> Apply the provided credential string above to bypass Railway environment variables and use the platform database.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-12 animate-in fade-in duration-500">
                            {/* Operational Header - MATCHES LAUNCHPAD */}
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-700 pb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Network Broadcast Queue</h2>
                                    <p className="text-sm text-gray-500">Dispatch system-wide notifications to all linked participants.</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-widest bg-blue-600/10 px-3 py-1 rounded-full border border-blue-500/20">
                                    <Users className="w-3 h-3" />
                                    <span>{stats?.linkedUsersCount || 0} Registered Listeners</span>
                                </div>
                            </div>

                            <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl overflow-hidden shadow-2xl">
                                <form onSubmit={handleBroadcast} className="p-10 space-y-10">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                                    Broadcast Subject
                                                </label>
                                                <input
                                                    type="text"
                                                    value={broadcastTitle}
                                                    onChange={(e) => setBroadcastTitle(e.target.value)}
                                                    placeholder="e.g. Portfolio Rebalancing Alert"
                                                    className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                                                />
                                            </div>

                                            <div className="bg-blue-600/5 border border-blue-500/10 rounded-2xl p-6">
                                                <p className="text-xs text-blue-300/70 leading-relaxed">
                                                    <b>Network Logic:</b> This message will be pushed instantly to all users linked via the companion bot.
                                                    Use Markdown like `*bold*` or `_italic_` for improved legibility.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                                Content Protocol (Markdown)
                                            </label>
                                            <textarea
                                                rows={6}
                                                value={broadcastMessage}
                                                onChange={(e) => setBroadcastMessage(e.target.value)}
                                                placeholder="Enter system announcement or investment disclosure..."
                                                className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[220px] transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-8 border-t border-gray-700/50">
                                        <button
                                            type="submit"
                                            disabled={isBroadcasting || !broadcastMessage}
                                            className={`flex items-center gap-3 px-12 py-5 rounded-2xl font-bold transition-all ${isBroadcasting || !broadcastMessage
                                                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-blue-700 to-blue-600 text-white hover:scale-[1.02] shadow-2xl shadow-blue-600/30 active:scale-[0.98]'
                                                }`}
                                        >
                                            {isBroadcasting ? (
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                            ) : (
                                                <Send className="w-5 h-5" />
                                            )}
                                            {isBroadcasting ? 'DECRYPTING & SENDING...' : 'AUTHORIZE DISPATCH'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>

                {/* Final Compliance Note - MATCHES LAUNCHPAD */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 flex items-start gap-6">
                    <div className="bg-purple-600/20 p-3 rounded-xl flex-shrink-0">
                        <ShieldCheck className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <p className="text-lg font-bold text-white">System Governance Disclosure</p>
                        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                            The Telegram companion layer acts as a primary push-notification node. All broadcasts are logged for
                            audit purposes. Ensure token credentials are only handled by authenticated SUPER_ADMIN accounts
                            within the secure management perimeter.
                        </p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
