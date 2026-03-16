import type { Metadata, Viewport } from 'next'
import './globals.css'
import ClientProviders from '../components/ClientProviders'
import OneSignalLoader from '../components/OneSignalLoader'

const inter = { className: 'sans-serif' }

const APP_NAME = 'CamboBia Trading'
const APP_DEFAULT_TITLE = 'CamboBia Trading'
const APP_TITLE_TEMPLATE = '%s | BIA'
const APP_DESCRIPTION = 'Secondary market trading for eligible CamboBia tokenized units.'

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_DEFAULT_TITLE,
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2563eb' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const swCleanupScript = `
    (function () {
      try {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
        var host = window.location.hostname;
        var shouldReset = host === 'www.cambobia.com' || host === 'cambobia.com' || host === 'trade.cambobia.com';
        if (!shouldReset) return;
        var resetKey = host + '-sw-hard-reset-v7';
        if (window.localStorage.getItem(resetKey) === '1') return;
        Promise.resolve(navigator.serviceWorker.getRegistrations())
          .then(function (registrations) {
            return Promise.all(registrations.map(function (registration) {
              return registration.unregister();
            }));
          })
          .then(function () {
            if (!('caches' in window)) return Promise.resolve();
            return caches.keys().then(function (keys) {
              return Promise.all(keys.map(function (key) { return caches.delete(key); }));
            });
          })
          .finally(function () {
            window.localStorage.setItem(resetKey, '1');
            window.location.reload();
          });
      } catch (error) {
        console.warn('Service worker cleanup skipped', error);
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-72x72.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script dangerouslySetInnerHTML={{ __html: swCleanupScript }} />
      </head>
      <body className={inter.className}>
        <OneSignalLoader />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  )
}
