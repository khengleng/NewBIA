'use client'

import { useEffect } from 'react'

export default function OneSignalLoader() {
    useEffect(() => {
        if (typeof window === 'undefined') return

        // OneSignal is intentionally suspended platform-wide. Clean up any stale
        // registrations created by earlier builds to avoid worker console noise.
        const cleanupOneSignal = async () => {
            const w = window as Window & {
                OneSignal?: unknown
                OneSignalDeferred?: unknown
            }

            w.OneSignal = undefined
            w.OneSignalDeferred = undefined

            if (!('serviceWorker' in navigator)) return

            const registrations = await navigator.serviceWorker.getRegistrations()
            await Promise.all(
                registrations.map(async (registration) => {
                    const scriptUrl = registration.active?.scriptURL
                        || registration.waiting?.scriptURL
                        || registration.installing?.scriptURL
                        || ''
                    const scope = registration.scope || ''
                    const isOneSignalWorker = scriptUrl.includes('OneSignalSDK')
                        || scriptUrl.includes('onesignal')
                        || scope.includes('onesignal')
                    if (isOneSignalWorker) {
                        await registration.unregister()
                    }
                }),
            )
        }

        cleanupOneSignal().catch(() => {
            // Intentionally ignore cleanup errors.
        })
    }, [])

    return null
}
