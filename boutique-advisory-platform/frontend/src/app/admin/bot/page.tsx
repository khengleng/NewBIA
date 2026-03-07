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
    Lock,
    RefreshCw,
    Terminal,
    Bell
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

    if (isLoading && !stats) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header Branding Section */}
                <section className="bg-gray-800 border border-gray-700 rounded-xl p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <MessageSquare className="w-32 h-32 text-blue-400" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <MessageSquare className="w-8 h-8 text-blue-400" />
                                Telegram Bot Management
                            </h1>
                            <p className="text-gray-400 mt-2 max-w-xl">
                                Real-time companion service for the Trading Platform. Manage investor connectivity,
                                system broadcasts, and bot credentials.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowSetup(!showSetup)}
                                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${showSetup
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                    : 'bg-gray-900 text-gray-300 border border-gray-700 hover:border-gray-600'
                                    }`}
                            >
                                <Settings className="w-4 h-4" />
                                {showSetup ? 'View Operations' : 'Bot Settings'}
                            </button>
                            <button
                                onClick={fetchStats}
                                className="p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </section>

                {feedback && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${feedback.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
                        }`}>
                        {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        <span className="text-sm font-medium">{feedback.message}</span>
                    </div>
                )}

                {showSetup ? (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Token Update Card */}
                        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
                            <div className="p-8 border-b border-gray-700 bg-gray-900/40 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
                                        <Lock className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Dynamic Bot Credentials</h2>
                                        <p className="text-sm text-gray-400">Update the API gateway for your Telegram companion.</p>
                                    </div>
                                </div>
                                {stats?.hasCustomToken && (
                                    <div className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full flex items-center gap-2">
                                        <ShieldCheck className="w-3 h-3 text-green-400" />
                                        <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Active Custom Token</span>
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handleUpdateToken} className="p-8 space-y-6">
                                <div className="max-w-2xl">
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                        New Connection String (API Token)
                                    </label>
                                    <div className="flex gap-4">
                                        <input
                                            type="password"
                                            value={newToken}
                                            onChange={(e) => setNewToken(e.target.value)}
                                            placeholder="123456789:ABCDEF123456789..."
                                            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                        />
                                        <button
                                            type="submit"
                                            disabled={isUpdatingToken || !newToken}
                                            className={`px-8 py-3.5 rounded-xl font-bold transition-all flex items-center gap-2 ${isUpdatingToken || !newToken
                                                ? 'bg-gray-700 text-gray-500'
                                                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30'
                                                }`}
                                        >
                                            {isUpdatingToken ? <Loader2 className="w-5 h-5 animate-spin" /> : <Terminal className="w-4 h-4" />}
                                            {isUpdatingToken ? 'Connecting...' : 'Deploy Token'}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-4 leading-relaxed flex items-center gap-2">
                                        <AlertCircle className="w-3 h-3 text-amber-400" />
                                        Updating this token triggers an immediate restart of the bot microservice polling cycle.
                                    </p>
                                </div>
                            </form>
                        </div>

                        {/* Guide Card */}
                        <div className="bg-blue-600/5 border border-blue-500/20 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6">Setup Protocol</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-xs font-black text-white">1</div>
                                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Bot Registry</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        Navigate to <a href="https://t.me/botfather" target="_blank" className="text-blue-400 font-bold underline">@BotFather</a> on Telegram.
                                        Request `/newbot` and obtain your authorization token.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-xs font-black text-white">2</div>
                                    <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Platform Sync</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        Input the token above. The platform will automatically verify and establish the WebSocket connection for real-time alerts.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        {/* Status Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-gray-800 border border-gray-700 p-8 rounded-xl flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Service Status</label>
                                    <div className={`w-3 h-3 rounded-full animate-pulse ${stats?.serviceHealth === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                                </div>
                                <div className="flex items-center gap-3">
                                    {stats?.serviceHealth === 'online' ? (
                                        <Wifi className="w-8 h-8 text-green-400" />
                                    ) : (
                                        <WifiOff className="w-8 h-8 text-red-400" />
                                    )}
                                    <span className={`text-3xl font-bold ${stats?.serviceHealth === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                                        {stats?.serviceHealth === 'online' ? 'Connected' : 'Disconnected'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-4 underline decoration-dotted cursor-help">Bot Microservice Gateway</p>
                            </div>

                            <div className="bg-gray-800 border border-gray-700 p-8 rounded-xl flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Linked Participants</label>
                                    <Users className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-4xl font-bold text-white">
                                        {stats?.linkedUsersCount || 0}
                                    </span>
                                    <span className="text-sm text-gray-500 font-bold uppercase tracking-widest">Validators</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-4 italic">Active portfolio subscribers</p>
                            </div>

                            <div className="bg-gray-800 border border-gray-700 p-8 rounded-xl flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Instance Identifier</label>
                                    <Database className="w-5 h-5 text-purple-400" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xl font-bold text-white truncate max-w-[180px]">
                                        @{stats?.botUsername || 'CamboBiaBot'}
                                    </span>
                                    <a
                                        href={`https://t.me/${stats?.botUsername || 'CamboBiaBot'}`}
                                        target="_blank"
                                        className="p-1 px-2.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-500 hover:text-blue-400 transition-all flex items-center gap-2"
                                    >
                                        <span className="text-[10px] font-bold">OPEN</span>
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                                <p className="text-xs text-gray-500 mt-4 leading-none truncate">Production Telegram Namespace</p>
                            </div>
                        </div>

                        {/* Broadcast Section */}
                        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-xl">
                            <div className="p-8 border-b border-gray-700 bg-gray-900/40 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                        <Bell className="w-5 h-5 text-amber-400" />
                                        Platform Broadcast
                                    </h2>
                                    <p className="text-sm text-gray-400 mt-1">Dispatch encrypted push notifications to all authenticated users.</p>
                                </div>
                            </div>

                            <form onSubmit={handleBroadcast} className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                                Broadcast Subject
                                            </label>
                                            <input
                                                type="text"
                                                value={broadcastTitle}
                                                onChange={(e) => setBroadcastTitle(e.target.value)}
                                                placeholder="e.g. Q4 Market Settlement Updates"
                                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            />
                                        </div>
                                        <div className="p-5 bg-blue-600/5 border border-blue-500/10 rounded-xl">
                                            <p className="text-[11px] text-blue-300/60 leading-relaxed font-medium">
                                                Participants will receive this as an instant Telegram / Mobile notification.
                                                Markdown is fully supported for rich formatting.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                            Instructional Content
                                        </label>
                                        <textarea
                                            rows={5}
                                            value={broadcastMessage}
                                            onChange={(e) => setBroadcastMessage(e.target.value)}
                                            placeholder="Enter high-priority announcement details..."
                                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[160px] transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-gray-700/50">
                                    <button
                                        type="submit"
                                        disabled={isBroadcasting || !broadcastMessage}
                                        className={`flex items-center gap-3 px-10 py-4 rounded-xl font-bold transition-all ${isBroadcasting || !broadcastMessage
                                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:scale-[1.02] shadow-xl shadow-blue-600/20 active:scale-[0.98]'
                                            }`}
                                    >
                                        {isBroadcasting ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1" />
                                        )}
                                        {isBroadcasting ? 'Disseminating...' : 'Authorize & Dispatch'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Footnote */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                    <p className="text-sm text-gray-300">
                        <b>Information:</b> This module provides operational overhead for the CamboBia companion layer.
                        Ensure all broadcasts follow the system governance guidelines.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
}
