(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SelfChatSyncBackend = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REQUIRED_METHODS = Object.freeze([
    "pushEnvelopes",
    "pullEnvelopes",
    "putAttachmentChunk",
    "getAttachmentChunk"
  ]);

  function validatePullPage(value) {
    if (!value || !Array.isArray(value.envelopes)) throw new Error("A sync pull page must contain an envelopes array");
    value.envelopes.forEach(validateEncryptedEnvelope);
    if (value.cursor != null && typeof value.cursor !== "string") throw new Error("A sync cursor must be a string or null");
    return { envelopes: value.envelopes, cursor: value.cursor ?? null };
  }

  function validateEncryptedEnvelope(value) {
    if (!value?.header || typeof value.iv !== "string" || typeof value.ciphertext !== "string" || typeof value.signature !== "string" || "operations" in value) {
      throw new Error("Sync transport accepts encrypted envelopes only");
    }
    return value;
  }

  function createBackendBoundary(adapter = null) {
    if (!adapter) {
      const unavailable = async () => { throw new Error("Cross-device transport is not configured"); };
      return {
        configured: false,
        pushEnvelopes: unavailable,
        pullEnvelopes: unavailable,
        putAttachmentChunk: unavailable,
        getAttachmentChunk: unavailable
      };
    }
    for (const method of REQUIRED_METHODS) {
      if (typeof adapter[method] !== "function") throw new Error(`Sync backend is missing ${method}()`);
    }
    return {
      configured: true,
      async pushEnvelopes(envelopes, context) {
        if (!Array.isArray(envelopes) || !envelopes.length) throw new Error("Encrypted envelopes are required");
        envelopes.forEach(validateEncryptedEnvelope);
        return adapter.pushEnvelopes(envelopes, context);
      },
      async pullEnvelopes(cursor, context) {
        return validatePullPage(await adapter.pullEnvelopes(cursor, context));
      },
      async putAttachmentChunk(chunk, context) {
        if (!chunk?.attachmentId || !Number.isSafeInteger(chunk.index) || typeof chunk.ciphertext !== "string") throw new Error("Invalid encrypted attachment chunk");
        return adapter.putAttachmentChunk(chunk, context);
      },
      async getAttachmentChunk(reference, context) {
        if (!reference?.attachmentId || !Number.isSafeInteger(reference.index)) throw new Error("Invalid attachment chunk reference");
        return adapter.getAttachmentChunk(reference, context);
      }
    };
  }

  return { REQUIRED_METHODS, validateEncryptedEnvelope, validatePullPage, createBackendBoundary };
});
