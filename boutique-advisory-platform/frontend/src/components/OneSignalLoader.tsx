'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { shouldEnableOneSignal } from '@/lib/platform'

const ONESIGNAL_APP_ID = '4d61e383-61ef-42ca-a6c5-1ece240d2ebf'

export default function OneSignalLoader() {
    const [enabled, setEnabled] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        if (typeof window === 'undefined') return
        const onSupportedHost = shouldEnableOneSignal(window.location.hostname)
        const isAuthRoute = pathname?.startsWith('/auth/')
        setEnabled(onSupportedHost && !isAuthRoute)
    }, [pathname])

    if (!enabled) return null

    return (
        <>
            <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" strategy="afterInteractive" />
            <Script id="onesignal-init" strategy="afterInteractive">
                {`
                    window.OneSignalDeferred = window.OneSignalDeferred || [];
                    window.OneSignalDeferred.push(async function(OneSignal) {
                      try {
                        if ('serviceWorker' in navigator) {
                          await navigator.serviceWorker.register('/OneSignalSDKWorker.js');
                          await navigator.serviceWorker.register('/OneSignalSDKUpdaterWorker.js');
                        }
                        await OneSignal.init({
                          appId: "${ONESIGNAL_APP_ID}",
                        });
                      } catch (err) {
                        console.warn('OneSignal init skipped:', err);
                      }
                    });
                `}
            </Script>
        </>
    )
}
