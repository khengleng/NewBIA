import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

const apiNetworkOnly = {
    matcher: ({ url, request }: { url: URL; request: Request }) =>
        request.method === "GET" && (
            url.pathname.startsWith("/api-proxy/")
            || url.pathname.startsWith("/api/")
        ),
    handler: new NetworkOnly(),
};

// This declares the value of `injectionPoint` to TypeScript.
declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: any;

// Some SDKs (e.g., OneSignal) require the message handler to exist during
// the initial worker script evaluation.
self.addEventListener('message', () => {
  // no-op
});

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [apiNetworkOnly, ...defaultCache],
    fallbacks: {
        entries: [
            {
                url: "/offline",
                matcher({ request }) {
                    return request.destination === "document";
                },
            },
        ],
    },
});

serwist.addEventListeners();

self.addEventListener('push', (event: any) => {
  const data = event.data?.json() ?? { title: 'New Notification', body: 'You have a new update' };
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    data: {
      url: data.url || '/'
    }
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(
      self.clients.openWindow(event.notification.data.url)
    );
  }
});
