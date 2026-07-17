// Minimal service worker for Camelia PWA install.
// Intentionally does NOT cache anything — sellers must always see fresh inventory,
// sales and balances. Its only job is to exist (registered, root-scoped, with a
// fetch listener) so Chrome offers the "Add to Home screen" install.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {
  // No-op passthrough: let the browser handle every request over the network.
  // We deliberately never call event.respondWith(), so nothing is served stale.
})
