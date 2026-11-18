(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SelfChatSyncCrypto = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ENVELOPE_VERSION = 1;
  const ATTACHMENT_BUNDLE_VERSION = 1;
  const KEY_ROTATION_VERSION = 1;
  const DEFAULT_ATTACHMENT_CHUNK_SIZE = 256 * 1024;
  const MAX_ATTACHMENT_CHUNKS = 10000;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function cryptoApi(override) {
    const value = override || globalThis.crypto;
    if (!value?.subtle || !value?.getRandomValues) throw new Error("Web Crypto is required for encrypted synchronization");
    return value;
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
    }
    return value;
  }

  function stableStringify(value) {
    return JSON.stringify(stableValue(value));
  }

  function bytes(value) {
    return typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
  }

  function base64UrlEncode(value) {
    const input = bytes(value);
    let binary = "";
    input.forEach(byte => { binary += String.fromCharCode(byte); });
    const encoded = typeof btoa === "function" ? btoa(binary) : Buffer.from(input).toString("base64");
    return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlDecode(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]*$/.test(value)) throw new Error("Invalid base64url value");
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
    const binary = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }

  function randomBytes(length, cryptoOverride) {
    const value = new Uint8Array(length);
    cryptoApi(cryptoOverride).getRandomValues(value);
    return value;
  }

  async function sha256(value, cryptoOverride) {
    return new Uint8Array(await cryptoApi(cryptoOverride).subtle.digest("SHA-256", bytes(value)));
  }

  async function importSigningKey(jwk, usage, cryptoOverride) {
    return cryptoApi(cryptoOverride).subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [usage]);
  }

  async function importAgreementKey(jwk, usage, cryptoOverride) {
    return cryptoApi(cryptoOverride).subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, usage ? [usage] : []);
  }

  async function sign(value, privateJwk, cryptoOverride) {
    const api = cryptoApi(cryptoOverride);
    const key = await importSigningKey(privateJwk, "sign", api);
    return base64UrlEncode(await api.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, bytes(stableStringify(value))));
  }

  async function verify(value, signature, publicJwk, cryptoOverride) {
    try {
      const api = cryptoApi(cryptoOverride);
      const key = await importSigningKey(publicJwk, "verify", api);
      return api.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, base64UrlDecode(signature), bytes(stableStringify(value)));
    } catch (_) {
      return false;
    }
  }

  async function generateDeviceCredentials({ deviceId, createdAt = new Date().toISOString(), crypto: cryptoOverride } = {}) {
    if (typeof deviceId !== "string" || !deviceId) throw new Error("A device ID is required");
    const api = cryptoApi(cryptoOverride);
    const signing = await api.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const agreement = await api.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    return {
      version: 1,
      deviceId,
      createdAt,
      signing: {
        publicJwk: await api.subtle.exportKey("jwk", signing.publicKey),
        privateJwk: await api.subtle.exportKey("jwk", signing.privateKey)
      },
      agreement: {
        publicJwk: await api.subtle.exportKey("jwk", agreement.publicKey),
        privateJwk: await api.subtle.exportKey("jwk", agreement.privateKey)
      }
    };
  }

  function generateProfileKey(cryptoOverride) {
    return base64UrlEncode(randomBytes(32, cryptoOverride));
  }

  async function createEnrollmentRequest(credentials, {
    profileId,
    nonce = base64UrlEncode(randomBytes(16)),
    createdAt = new Date().toISOString(),
    invitationHash = null,
    authorizerDeviceId = null,
    deviceLabel = null,
    crypto: cryptoOverride
  } = {}) {
    if (!profileId) throw new Error("A sync profile ID is required");
    const request = {
      version: 1,
      type: "selfchat-enrollment-request",
      profileId,
      deviceId: credentials.deviceId,
      nonce,
      createdAt,
      signingPublicJwk: credentials.signing.publicJwk,
      agreementPublicJwk: credentials.agreement.publicJwk,
      ...(invitationHash ? { invitationHash } : {}),
      ...(authorizerDeviceId ? { authorizerDeviceId } : {}),
      ...(deviceLabel ? { deviceLabel: String(deviceLabel).slice(0, 80) } : {})
    };
    return { ...request, proof: await sign(request, credentials.signing.privateJwk, cryptoOverride) };
  }

  async function verifyEnrollmentRequest(request, cryptoOverride) {
    if (request?.version !== 1 || request?.type !== "selfchat-enrollment-request" || !request.deviceId || !request.profileId || !request.nonce) return false;
    const { proof, ...body } = request;
    return verify(body, proof, request.signingPublicJwk, cryptoOverride);
  }

  async function createPairingInvitation(credentials, profile, {
    nonce = base64UrlEncode(randomBytes(16)),
    createdAt = new Date().toISOString(),
    expiresAt = new Date(Date.parse(createdAt) + 10 * 60 * 1000).toISOString(),
    deviceLabel = null,
    crypto: cryptoOverride
  } = {}) {
    if (!profile?.id) throw new Error("A sync profile is required");
    const invitation = {
      version: 1,
      type: "selfchat-pairing-invitation",
      profileId: profile.id,
      authorizerDeviceId: credentials.deviceId,
      authorizerSigningPublicJwk: credentials.signing.publicJwk,
      authorizerAgreementPublicJwk: credentials.agreement.publicJwk,
      nonce,
      createdAt,
      expiresAt,
      ...(deviceLabel ? { deviceLabel: String(deviceLabel).slice(0, 80) } : {})
    };
    return { ...invitation, signature: await sign(invitation, credentials.signing.privateJwk, cryptoOverride) };
  }

  async function verifyPairingInvitation(invitation, { now = Date.now(), crypto: cryptoOverride } = {}) {
    if (invitation?.version !== 1 || invitation?.type !== "selfchat-pairing-invitation" || !invitation.profileId || !invitation.authorizerDeviceId || !invitation.nonce) return false;
    if (!Number.isFinite(Date.parse(invitation.expiresAt)) || now > Date.parse(invitation.expiresAt)) return false;
    const { signature, ...body } = invitation;
    return verify(body, signature, invitation.authorizerSigningPublicJwk, cryptoOverride);
  }

  async function pairingVerificationCode(value, cryptoOverride) {
    const digest = base64UrlEncode(await sha256(stableStringify(value), cryptoOverride)).slice(0, 12).toUpperCase();
    return digest.match(/.{1,4}/g).join("-");
  }

  async function deriveEnrollmentKey(privateJwk, publicJwk, salt, info, cryptoOverride) {
    const api = cryptoApi(cryptoOverride);
    const privateKey = await importAgreementKey(privateJwk, "deriveBits", api);
    const publicKey = await importAgreementKey(publicJwk, null, api);
    const secret = await api.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
    const hkdf = await api.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
    return api.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: bytes(info) }, hkdf, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  async function issueEnrollmentGrant(request, authorizerCredentials, profile, {
    createdAt = new Date().toISOString(),
    expiresAt = new Date(Date.parse(createdAt) + 10 * 60 * 1000).toISOString(),
    crypto: cryptoOverride
  } = {}) {
    const api = cryptoApi(cryptoOverride);
    if (!(await verifyEnrollmentRequest(request, api))) throw new Error("Enrollment request proof is invalid");
    if (!profile?.id || profile.id !== request.profileId || !profile.keyMaterial) throw new Error("Enrollment request targets another sync profile");
    const ephemeral = await api.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const ephemeralPrivate = await api.subtle.exportKey("jwk", ephemeral.privateKey);
    const ephemeralPublic = await api.subtle.exportKey("jwk", ephemeral.publicKey);
    const salt = randomBytes(16, api);
    const iv = randomBytes(12, api);
    const info = `selfchat-enrollment:${request.profileId}:${request.nonce}`;
    const wrappingKey = await deriveEnrollmentKey(ephemeralPrivate, request.agreementPublicJwk, salt, info, api);
    const requestHash = base64UrlEncode(await sha256(stableStringify(request), api));
    const wrappedProfileKey = await api.subtle.encrypt({ name: "AES-GCM", iv, additionalData: bytes(requestHash) }, wrappingKey, base64UrlDecode(profile.keyMaterial));
    const grant = {
      version: 1,
      type: "selfchat-enrollment-grant",
      profileId: request.profileId,
      keyEpoch: Number.isSafeInteger(profile.keyEpoch) ? profile.keyEpoch : 1,
      requesterDeviceId: request.deviceId,
      authorizerDeviceId: authorizerCredentials.deviceId,
      requestHash,
      createdAt,
      expiresAt,
      ephemeralAgreementPublicJwk: ephemeralPublic,
      authorizerSigningPublicJwk: authorizerCredentials.signing.publicJwk,
      salt: base64UrlEncode(salt),
      iv: base64UrlEncode(iv),
      wrappedProfileKey: base64UrlEncode(wrappedProfileKey)
    };
    return { ...grant, signature: await sign(grant, authorizerCredentials.signing.privateJwk, api) };
  }

  async function acceptEnrollmentGrant(grant, request, requesterCredentials, trustedAuthorizer, {
    now = Date.now(),
    crypto: cryptoOverride
  } = {}) {
    const api = cryptoApi(cryptoOverride);
    const { signature, ...body } = grant || {};
    if (body.version !== 1 || body.type !== "selfchat-enrollment-grant") throw new Error("Unsupported enrollment grant");
    if (body.authorizerDeviceId !== trustedAuthorizer?.deviceId) throw new Error("Enrollment grant authorizer is not trusted");
    if (!(await verify(body, signature, trustedAuthorizer.signingPublicJwk, api))) throw new Error("Enrollment grant signature is invalid");
    if (!(await verifyEnrollmentRequest(request, api))) throw new Error("Enrollment request proof is invalid");
    if (body.profileId !== request.profileId || body.requesterDeviceId !== requesterCredentials.deviceId) throw new Error("Enrollment grant target does not match this device");
    const requestHash = base64UrlEncode(await sha256(stableStringify(request), api));
    if (body.requestHash !== requestHash) throw new Error("Enrollment grant does not match the request");
    if (!Number.isFinite(Date.parse(body.expiresAt)) || now > Date.parse(body.expiresAt)) throw new Error("Enrollment grant has expired");
    const info = `selfchat-enrollment:${body.profileId}:${request.nonce}`;
    const wrappingKey = await deriveEnrollmentKey(requesterCredentials.agreement.privateJwk, body.ephemeralAgreementPublicJwk, base64UrlDecode(body.salt), info, api);
    const raw = await api.subtle.decrypt({ name: "AES-GCM", iv: base64UrlDecode(body.iv), additionalData: bytes(requestHash) }, wrappingKey, base64UrlDecode(body.wrappedProfileKey));
    return base64UrlEncode(raw);
  }

  async function createKeyRotationPackage(credentials, profile, authorizedDevices, revokedDeviceId, {
    createdAt = new Date().toISOString(),
    crypto: cryptoOverride
  } = {}) {
    const api = cryptoApi(cryptoOverride);
    if (!profile?.id || !profile?.keyMaterial) throw new Error("A sync profile is required");
    if (!revokedDeviceId || revokedDeviceId === credentials.deviceId) throw new Error("The current device cannot revoke itself");
    const devices = Array.isArray(authorizedDevices) ? authorizedDevices : [];
    const target = devices.find(device => device.deviceId === revokedDeviceId && !device.revokedAt);
    if (!target) throw new Error("The device is not currently authorized");
    const keyEpoch = (Number.isSafeInteger(profile.keyEpoch) ? profile.keyEpoch : 1) + 1;
    const retainedDevices = devices
      .filter(device => device.deviceId !== revokedDeviceId && !device.revokedAt && !device.blockedAt)
      .map(device => ({
        deviceId: device.deviceId,
        label: device.label || "Paired device",
        signingPublicJwk: device.signingPublicJwk,
        agreementPublicJwk: device.agreementPublicJwk,
        authorizedAt: device.authorizedAt,
        authorizedBy: device.authorizedBy
      }));
    if (!retainedDevices.some(device => device.deviceId === credentials.deviceId)) throw new Error("The rotating device is not authorized");
    if (retainedDevices.some(device => !device.agreementPublicJwk)) throw new Error("Every retained device needs a key-agreement identity before rotation");
    const newKeyMaterial = generateProfileKey(api);
    const manifest = {
      version: KEY_ROTATION_VERSION,
      type: "selfchat-key-rotation",
      profileId: profile.id,
      previousKeyEpoch: keyEpoch - 1,
      keyEpoch,
      authorizerDeviceId: credentials.deviceId,
      revokedDeviceIds: devices.filter(device => device.deviceId === revokedDeviceId || device.revokedAt || device.blockedAt).map(device => device.deviceId),
      authorizedDevices: retainedDevices,
      createdAt
    };
    const grants = [];
    for (const device of retainedDevices) {
      const ephemeral = await api.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
      const ephemeralPrivate = await api.subtle.exportKey("jwk", ephemeral.privateKey);
      const ephemeralPublic = await api.subtle.exportKey("jwk", ephemeral.publicKey);
      const salt = randomBytes(16, api);
      const iv = randomBytes(12, api);
      const info = `selfchat-key-rotation:${profile.id}:${keyEpoch}:${device.deviceId}`;
      const wrappingKey = await deriveEnrollmentKey(ephemeralPrivate, device.agreementPublicJwk, salt, info, api);
      const aad = stableStringify({ manifest, deviceId: device.deviceId });
      const wrappedProfileKey = await api.subtle.encrypt({ name: "AES-GCM", iv, additionalData: bytes(aad) }, wrappingKey, base64UrlDecode(newKeyMaterial));
      grants.push({
        deviceId: device.deviceId,
        ephemeralAgreementPublicJwk: ephemeralPublic,
        salt: base64UrlEncode(salt),
        iv: base64UrlEncode(iv),
        wrappedProfileKey: base64UrlEncode(wrappedProfileKey)
      });
    }
    const signed = { manifest, grants };
    return {
      rotationPackage: { ...signed, signature: await sign(signed, credentials.signing.privateJwk, api) },
      newKeyMaterial
    };
  }

  async function acceptKeyRotationPackage(rotationPackage, credentials, profile, trustedAuthorizer, {
    crypto: cryptoOverride
  } = {}) {
    const api = cryptoApi(cryptoOverride);
    const { signature, ...signed } = rotationPackage || {};
    const manifest = signed.manifest || {};
    const currentEpoch = Number.isSafeInteger(profile?.keyEpoch) ? profile.keyEpoch : 1;
    if (manifest.version !== KEY_ROTATION_VERSION || manifest.type !== "selfchat-key-rotation") throw new Error("Unsupported key rotation package");
    if (manifest.profileId !== profile?.id) throw new Error("Key rotation belongs to another sync profile");
    if (manifest.authorizerDeviceId !== trustedAuthorizer?.deviceId) throw new Error("Key rotation authorizer is not trusted");
    if (!(await verify(signed, signature, trustedAuthorizer.signingPublicJwk, api))) throw new Error("Key rotation signature is invalid");
    if (manifest.previousKeyEpoch !== currentEpoch || manifest.keyEpoch !== currentEpoch + 1) throw new Error("Key rotation is stale or skips a key epoch");
    if (!Array.isArray(manifest.revokedDeviceIds) || !manifest.revokedDeviceIds.length || new Set(manifest.revokedDeviceIds).size !== manifest.revokedDeviceIds.length) throw new Error("Key rotation revocation list is invalid");
    if (!Array.isArray(manifest.authorizedDevices) || manifest.authorizedDevices.some(device => !device?.deviceId || manifest.revokedDeviceIds.includes(device.deviceId))) throw new Error("Key rotation device registry is invalid");
    const retainedIds = new Set(manifest.authorizedDevices.map(device => device.deviceId));
    if (retainedIds.size !== manifest.authorizedDevices.length || !retainedIds.has(manifest.authorizerDeviceId)) throw new Error("Key rotation device registry is invalid");
    if (!Array.isArray(signed.grants)) throw new Error("Key rotation grants do not match the device registry");
    const selfDevice = manifest.authorizedDevices.find(device => device.deviceId === credentials.deviceId);
    const grant = signed.grants.find(item => item.deviceId === credentials.deviceId);
    if (!selfDevice || !grant || manifest.revokedDeviceIds.includes(credentials.deviceId)) throw new Error("This device was revoked by the key rotation");
    if (stableStringify(selfDevice.signingPublicJwk) !== stableStringify(credentials.signing.publicJwk) || stableStringify(selfDevice.agreementPublicJwk) !== stableStringify(credentials.agreement.publicJwk)) throw new Error("Key rotation changes this device identity");
    if (signed.grants.length !== manifest.authorizedDevices.length || new Set(signed.grants.map(item => item.deviceId)).size !== signed.grants.length || signed.grants.some(item => !retainedIds.has(item.deviceId))) throw new Error("Key rotation grants do not match the device registry");
    const info = `selfchat-key-rotation:${profile.id}:${manifest.keyEpoch}:${credentials.deviceId}`;
    const wrappingKey = await deriveEnrollmentKey(credentials.agreement.privateJwk, grant.ephemeralAgreementPublicJwk, base64UrlDecode(grant.salt), info, api);
    const aad = stableStringify({ manifest, deviceId: credentials.deviceId });
    const raw = await api.subtle.decrypt({ name: "AES-GCM", iv: base64UrlDecode(grant.iv), additionalData: bytes(aad) }, wrappingKey, base64UrlDecode(grant.wrappedProfileKey));
    return { keyMaterial: base64UrlEncode(raw), keyEpoch: manifest.keyEpoch, authorizedDevices: manifest.authorizedDevices, revokedDeviceIds: manifest.revokedDeviceIds };
  }

  async function importProfileKey(profileKey, usage, cryptoOverride) {
    return cryptoApi(cryptoOverride).subtle.importKey("raw", base64UrlDecode(profileKey), { name: "AES-GCM" }, false, [usage]);
  }

  async function attachmentBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (value?.arrayBuffer) return new Uint8Array(await value.arrayBuffer());
    throw new Error("Attachment bytes are unavailable");
  }

  function attachmentChunkAad(manifest, index) {
    return bytes(stableStringify({ manifest, index }));
  }

  async function createEncryptedAttachmentBundle(record, credentials, profile, {
    chunkSize = DEFAULT_ATTACHMENT_CHUNK_SIZE,
    createdAt = new Date().toISOString(),
    crypto: cryptoOverride
  } = {}) {
    if (!record?.id || !record.blob) throw new Error("An attachment record with bytes is required");
    if (!Number.isSafeInteger(chunkSize) || chunkSize < 1024 || chunkSize > 4 * 1024 * 1024) throw new Error("Attachment chunk size is invalid");
    const api = cryptoApi(cryptoOverride);
    const content = await attachmentBytes(record.blob);
    const chunkCount = Math.max(1, Math.ceil(content.byteLength / chunkSize));
    if (chunkCount > MAX_ATTACHMENT_CHUNKS) throw new Error("Attachment requires too many encrypted chunks");
    const manifest = {
      version: ATTACHMENT_BUNDLE_VERSION,
      type: "selfchat-attachment-bundle",
      profileId: profile.id,
      keyEpoch: Number.isSafeInteger(profile.keyEpoch) ? profile.keyEpoch : 1,
      deviceId: credentials.deviceId,
      attachmentId: record.id,
      size: content.byteLength,
      chunkSize,
      chunkCount,
      createdAt
    };
    const key = await importProfileKey(profile.keyMaterial, "encrypt", api);
    const chunks = [];
    for (let index = 0; index < chunkCount; index += 1) {
      const iv = randomBytes(12, api);
      const start = index * chunkSize;
      const plaintext = content.slice(start, Math.min(content.byteLength, start + chunkSize));
      const ciphertext = await api.subtle.encrypt({ name: "AES-GCM", iv, additionalData: attachmentChunkAad(manifest, index) }, key, plaintext);
      chunks.push({ index, iv: base64UrlEncode(iv), ciphertext: base64UrlEncode(ciphertext) });
    }
    const integrityIv = randomBytes(12, api);
    const contentHash = base64UrlEncode(await sha256(content, api));
    const integrityCiphertext = await api.subtle.encrypt({ name: "AES-GCM", iv: integrityIv, additionalData: bytes(stableStringify(manifest)) }, key, bytes(stableStringify({ contentHash })));
    const signed = {
      manifest,
      integrity: { iv: base64UrlEncode(integrityIv), ciphertext: base64UrlEncode(integrityCiphertext) },
      chunks
    };
    return { ...signed, signature: await sign(signed, credentials.signing.privateJwk, api) };
  }

  async function openEncryptedAttachmentBundle(bundle, profile, authorizedDevice, expected = {}, {
    crypto: cryptoOverride
  } = {}) {
    const api = cryptoApi(cryptoOverride);
    const { signature, ...signed } = bundle || {};
    const manifest = signed.manifest || {};
    if (manifest.version !== ATTACHMENT_BUNDLE_VERSION || manifest.type !== "selfchat-attachment-bundle") throw new Error("Unsupported attachment bundle");
    if (manifest.profileId !== profile.id) throw new Error("Attachment bundle belongs to another sync profile");
    if (manifest.keyEpoch !== (Number.isSafeInteger(profile.keyEpoch) ? profile.keyEpoch : 1)) throw new Error("Attachment bundle uses another profile-key epoch");
    if (manifest.deviceId !== authorizedDevice?.deviceId) throw new Error("Attachment bundle signer is not authorized for the claimed device");
    if (!manifest.attachmentId || manifest.attachmentId !== expected.id) throw new Error("Attachment bundle does not match its encrypted reference");
    if (!Number.isSafeInteger(manifest.size) || manifest.size < 0 || manifest.size !== Number(expected.size)) throw new Error("Attachment bundle size does not match its encrypted reference");
    if (!Number.isSafeInteger(manifest.chunkSize) || manifest.chunkSize < 1024 || manifest.chunkSize > 4 * 1024 * 1024) throw new Error("Attachment bundle chunk size is invalid");
    if (!Number.isSafeInteger(manifest.chunkCount) || manifest.chunkCount < 1 || manifest.chunkCount > MAX_ATTACHMENT_CHUNKS) throw new Error("Attachment bundle chunk count is invalid");
    if (!Array.isArray(signed.chunks) || signed.chunks.length !== manifest.chunkCount) throw new Error("Attachment bundle is missing encrypted chunks");
    if (!(await verify(signed, signature, authorizedDevice.signingPublicJwk, api))) throw new Error("Attachment bundle signature is invalid");
    const key = await importProfileKey(profile.keyMaterial, "decrypt", api);
    const integrityPlaintext = await api.subtle.decrypt({ name: "AES-GCM", iv: base64UrlDecode(signed.integrity?.iv), additionalData: bytes(stableStringify(manifest)) }, key, base64UrlDecode(signed.integrity?.ciphertext));
    const integrity = JSON.parse(decoder.decode(integrityPlaintext));
    const plaintextChunks = [];
    let totalSize = 0;
    for (let index = 0; index < signed.chunks.length; index += 1) {
      const chunk = signed.chunks[index];
      if (chunk?.index !== index) throw new Error("Attachment bundle chunks are missing, duplicated, or out of order");
      const plaintext = new Uint8Array(await api.subtle.decrypt({ name: "AES-GCM", iv: base64UrlDecode(chunk.iv), additionalData: attachmentChunkAad(manifest, index) }, key, base64UrlDecode(chunk.ciphertext)));
      const expectedLength = index === manifest.chunkCount - 1 ? manifest.size - (index * manifest.chunkSize) : manifest.chunkSize;
      if (plaintext.byteLength !== expectedLength) throw new Error("Attachment bundle chunk length is invalid");
      totalSize += plaintext.byteLength;
      plaintextChunks.push(plaintext);
    }
    if (totalSize !== manifest.size) throw new Error("Attachment bundle size is invalid");
    const content = new Uint8Array(totalSize);
    let offset = 0;
    plaintextChunks.forEach(chunk => { content.set(chunk, offset); offset += chunk.byteLength; });
    const actualHash = base64UrlEncode(await sha256(content, api));
    if (integrity?.contentHash !== actualHash) throw new Error("Attachment bundle integrity check failed");
    return {
      id: expected.id,
      name: expected.name || "",
      type: expected.type || "",
      size: manifest.size,
      blob: new Blob([content], { type: expected.type || "" })
    };
  }

  async function createOperationEnvelope(operations, credentials, profile, {
    sequence,
    createdAt = new Date().toISOString(),
    crypto: cryptoOverride
  } = {}) {
    if (!Array.isArray(operations) || !operations.length) throw new Error("At least one operation is required");
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("A positive envelope sequence is required");
    const api = cryptoApi(cryptoOverride);
    const header = {
      version: ENVELOPE_VERSION,
      type: "selfchat-operation-envelope",
      profileId: profile.id,
      keyEpoch: Number.isSafeInteger(profile.keyEpoch) ? profile.keyEpoch : 1,
      deviceId: credentials.deviceId,
      sequence,
      createdAt,
      operationIds: operations.map(operation => operation.id)
    };
    const iv = randomBytes(12, api);
    const key = await importProfileKey(profile.keyMaterial, "encrypt", api);
    const ciphertext = await api.subtle.encrypt({ name: "AES-GCM", iv, additionalData: bytes(stableStringify(header)) }, key, bytes(stableStringify({ operations })));
    const signed = { header, iv: base64UrlEncode(iv), ciphertext: base64UrlEncode(ciphertext) };
    return { ...signed, signature: await sign(signed, credentials.signing.privateJwk, api) };
  }

  async function openOperationEnvelope(envelope, profile, authorizedDevice, {
    minimumSequence = 0,
    crypto: cryptoOverride
  } = {}) {
    const api = cryptoApi(cryptoOverride);
    const { signature, ...signed } = envelope || {};
    const header = signed.header || {};
    if (header.version !== ENVELOPE_VERSION || header.type !== "selfchat-operation-envelope") throw new Error("Unsupported operation envelope");
    if (header.profileId !== profile.id) throw new Error("Operation envelope belongs to another sync profile");
    if (header.keyEpoch !== (Number.isSafeInteger(profile.keyEpoch) ? profile.keyEpoch : 1)) throw new Error("Operation envelope uses another profile-key epoch");
    if (header.deviceId !== authorizedDevice?.deviceId) throw new Error("Operation envelope signer is not authorized for the claimed device");
    if (!Number.isSafeInteger(header.sequence) || header.sequence <= minimumSequence) throw new Error("Operation envelope is stale or replayed");
    if (!(await verify(signed, signature, authorizedDevice.signingPublicJwk, api))) throw new Error("Operation envelope signature is invalid");
    const key = await importProfileKey(profile.keyMaterial, "decrypt", api);
    const plaintext = await api.subtle.decrypt({ name: "AES-GCM", iv: base64UrlDecode(signed.iv), additionalData: bytes(stableStringify(header)) }, key, base64UrlDecode(signed.ciphertext));
    const payload = JSON.parse(decoder.decode(plaintext));
    if (!Array.isArray(payload.operations) || stableStringify(payload.operations.map(operation => operation.id)) !== stableStringify(header.operationIds)) {
      throw new Error("Operation envelope contents do not match its authenticated header");
    }
    return { header, operations: payload.operations };
  }

  async function createErasureEnvelope(markers, credentials, profile, {
    sequence,
    createdAt = new Date().toISOString(),
    crypto: cryptoOverride
  } = {}) {
    if (!Array.isArray(markers) || !markers.length) throw new Error("At least one erasure marker is required");
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("A positive erasure sequence is required");
    const api = cryptoApi(cryptoOverride);
    const header = {
      version: ENVELOPE_VERSION,
      type: "selfchat-erasure-envelope",
      profileId: profile.id,
      keyEpoch: profile.keyEpoch,
      deviceId: credentials.deviceId,
      sequence,
      createdAt,
      markerCount: markers.length
    };
    const iv = randomBytes(12, api);
    const key = await importProfileKey(profile.keyMaterial, "encrypt", api);
    const ciphertext = await api.subtle.encrypt({ name: "AES-GCM", iv, additionalData: bytes(stableStringify(header)) }, key, bytes(stableStringify({ markers })));
    const signed = { header, iv: base64UrlEncode(iv), ciphertext: base64UrlEncode(ciphertext) };
    return { ...signed, signature: await sign(signed, credentials.signing.privateJwk, api) };
  }

  async function openErasureEnvelope(envelope, profile, authorizedDevice, {
    minimumSequence = 0,
    crypto: cryptoOverride
  } = {}) {
    const api = cryptoApi(cryptoOverride);
    const { signature, ...signed } = envelope || {};
    const header = signed.header || {};
    if (header.version !== ENVELOPE_VERSION || header.type !== "selfchat-erasure-envelope") throw new Error("Unsupported erasure envelope");
    if (header.profileId !== profile.id) throw new Error("Erasure envelope belongs to another sync profile");
    if (header.keyEpoch !== profile.keyEpoch) throw new Error("Erasure envelope uses an unavailable key epoch");
    if (header.deviceId !== authorizedDevice.deviceId) throw new Error("Erasure envelope device is not authorized");
    if (!Number.isSafeInteger(header.sequence) || header.sequence <= minimumSequence) throw new Error("Erasure envelope is stale or replayed");
    if (!Number.isSafeInteger(header.markerCount) || header.markerCount < 1 || header.markerCount > 10000) throw new Error("Erasure envelope marker count is invalid");
    if (!(await verify(signed, signature, authorizedDevice.signingPublicJwk, api))) throw new Error("Erasure envelope signature is invalid");
    const key = await importProfileKey(profile.keyMaterial, "decrypt", api);
    const plaintext = await api.subtle.decrypt({ name: "AES-GCM", iv: base64UrlDecode(signed.iv), additionalData: bytes(stableStringify(header)) }, key, base64UrlDecode(signed.ciphertext));
    const payload = JSON.parse(decoder.decode(plaintext));
    if (!Array.isArray(payload.markers) || payload.markers.length !== header.markerCount) throw new Error("Erasure envelope contents do not match its authenticated header");
    return { header, markers: payload.markers };
  }

  return {
    ENVELOPE_VERSION,
    ATTACHMENT_BUNDLE_VERSION,
    KEY_ROTATION_VERSION,
    DEFAULT_ATTACHMENT_CHUNK_SIZE,
    stableStringify,
    base64UrlEncode,
    base64UrlDecode,
    generateDeviceCredentials,
    generateProfileKey,
    createEnrollmentRequest,
    verifyEnrollmentRequest,
    createPairingInvitation,
    verifyPairingInvitation,
    pairingVerificationCode,
    issueEnrollmentGrant,
    acceptEnrollmentGrant,
    createKeyRotationPackage,
    acceptKeyRotationPackage,
    createEncryptedAttachmentBundle,
    openEncryptedAttachmentBundle,
    createOperationEnvelope,
    openOperationEnvelope,
    createErasureEnvelope,
    openErasureEnvelope
  };
});
