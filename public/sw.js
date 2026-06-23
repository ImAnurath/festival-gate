// Minimal pass-through service worker. It exists only so the admin section meets
// PWA installability (Chrome requires a fetch handler). No caching: the gate tool
// is online-only, so every request goes straight to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
