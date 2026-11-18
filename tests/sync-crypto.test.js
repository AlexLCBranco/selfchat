const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const syncCrypto = require("../sync-crypto.js");

test("device enrollment proves possession and transfers the profile key only to the requested device", async () => {
  const authorizer = await syncCrypto.generateDeviceCredentials({ deviceId: "device-a", crypto: webcrypto });
  const requester = await syncCrypto.generateDeviceCredentials({ deviceId: "device-b", crypto: webcrypto });
  const profileKey = syncCrypto.generateProfileKey(webcrypto);
  const profile = { id: "profile-1", keyMaterial: profileKey };
  const request = await syncCrypto.createEnrollmentRequest(requester, {
    profileId: "profile-1",
    nonce: "fixed-nonce",
    createdAt: "2026-11-18T12:00:00.000Z",
    crypto: webcrypto
  });

  assert.equal(await syncCrypto.verifyEnrollmentRequest(request, webcrypto), true);
  const grant = await syncCrypto.issueEnrollmentGrant(request, authorizer, profile, {
    createdAt: "2026-11-18T12:01:00.000Z",
    expiresAt: "2026-11-18T12:11:00.000Z",
    crypto: webcrypto
  });
  const trustedAuthorizer = { deviceId: authorizer.deviceId, signingPublicJwk: authorizer.signing.publicJwk };
  const accepted = await syncCrypto.acceptEnrollmentGrant(grant, request, requester, trustedAuthorizer, {
    now: Date.parse("2026-11-18T12:02:00.000Z"),
    crypto: webcrypto
  });
  assert.equal(accepted, profileKey);

  const impostor = await syncCrypto.generateDeviceCredentials({ deviceId: "device-c", crypto: webcrypto });
  await assert.rejects(
    syncCrypto.acceptEnrollmentGrant(grant, request, impostor, trustedAuthorizer, { now: Date.parse("2026-11-18T12:02:00.000Z"), crypto: webcrypto }),
    /target does not match/
  );
});

test("expired or tampered enrollment grants are rejected", async () => {
  const authorizer = await syncCrypto.generateDeviceCredentials({ deviceId: "device-a", crypto: webcrypto });
  const requester = await syncCrypto.generateDeviceCredentials({ deviceId: "device-b", crypto: webcrypto });
  const request = await syncCrypto.createEnrollmentRequest(requester, { profileId: "profile-1", crypto: webcrypto });
  const profile = { id: "profile-1", keyMaterial: syncCrypto.generateProfileKey(webcrypto) };
  const grant = await syncCrypto.issueEnrollmentGrant(request, authorizer, profile, {
    createdAt: "2026-11-18T12:00:00.000Z",
    expiresAt: "2026-11-18T12:01:00.000Z",
    crypto: webcrypto
  });
  await assert.rejects(
    syncCrypto.acceptEnrollmentGrant(grant, request, requester, { deviceId: authorizer.deviceId, signingPublicJwk: authorizer.signing.publicJwk }, { now: Date.parse("2026-11-18T12:02:00.000Z"), crypto: webcrypto }),
    /expired/
  );
  await assert.rejects(
    syncCrypto.acceptEnrollmentGrant({ ...grant, requesterDeviceId: "attacker" }, request, requester, { deviceId: authorizer.deviceId, signingPublicJwk: authorizer.signing.publicJwk }, { now: Date.parse("2026-11-18T12:00:30.000Z"), crypto: webcrypto }),
    /signature is invalid/
  );
});

test("operation envelopes encrypt content, authenticate headers, and reject replay", async () => {
  const credentials = await syncCrypto.generateDeviceCredentials({ deviceId: "device-a", crypto: webcrypto });
  const profile = { id: "profile-1", keyMaterial: syncCrypto.generateProfileKey(webcrypto) };
  const operations = [{ id: "device-a:1", deviceId: "device-a", counter: 1, store: "messages", entityId: "m1", action: "put", value: { id: "m1", text: "private words" } }];
  const envelope = await syncCrypto.createOperationEnvelope(operations, credentials, profile, {
    sequence: 1,
    createdAt: "2026-11-18T12:00:00.000Z",
    crypto: webcrypto
  });

  assert.equal(JSON.stringify(envelope).includes("private words"), false);
  const authorizedDevice = { deviceId: credentials.deviceId, signingPublicJwk: credentials.signing.publicJwk };
  const opened = await syncCrypto.openOperationEnvelope(envelope, profile, authorizedDevice, { crypto: webcrypto });
  assert.deepEqual(opened.operations, operations);
  await assert.rejects(
    syncCrypto.openOperationEnvelope(envelope, profile, authorizedDevice, { minimumSequence: 1, crypto: webcrypto }),
    /stale or replayed/
  );
  await assert.rejects(
    syncCrypto.openOperationEnvelope({ ...envelope, ciphertext: `${envelope.ciphertext[0] === "A" ? "B" : "A"}${envelope.ciphertext.slice(1)}` }, profile, authorizedDevice, { crypto: webcrypto }),
    /signature is invalid/
  );
});

