'use client'

import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [showPrompt, setShowPrompt] = useState(false)
    const [isInstalled, setIsInstalled] = useState(false)

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true)
            return
        }

        // Check if user has dismissed the prompt before
        const dismissed = localStorage.getItem('pwa-install-dismissed')
        if (dismissed) {
            const dismissedDate = new Date(dismissed)
            const now = new Date()
            const daysSinceDismissed = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)

            // Show again after 7 days
            if (daysSinceDismissed < 7) {
                return
            }
        }

        // Listen for the beforeinstallprompt event
        const handler = (e: Event) => {
            setDeferredPrompt(e as BeforeInstallPromptEvent)

            // Show prompt after 30 seconds
            setTimeout(() => {
                setShowPrompt(true)
            }, 30000)
        }

        window.addEventListener('beforeinstallprompt', handler)

        // Listen for successful installation
        window.addEventListener('appinstalled', () => {
            setIsInstalled(true)
            setShowPrompt(false)
            setDeferredPrompt(null)
        })

        return () => {
            window.removeEventListener('beforeinstallprompt', handler)
        }
    }, [])

    const handleInstall = async () => {
        if (!deferredPrompt) return

        // Show the install prompt
        deferredPrompt.prompt()

        // Wait for the user's response
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt')
        } else {
            console.log('User dismissed the install prompt')
            localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
        }

        // Clear the deferred prompt
        setDeferredPrompt(null)
        setShowPrompt(false)
    }

    const handleDismiss = () => {
        setShowPrompt(false)
        localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
    }

    if (isInstalled || !showPrompt || !deferredPrompt) {
        return null
    }

    return (
        <>
            {/* Mobile Bottom Sheet */}
            <div className="fixed inset-x-0 bottom-0 z-50 sm:hidden">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 shadow-2xl">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                            <Smartphone className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold text-sm">Install BIA Platform</h3>
                            <p className="text-white/90 text-xs mt-1">
                                Get quick access and work offline
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
                            onClick={handleInstall}
                            className="flex-1 py-2 px-4 bg-white hover:bg-gray-100 active:bg-gray-200 text-blue-600 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 touch-manipulation"
                        >
                            <Download className="w-4 h-4" />
                            Install
                        </button>
                    </div>
                </div>
            </div>

            {/* Desktop Banner */}
            <div className="hidden sm:block fixed bottom-4 right-4 z-50 max-w-sm">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-5 shadow-2xl border border-white/20">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                            <Download className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold">Install BIA Platform</h3>
                            <p className="text-white/90 text-sm mt-1">
                                Install our app for quick access and offline support
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
                            onClick={handleInstall}
                            className="flex-1 py-2 px-4 bg-white hover:bg-gray-100 text-blue-600 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Install App
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
