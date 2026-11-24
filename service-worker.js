importScripts("service-worker-core.js?v=2");

const CACHE_NAME = "selfchat-v63";
const FILES = ["./", "index.html", "styles.css?v=42", "storage-core.js?v=11", "store-core.js?v=1", "app-core.js?v=15", "app.js?v=51", "service-worker-core.js?v=2", "icon.svg?v=3", "manifest.webmanifest"];
self.addEventListener("install", event => event.waitUntil(Promise.all([
  caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)),
  self.skipWaiting()
])));
self.addEventListener("activate", event => event.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))),
  self.clients.claim()
])));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  // Data never comes from a cache: /api/ requests always go to the local server.
  if (!SelfChatServiceWorkerCore.isAppShellRequest(event.request, self.location.origin)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (SelfChatServiceWorkerCore.shouldCacheResponse(event.request, response, self.location.origin)) {
      const cacheCopy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, cacheCopy)));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(SelfChatServiceWorkerCore.fallbackRequest(event.request));
    return cached || new Response("Offline asset unavailable", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }));
});
