const CACHE_NAME = "selfchat-v31";
const FILES = ["./", "index.html", "styles.css?v=22", "storage-core.js?v=6", "storage.js?v=6", "app-core.js?v=4", "app.js?v=27", "icon.svg?v=3", "manifest.webmanifest"];
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
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(cached => {
    if (cached) return cached;
    if (event.request.mode === "navigate") return caches.match("index.html");
    return new Response("Offline asset unavailable", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  })));
});
