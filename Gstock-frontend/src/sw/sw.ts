// Service worker de l'application (ADR-005) : l'application elle-même (HTML, JS, CSS,
// polices, icônes) est gardée sur l'appareil pour s'ouvrir sans réseau. Les données
// passent par l'API ; leur cache et la file des opérations sont dans IndexedDB (src/offline).
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] }

void self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Toutes les adresses de l'application ouvrent index.html, même sans réseau.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/sanctum\//] }))