test("pairing invitations are signed, short-lived, and have a stable comparison code", async () => {
  const credentials = await syncCrypto.generateDeviceCredentials({ deviceId: "device-a", crypto: webcrypto });
  const invitation = await syncCrypto.createPairingInvitation(credentials, { id: "profile-1" }, {
    nonce: "pairing-nonce",
    createdAt: "2026-11-18T12:00:00.000Z",
    expiresAt: "2026-11-18T12:10:00.000Z",
    crypto: webcrypto
  });
  assert.equal(await syncCrypto.verifyPairingInvitation(invitation, { now: Date.parse("2026-11-18T12:05:00.000Z"), crypto: webcrypto }), true);
  assert.equal(await syncCrypto.verifyPairingInvitation(invitation, { now: Date.parse("2026-11-18T12:11:00.000Z"), crypto: webcrypto }), false);
  assert.equal(await syncCrypto.verifyPairingInvitation({ ...invitation, profileId: "attacker" }, { now: Date.parse("2026-11-18T12:05:00.000Z"), crypto: webcrypto }), false);
  assert.match(await syncCrypto.pairingVerificationCode(invitation, webcrypto), /^[A-Z0-9_-]{4}-[A-Z0-9_-]{4}-[A-Z0-9_-]{4}$/);
});

test("key rotation wraps a new epoch only for retained devices and rejects revoked or stale recipients", async () => {
  const authorizer = await syncCrypto.generateDeviceCredentials({ deviceId: "device-a", crypto: webcrypto });
  const retained = await syncCrypto.generateDeviceCredentials({ deviceId: "device-b", crypto: webcrypto });
  const revoked = await syncCrypto.generateDeviceCredentials({ deviceId: "device-c", crypto: webcrypto });
  const profile = { id: "profile-1", keyEpoch: 1, keyMaterial: syncCrypto.generateProfileKey(webcrypto) };
  const devices = [authorizer, retained, revoked].map(credentials => ({
    deviceId: credentials.deviceId,
    signingPublicJwk: credentials.signing.publicJwk,
    agreementPublicJwk: credentials.agreement.publicJwk,
    authorizedAt: "2026-11-18T12:00:00.000Z",
    authorizedBy: "device-a"
  }));
  const { rotationPackage, newKeyMaterial } = await syncCrypto.createKeyRotationPackage(authorizer, profile, devices, revoked.deviceId, {
    createdAt: "2026-11-18T13:00:00.000Z",
    crypto: webcrypto
  });

  assert.deepEqual(rotationPackage.manifest.revokedDeviceIds, ["device-c"]);
  assert.deepEqual(rotationPackage.grants.map(grant => grant.deviceId), ["device-a", "device-b"]);
  assert.equal(JSON.stringify(rotationPackage).includes(newKeyMaterial), false);
  const accepted = await syncCrypto.acceptKeyRotationPackage(rotationPackage, retained, profile, devices[0], { crypto: webcrypto });
  assert.equal(accepted.keyEpoch, 2);
  assert.equal(accepted.keyMaterial, newKeyMaterial);
  await assert.rejects(syncCrypto.acceptKeyRotationPackage(rotationPackage, revoked, profile, devices[0], { crypto: webcrypto }), /revoked/);
  await assert.rejects(syncCrypto.acceptKeyRotationPackage(rotationPackage, retained, { ...profile, keyEpoch: 2 }, devices[0], { crypto: webcrypto }), /stale or skips/);

  const rotatedProfile = { ...profile, keyEpoch: 2, keyMaterial: newKeyMaterial };
  const envelope = await syncCrypto.createOperationEnvelope([{ id: "device-a:1", deviceId: "device-a", counter: 1, store: "messages", entityId: "m1", action: "delete" }], authorizer, rotatedProfile, { sequence: 1, crypto: webcrypto });
  await assert.rejects(syncCrypto.openOperationEnvelope(envelope, profile, devices[0], { crypto: webcrypto }), /another profile-key epoch/);
});

