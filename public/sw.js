// Minimal SW so the app is installable as a PWA on iOS Safari.
// No offline caching for now — the app needs the API and a live network.
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => { /* pass through */ });
