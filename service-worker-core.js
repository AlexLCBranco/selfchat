(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SelfChatServiceWorkerCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function isAppShellRequest(request, origin) {
    try {
      const url = new URL(request.url);
      return url.origin === origin && !url.pathname.startsWith("/api/");
    } catch (_) {
      return false;
    }
  }

  function shouldCacheResponse(request, response, origin) {
    if (!request || !response || request.method !== "GET" || !response.ok) return false;
    return isAppShellRequest(request, origin);
  }

  function fallbackRequest(request) {
    return request?.mode === "navigate" ? "index.html" : request;
  }

  return { isAppShellRequest, shouldCacheResponse, fallbackRequest };
});
