importScripts("service-worker-core.js?v=1");

const CACHE_NAME = "selfchat-v59";
const FILES = ["./", "index.html", "styles.css?v=42", "storage-core.js?v=9", "sync-crypto.js?v=3", "sync-backend.js?v=1", "storage.js?v=10", "app-core.js?v=14", "app.js?v=48", "service-worker-core.js?v=1", "icon.svg?v=3", "manifest.webmanifest"];
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
  event.respondWith(fetch(event.request).then(response => {
    if (SelfChatServiceWorkerCore.shouldCacheResponse(event.request, response, self.location.origin)) {
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone())));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(SelfChatServiceWorkerCore.fallbackRequest(event.request));
    return cached || new Response("Offline asset unavailable", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }));
});
