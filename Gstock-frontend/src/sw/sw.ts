// Service worker de l'application (ADR-005) : l'application elle-même (HTML, JS, CSS,
// polices, icônes) est gardée sur l'appareil pour s'ouvrir sans réseau. Les données
// passent par l'API ; leur cache et la file des opérations sont dans IndexedDB (src/offline).
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] }

const isApi = (url: string) => {
  const { pathname } = new URL(url)
  return pathname.startsWith('/api/') || pathname.startsWith('/sanctum/')
}

// Données simulées : le worker de MSW est chargé ici, car deux service workers ne
// peuvent pas contrôler la même page. Il ne reçoit que les appels à l'API.
if (import.meta.env.VITE_USE_MOCKS === 'true') {
  const addEventListener = self.addEventListener.bind(self)
  self.addEventListener = ((type: string, listener: EventListener, options?: AddEventListenerOptions) => {
    if (type !== 'fetch') return addEventListener(type, listener, options)
    return addEventListener('fetch', (event) => {
      if (isApi((event as FetchEvent).request.url)) listener(event)
    }, options)
  }) as typeof self.addEventListener
  importScripts('/mockServiceWorker.js')
  self.addEventListener = addEventListener
}

void self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Toutes les adresses de l'application ouvrent index.html, même sans réseau.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/sanctum\//] }))
