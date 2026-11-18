(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SelfChatServiceWorkerCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function shouldCacheResponse(request, response, origin) {
    if (!request || !response || request.method !== "GET" || !response.ok) return false;
    try {
      return new URL(request.url).origin === origin;
    } catch (_) {
      return false;
    }
  }

  function fallbackRequest(request) {
    return request?.mode === "navigate" ? "index.html" : request;
  }

  return { shouldCacheResponse, fallbackRequest };
});
