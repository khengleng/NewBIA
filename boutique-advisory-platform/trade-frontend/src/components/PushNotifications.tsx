'use client'

import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'

export default function PushNotifications() {
    const [permission, setPermission] = useState<NotificationPermission>('default')
    const [showPrompt, setShowPrompt] = useState(false)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)

    useEffect(() => {
        if ('Notification' in window) {
            setPermission(Notification.permission)

            // Check if already subscribed
            if ('serviceWorker' in navigator && Notification.permission === 'granted') {
                navigator.serviceWorker.ready.then(registration => {
                    registration.pushManager.getSubscription().then(sub => {
                        setSubscription(sub)
                    })
                })
            }

            // Show prompt after 60 seconds if not granted or denied
            if (Notification.permission === 'default') {
                const timer = setTimeout(() => {
                    const dismissed = localStorage.getItem('push-notifications-dismissed')
                    if (!dismissed) {
                        setShowPrompt(true)
                    }
                }, 60000)

                return () => clearTimeout(timer)
            }
        }
    }, [])

    const requestPermission = async () => {
        try {
            const result = await Notification.requestPermission()
            setPermission(result)

            if (result === 'granted') {
                // Subscribe to push notifications
                await subscribeToPush()
                setShowPrompt(false)

                // Show test notification
                new Notification('Notifications Enabled!', {
                    body: 'You\'ll now receive updates from BIA Platform',
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-96x96.png',
                    tag: 'welcome',
                    requireInteraction: false
                })

                // Haptic feedback
                if ('vibrate' in navigator) {
                    navigator.vibrate([50, 100, 50])
                }
            } else {
                localStorage.setItem('push-notifications-dismissed', new Date().toISOString())
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error)
        }
    }

    const subscribeToPush = async () => {
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                console.log('Push notifications not supported')
                return
            }

            const registration = await navigator.serviceWorker.ready

            // VAPID public key (in production, this would come from your backend)
            const vapidPublicKey = 'BO2WrnjdJYmlc9gEeHjYpRn1p7r4TMB33gh70AqQQzIrcBAN_kNQZ-kX2b-G9HQ7Z4GVjGVISUC2NEjGpNBzgkY'

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
            })

            setSubscription(subscription)

            // Send subscription to backend
            await fetch('/api/push/subscribe', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(subscription)
            })

            console.log('Push subscription successful:', subscription)
        } catch (error) {
            console.error('Error subscribing to push:', error)
        }
    }

    const unsubscribe = async () => {
        try {
            if (subscription) {
                await subscription.unsubscribe()
                setSubscription(null)

                // Notify backend
                await fetch('/api/push/unsubscribe', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ endpoint: subscription.endpoint })
                })
            }
        } catch (error) {
            console.error('Error unsubscribing:', error)
        }
    }

    const handleDismiss = () => {
        setShowPrompt(false)
        localStorage.setItem('push-notifications-dismissed', new Date().toISOString())
    }

    // Helper function to convert VAPID key
    function urlBase64ToUint8Array(base64String: string) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4)
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/')

        const rawData = window.atob(base64)
        const outputArray = new Uint8Array(rawData.length)

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
    }

    if (typeof window === 'undefined' || !('Notification' in window) || permission === 'denied') {
        return null
    }

    if (!showPrompt || permission === 'granted') {
        return null
    }

    return (
        <>
            {/* Mobile Bottom Sheet */}
            <div className="fixed inset-x-0 bottom-20 z-40 sm:hidden px-4">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 rounded-xl shadow-2xl">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                            <Bell className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold text-sm">Stay Updated</h3>
                            <p className="text-white/90 text-xs mt-1">
                                Get notified about new matches, deals, and messages
                            </p>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="p-1 text-white/80 hover:text-white flex-shrink-0 touch-manipulation"
                            aria-label="Dismiss"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={handleDismiss}
                            className="flex-1 py-2 px-4 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white rounded-lg text-sm font-medium transition-colors touch-manipulation"
                        >
                            Not Now
                        </button>
                        <button
                            onClick={requestPermission}
                            className="flex-1 py-2 px-4 bg-white hover:bg-gray-100 active:bg-gray-200 text-purple-600 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 touch-manipulation"
                        >
                            <Bell className="w-4 h-4" />
                            Enable
                        </button>
                    </div>
                </div>
            </div>

            {/* Desktop Banner */}
            <div className="hidden sm:block fixed bottom-24 right-4 z-40 max-w-sm">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-5 shadow-2xl border border-white/20">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                            <Bell className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold">Enable Notifications</h3>
                            <p className="text-white/90 text-sm mt-1">
                                Stay updated with new matches, deals, and messages
                            </p>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="p-1 text-white/80 hover:text-white flex-shrink-0"
                            aria-label="Dismiss"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={handleDismiss}
                            className="flex-1 py-2 px-4 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            Not Now
                        </button>
                        <button
                            onClick={requestPermission}
                            className="flex-1 py-2 px-4 bg-white hover:bg-gray-100 text-purple-600 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            <Bell className="w-4 h-4" />
                            Enable
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