test("attachment bundles encrypt multiple chunks and restore bytes only after integrity verification", async () => {
  const credentials = await syncCrypto.generateDeviceCredentials({ deviceId: "device-a", crypto: webcrypto });
  const profile = { id: "profile-1", keyMaterial: syncCrypto.generateProfileKey(webcrypto) };
  const secret = "private attachment phrase ".repeat(140);
  const record = { id: "file-1", name: "notes.txt", type: "text/plain", size: secret.length, blob: new Blob([secret], { type: "text/plain" }) };
  const bundle = await syncCrypto.createEncryptedAttachmentBundle(record, credentials, profile, {
    chunkSize: 1024,
    createdAt: "2026-11-18T12:00:00.000Z",
    crypto: webcrypto
  });

  assert.equal(bundle.chunks.length > 1, true);
  assert.equal(JSON.stringify(bundle).includes("private attachment phrase"), false);
  assert.equal(JSON.stringify(bundle).includes("notes.txt"), false);
  const opened = await syncCrypto.openEncryptedAttachmentBundle(bundle, profile, {
    deviceId: credentials.deviceId,
    signingPublicJwk: credentials.signing.publicJwk
  }, { id: record.id, name: record.name, type: record.type, size: record.blob.size }, { crypto: webcrypto });
  assert.equal(await opened.blob.text(), secret);
  assert.equal(opened.name, "notes.txt");
  assert.equal(opened.type, "text/plain");
});

test("attachment bundles reject tampering, missing or reordered chunks, wrong profiles, and wrong signers", async () => {
  const credentials = await syncCrypto.generateDeviceCredentials({ deviceId: "device-a", crypto: webcrypto });
  const impostor = await syncCrypto.generateDeviceCredentials({ deviceId: "device-b", crypto: webcrypto });
  const profile = { id: "profile-1", keyMaterial: syncCrypto.generateProfileKey(webcrypto) };
  const record = { id: "file-1", name: "file.bin", type: "application/octet-stream", blob: new Blob([new Uint8Array(2500)]) };
  const expected = { id: record.id, name: record.name, type: record.type, size: record.blob.size };
  const authorized = { deviceId: credentials.deviceId, signingPublicJwk: credentials.signing.publicJwk };
  const bundle = await syncCrypto.createEncryptedAttachmentBundle(record, credentials, profile, { chunkSize: 1024, crypto: webcrypto });

  await assert.rejects(syncCrypto.openEncryptedAttachmentBundle({ ...bundle, chunks: bundle.chunks.slice(1) }, profile, authorized, expected, { crypto: webcrypto }), /missing encrypted chunks/);
  await assert.rejects(syncCrypto.openEncryptedAttachmentBundle({ ...bundle, chunks: [bundle.chunks[1], bundle.chunks[0], ...bundle.chunks.slice(2)] }, profile, authorized, expected, { crypto: webcrypto }), /signature is invalid/);
  await assert.rejects(syncCrypto.openEncryptedAttachmentBundle({ ...bundle, chunks: [bundle.chunks[0], bundle.chunks[0], ...bundle.chunks.slice(2)] }, profile, authorized, expected, { crypto: webcrypto }), /signature is invalid/);
  await assert.rejects(syncCrypto.openEncryptedAttachmentBundle({ ...bundle, integrity: { ...bundle.integrity, ciphertext: `${bundle.integrity.ciphertext[0] === "A" ? "B" : "A"}${bundle.integrity.ciphertext.slice(1)}` } }, profile, authorized, expected, { crypto: webcrypto }), /signature is invalid/);
  await assert.rejects(syncCrypto.openEncryptedAttachmentBundle(bundle, { ...profile, id: "other-profile" }, authorized, expected, { crypto: webcrypto }), /another sync profile/);
  await assert.rejects(syncCrypto.openEncryptedAttachmentBundle(bundle, profile, { deviceId: credentials.deviceId, signingPublicJwk: impostor.signing.publicJwk }, expected, { crypto: webcrypto }), /signature is invalid/);
});
