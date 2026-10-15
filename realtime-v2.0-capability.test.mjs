import test from "node:test";
import assert from "node:assert/strict";
import {
  createOfflineRevocationRegistry,
  generateEphemeralCapabilityKeyPair,
  issueOfflineCapability,
  revokeOfflineCapability,
  verifyOfflineCapability,
} from "./realtime-v2.0-capability.mjs";

const SESSION = "mock_session_stage1a";
const CONTEXT = "mockctx_stage1context";
const ORIGIN = "lab://voice-test";
const SCOPE = "voice:session:open";
const POLICY = new Set([SCOPE, "voice:session:close"]);

function issue(overrides = {}) {
  const keys = overrides.keys ?? generateEphemeralCapabilityKeyPair();
  const result = issueOfflineCapability({
    privateKey: keys.privateKey,
    sessionId: SESSION,
    contextId: CONTEXT,
    origin: ORIGIN,
    scope: SCOPE,
    authorizedScopes: POLICY,
    now: 1_000_000,
    ttlMs: 30_000,
    jti: "mockcap_stage1token",
    ...overrides,
    keys: undefined,
  });
  return { keys, result };
}

function verificationContext(keys, overrides = {}) {
  return {
    publicKey: keys.publicKey,
    now: 1_010_000,
    expectedSessionId: SESSION,
    expectedContextId: CONTEXT,
    expectedOrigin: ORIGIN,
    requiredScope: SCOPE,
    allowedScopes: POLICY,
    replayGuard: new Set(),
    revocationRegistry: createOfflineRevocationRegistry(),
    ...overrides,
  };
}

test("issues and verifies a one-use signed offline capability", () => {
  const { keys, result } = issue();
  assert.equal(result.ok, true);
  const context = verificationContext(keys);
  const verified = verifyOfflineCapability(result.token, context);
  assert.equal(verified.ok, true);
  assert.deepEqual(verified.capability, {
    sessionId: SESSION,
    contextId: CONTEXT,
    origin: ORIGIN,
    scope: SCOPE,
    expiresAt: 1_030_000,
    jti: "mockcap_stage1token",
  });
  assert.equal(context.replayGuard.has("mockcap_stage1token"), true);
});

test("rejects replay of the same capability", () => {
  const { keys, result } = issue();
  const context = verificationContext(keys, { now: 1_005_000 });
  assert.equal(verifyOfflineCapability(result.token, context).ok, true);
  assert.deepEqual(verifyOfflineCapability(result.token, context), {
    ok: false,
    error: "capability_replayed",
  });
});

test("rejects a tampered signed body", () => {
  const { keys, result } = issue();
  const [prefix, body, signature] = result.token.split(".");
  const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  claims.sid = "mock_other_session";
  const tamperedBody = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const tampered = `${prefix}.${tamperedBody}.${signature}`;
  assert.deepEqual(verifyOfflineCapability(tampered, verificationContext(keys, { now: 1_005_000 })), {
    ok: false,
    error: "signature_denied",
  });
});

test("rejects expired, wrong-session and wrong-scope capabilities", () => {
  const expired = issue({ ttlMs: 1_000 });
  assert.deepEqual(verifyOfflineCapability(expired.result.token, verificationContext(expired.keys, {
    now: 1_001_000,
  })), { ok: false, error: "lifetime_denied" });

  const valid = issue();
  assert.deepEqual(verifyOfflineCapability(valid.result.token, verificationContext(valid.keys, {
    now: 1_005_000,
    expectedSessionId: "mock_other_session",
  })), { ok: false, error: "binding_denied" });
  assert.deepEqual(verifyOfflineCapability(valid.result.token, verificationContext(valid.keys, {
    now: 1_005_000,
    requiredScope: "voice:session:close",
  })), { ok: false, error: "scope_denied" });
});

test("binds capability to context and origin", () => {
  const { keys, result } = issue();
  assert.deepEqual(verifyOfflineCapability(result.token, verificationContext(keys, {
    expectedContextId: "mockctx_othercontext",
  })), { ok: false, error: "binding_denied" });
  assert.deepEqual(verifyOfflineCapability(result.token, verificationContext(keys, {
    expectedOrigin: "lab://other-origin",
  })), { ok: false, error: "binding_denied" });
});

test("revocation denies an otherwise valid capability before replay consumption", () => {
  const { keys, result } = issue();
  const registry = createOfflineRevocationRegistry();
  assert.deepEqual(revokeOfflineCapability(registry, {
    jti: "mockcap_stage1token",
    now: 1_004_000,
    reason: "operator-test-revocation",
  }).ok, true);
  const context = verificationContext(keys, { now: 1_005_000, revocationRegistry: registry });
  assert.deepEqual(verifyOfflineCapability(result.token, context), {
    ok: false,
    error: "capability_revoked",
  });
  assert.equal(context.replayGuard.size, 0);
});

test("issuance and verification enforce explicit scope allowlists", () => {
  const keys = generateEphemeralCapabilityKeyPair();
  assert.deepEqual(issueOfflineCapability({
    privateKey: keys.privateKey,
    sessionId: SESSION,
    contextId: CONTEXT,
    origin: ORIGIN,
    scope: SCOPE,
    authorizedScopes: new Set(["voice:session:close"]),
    now: 1_000_000,
    ttlMs: 30_000,
    jti: "mockcap_deniedtoken",
  }), { ok: false, error: "authorization_policy_denied" });

  const valid = issue({ keys });
  assert.deepEqual(verifyOfflineCapability(valid.result.token, verificationContext(keys, {
    allowedScopes: new Set(["voice:session:close"]),
  })), { ok: false, error: "authorization_policy_denied" });
});

test("rejects wrong verifier keys and unsafe issuance lifetime", () => {
  const first = issue();
  const otherKeys = generateEphemeralCapabilityKeyPair();
  assert.deepEqual(verifyOfflineCapability(first.result.token, verificationContext(otherKeys, {
    now: 1_005_000,
  })), { ok: false, error: "signature_denied" });

  const denied = issueOfflineCapability({
    privateKey: first.keys.privateKey,
    sessionId: SESSION,
    contextId: CONTEXT,
    origin: ORIGIN,
    scope: SCOPE,
    authorizedScopes: POLICY,
    now: 1_000_000,
    ttlMs: 60_001,
    jti: "mockcap_toolongtoken",
  });
  assert.deepEqual(denied, { ok: false, error: "capability_lifetime_denied" });
});

test("fails closed without replay, revocation, authorization policy or signing keys", () => {
  const { keys, result } = issue();
  const base = verificationContext(keys, { now: 1_005_000 });
  assert.deepEqual(verifyOfflineCapability(result.token, { ...base, replayGuard: undefined }), {
    ok: false,
    error: "replay_guard_required",
  });
  assert.deepEqual(verifyOfflineCapability(result.token, { ...base, revocationRegistry: undefined }), {
    ok: false,
    error: "revocation_registry_required",
  });
  assert.deepEqual(verifyOfflineCapability(result.token, { ...base, allowedScopes: undefined }), {
    ok: false,
    error: "authorization_policy_denied",
  });
  assert.deepEqual(issueOfflineCapability({
    sessionId: SESSION,
    contextId: CONTEXT,
    origin: ORIGIN,
    scope: SCOPE,
    authorizedScopes: POLICY,
    now: 1_000_000,
    ttlMs: 30_000,
    jti: "mockcap_nokeytoken",
  }), { ok: false, error: "issuer_key_denied" });
});
