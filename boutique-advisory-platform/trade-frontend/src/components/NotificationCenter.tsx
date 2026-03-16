'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
    Bell,
    X,
    Check,
    CheckCheck,
    Sparkles,
    Heart,
    TrendingUp,
    FileText,
    MessageSquare,
    Calendar,
    AlertCircle
} from 'lucide-react'
import { authorizedRequest } from '@/lib/api'
import { useSocket } from '@/hooks/useSocket'
import { resolveTradingRuntime } from '@/lib/platform'

interface Notification {
    id: string
    userId: string
    type: string
    title: string
    message: string
    read: boolean
    actionUrl: string | null
    createdAt: string
}

export default function NotificationCenter() {
    const [isOpen, setIsOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [isUnauthorized, setIsUnauthorized] = useState(false)
    const [isUnavailable, setIsUnavailable] = useState(false)
    const [isTradingRuntime, setIsTradingRuntime] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (typeof window === 'undefined') return
        setIsTradingRuntime(resolveTradingRuntime(window.location.hostname, window.location.pathname))
    }, [])

    useEffect(() => {
        if (isTradingRuntime) return
        const fetchNotifications = async () => {
            try {
                const userData = localStorage.getItem('user')
                if (!userData) {
                    setIsLoading(false)
                    return
                }

                setIsLoading(true)
                const response = await authorizedRequest('/api/notifications')

                if (response.ok) {
                    const data = await response.json()
                    setNotifications(data.notifications || [])
                    setUnreadCount(data.unreadCount || 0)
                    setIsUnauthorized(false)
                    setIsUnavailable(false)
                } else if (response.status === 401) {
                    // Session may be expired or switching accounts; stop polling noise.
                    setIsUnauthorized(true)
                } else if (response.status === 403 || response.status === 404) {
                    // Trading deployments without notification module should fail quietly.
                    setIsUnavailable(true)
                } else {
                    setIsUnavailable(true)
                }
            } catch (error) {
                setIsUnavailable(true)
            } finally {
                setIsLoading(false)
            }
        }

        fetchNotifications()

        // Poll for new notifications every 60 seconds (fallback)
        const interval = setInterval(() => {
            if (!isUnauthorized && !isUnavailable) fetchNotifications()
        }, 60000)
        return () => clearInterval(interval)
    }, [isUnauthorized, isUnavailable, isTradingRuntime])

    const { lastNotification } = useSocket()

    useEffect(() => {
        if (lastNotification && typeof lastNotification === 'object') {
            setNotifications(prev => [lastNotification, ...prev])
            if (!lastNotification.read) {
                setUnreadCount(prev => prev + 1)
            }
        }
    }, [lastNotification])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    if (isTradingRuntime) return null

    const markAsRead = async (notifId: string) => {
        if (isUnavailable) return
        try {
            await authorizedRequest(`/api/notifications/${notifId}/read`, {
                method: 'PUT'
            })

            setNotifications(prev => prev.map(n =>
                n.id === notifId ? { ...n, read: true } : n
            ))
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch (error) {
            console.error('Error marking notification as read:', error)
        }
    }

    const markAllAsRead = async () => {
        if (isUnavailable) return
        try {
            await authorizedRequest('/api/notifications/read-all', {
                method: 'PUT'
            })

            setNotifications(prev => prev.map(n => ({ ...n, read: true })))
            setUnreadCount(0)
        } catch (error) {
            console.error('Error marking all as read:', error)
        }
    }

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'MATCH_FOUND': return <Sparkles className="w-4 h-4 text-purple-400" />
            case 'INTEREST_RECEIVED':
            case 'INTEREST_EXPRESSED': return <Heart className="w-4 h-4 text-pink-400" />
            case 'DEAL_UPDATE': return <TrendingUp className="w-4 h-4 text-blue-400" />
            case 'DOCUMENT_UPLOADED': return <FileText className="w-4 h-4 text-green-400" />
            case 'MESSAGE_RECEIVED': return <MessageSquare className="w-4 h-4 text-yellow-400" />
            case 'MEETING_REMINDER':
            case 'MEETING_INVITE':
            case 'PITCH_SCHEDULED': return <Calendar className="w-4 h-4 text-indigo-400" />
            default: return <AlertCircle className="w-4 h-4 text-gray-400" />
        }
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diff = now.getTime() - date.getTime()

        if (diff < 60000) return 'Just now'
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
        return date.toLocaleDateString()
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-gray-800 rounded-xl shadow-xl border border-gray-700 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-700">
                        <h3 className="font-semibold text-white">Notifications</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                                >
                                    <CheckCheck className="w-3 h-3" />
                                    Mark all read
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-gray-700 rounded"
                            >
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-96 overflow-y-auto">
                        {isUnauthorized ? (
                            <div className="p-6 text-center text-gray-400 text-sm">
                                Notifications unavailable until you sign in again.
                            </div>
                        ) : isUnavailable ? (
                            <div className="p-6 text-center text-gray-400 text-sm">
                                Notifications are not enabled for this account.
                            </div>
                        ) : isLoading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No notifications</p>
                            </div>
                        ) : (
                            notifications.slice(0, 10).map(notification => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b border-gray-700 hover:bg-gray-700/50 transition-colors ${!notification.read ? 'bg-blue-500/5' : ''
                                        }`}
                                >
                                    <div className="flex gap-3">
                                        <div className="p-2 bg-gray-700 rounded-lg h-fit">
                                            {getNotificationIcon(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm font-medium ${notification.read ? 'text-gray-300' : 'text-white'}`}>
                                                    {notification.title}
                                                </p>
                                                {!notification.read && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            markAsRead(notification.id)
                                                        }}
                                                        className="p-1 hover:bg-gray-600 rounded"
                                                        title="Mark as read"
                                                    >
                                                        <Check className="w-3 h-3 text-gray-400" />
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-gray-500">
                                                    {formatTime(notification.createdAt)}
                                                </span>
                                                {notification.actionUrl && (
                                                    <Link
                                                        href={notification.actionUrl === '/matches' ? '/matchmaking' : notification.actionUrl}
                                                        onClick={() => {
                                                            markAsRead(notification.id)
                                                            setIsOpen(false)
                                                        }}
                                                        className="text-xs text-blue-400 hover:text-blue-300"
                                                    >
                                                        View →
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-gray-700 text-center">
                            <Link
                                href="/notifications"
                                onClick={() => setIsOpen(false)}
                                className="text-sm text-blue-400 hover:text-blue-300"
                            >
                                View all notifications
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
