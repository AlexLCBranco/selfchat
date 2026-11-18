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
    syncCrypto.openOperationEnvelope({ ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -1)}A` }, profile, authorizedDevice, { crypto: webcrypto }),
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
