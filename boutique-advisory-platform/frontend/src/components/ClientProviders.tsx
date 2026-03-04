'use client'

import { useEffect } from 'react'
import ErrorBoundary from './ErrorBoundary'
import { ToastProvider } from '../contexts/ToastContext'
import PWAInstallPrompt from './PWAInstallPrompt'
import BottomNavigation from './BottomNavigation'
import PushNotifications from './PushNotifications'
import { SocketProvider } from '../contexts/SocketContext'

interface Props {
    children: React.ReactNode
}

export default function ClientProviders({ children }: Props) {
    useEffect(() => {
        // Force unregister service workers on localhost to prevent "no-response" errors
        if (typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                    for (const registration of registrations) {
                        registration.unregister();
                        console.log('🧹 Unregistered stale service worker on localhost');
                    }
                });
            }
        }

        // One-time SW reset on production domains to clear stale cached bundles after deploys.
        if (typeof window !== 'undefined') {
            const host = window.location.hostname;
            const shouldResetSw = host === 'trade.cambobia.com' || host === 'www.cambobia.com' || host === 'cambobia.com';

            if (shouldResetSw) {
                const resetKey = `${host}-sw-reset-v2`;
                const hasReset = window.localStorage.getItem(resetKey);

                if (!hasReset && 'serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then((registrations) => {
                        Promise.all(registrations.map((registration) => registration.unregister()))
                            .finally(() => {
                                window.localStorage.setItem(resetKey, '1');
                                window.location.reload();
                            });
                    });
                }
            }
        }
    }, []);

    return (
        <ErrorBoundary>
            <ToastProvider>
                <SocketProvider>
                    {children}
                    <PWAInstallPrompt />
                    <PushNotifications />
                    <BottomNavigation />
                </SocketProvider>
            </ToastProvider>
        </ErrorBoundary>
    )
}
