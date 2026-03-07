'use client'
import { useState, useEffect } from 'react'
import { Send, CheckCircle, XCircle, ExternalLink, RefreshCw } from 'lucide-react'
import { authorizedRequest } from '@/lib/api'

export default function TelegramLink({ user }: { user: any }) {
    const [isLinked, setIsLinked] = useState(false)
    const [loading, setLoading] = useState(false)
    const [linkData, setLinkData] = useState<{ deepLink: string; expiresIn: number } | null>(null)

    useEffect(() => {
        if (user?.preferences?.telegramChatId) {
            setIsLinked(true)
        }
    }, [user])

    const handleGenerateLink = async () => {
        setLoading(true)
        try {
            const response = await authorizedRequest('/api/mobile/bot/link-token', {
                method: 'POST'
            })
            if (response.ok) {
                const data = await response.json()
                setLinkData(data)
            }
        } catch (error) {
            console.error('Error generating link token:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleUnlink = async () => {
        if (!confirm('Are you sure you want to disconnect your Telegram bot?')) return

        setLoading(true)
        try {
            const response = await authorizedRequest('/api/mobile/bot/unlink', {
                method: 'POST'
            })
            if (response.ok) {
                setIsLinked(false)
                setLinkData(null)
            }
        } catch (error) {
            console.error('Error unlinking telegram:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mt-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-400" />
                Telegram Bot Assistant
            </h3>

            {isLinked ? (
                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-green-400" />
                        <div>
                            <p className="text-white font-medium">Telegram Connected</p>
                            <p className="text-sm text-gray-400">You are receiving notifications via Telegram.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleUnlink}
                        disabled={loading}
                        className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-1"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Disconnect
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-gray-300 text-sm">
                        Connect your BIA account to our Telegram bot to receive real-time deal alerts,
                        trade executions, and manage your portfolio on the go.
                    </p>

                    {!linkData ? (
                        <button
                            onClick={handleGenerateLink}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                            Connect Telegram Bot
                        </button>
                    ) : (
                        <div className="bg-blue-600/10 border border-blue-600/20 p-6 rounded-xl text-center space-y-4">
                            <div className="flex justify-center">
                                <Send className="w-12 h-12 text-blue-400 animate-bounce" />
                            </div>
                            <div>
                                <p className="text-white font-semibold">Linking Token Generated!</p>
                                <p className="text-xs text-gray-400 mt-1">Token expires in {Math.floor(linkData.expiresIn / 60)} minutes</p>
                            </div>
                            <a
                                href={linkData.deepLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-bold transition-all transform hover:scale-105"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Start Bot & Link Account
                            </a>
                            <p className="text-[10px] text-gray-500">
                                This will open Telegram and start the Bot with a secure token.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
