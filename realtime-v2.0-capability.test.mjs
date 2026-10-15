import test from "node:test";
import assert from "node:assert/strict";
import {
  generateEphemeralCapabilityKeyPair,
  issueOfflineCapability,
  verifyOfflineCapability,
} from "./realtime-v2.0-capability.mjs";

const SESSION = "mock_session_stage1a";
const SCOPE = "voice:session:open";

function issue(overrides = {}) {
  const keys = overrides.keys ?? generateEphemeralCapabilityKeyPair();
  const result = issueOfflineCapability({
    privateKey: keys.privateKey,
    sessionId: SESSION,
    scope: SCOPE,
    now: 1_000_000,
    ttlMs: 30_000,
    jti: "mockcap_stage1token",
    ...overrides,
    keys: undefined,
  });
  return { keys, result };
}

test("issues and verifies a one-use signed offline capability", () => {
  const { keys, result } = issue();
  assert.equal(result.ok, true);
  const replayGuard = new Set();
  const verified = verifyOfflineCapability(result.token, {
    publicKey: keys.publicKey,
    now: 1_010_000,
    expectedSessionId: SESSION,
    requiredScope: SCOPE,
    replayGuard,
  });
  assert.equal(verified.ok, true);
  assert.deepEqual(verified.capability, {
    sessionId: SESSION,
    scope: SCOPE,
    expiresAt: 1_030_000,
    jti: "mockcap_stage1token",
  });
  assert.equal(replayGuard.has("mockcap_stage1token"), true);
});

test("rejects replay of the same capability", () => {
  const { keys, result } = issue();
  const replayGuard = new Set();
  const context = {
    publicKey: keys.publicKey,
    now: 1_005_000,
    expectedSessionId: SESSION,
    requiredScope: SCOPE,
    replayGuard,
  };
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
  assert.deepEqual(verifyOfflineCapability(tampered, {
    publicKey: keys.publicKey,
    now: 1_005_000,
    expectedSessionId: SESSION,
    requiredScope: SCOPE,
    replayGuard: new Set(),
  }), { ok: false, error: "signature_denied" });
});

test("rejects expired, wrong-session and wrong-scope capabilities", () => {
  const expired = issue({ ttlMs: 1_000 });
  assert.deepEqual(verifyOfflineCapability(expired.result.token, {
    publicKey: expired.keys.publicKey,
    now: 1_001_000,
    expectedSessionId: SESSION,
    requiredScope: SCOPE,
    replayGuard: new Set(),
  }), { ok: false, error: "lifetime_denied" });

  const valid = issue();
  assert.deepEqual(verifyOfflineCapability(valid.result.token, {
    publicKey: valid.keys.publicKey,
    now: 1_005_000,
    expectedSessionId: "mock_other_session",
    requiredScope: SCOPE,
    replayGuard: new Set(),
  }), { ok: false, error: "scope_denied" });
  assert.deepEqual(verifyOfflineCapability(valid.result.token, {
    publicKey: valid.keys.publicKey,
    now: 1_005_000,
    expectedSessionId: SESSION,
    requiredScope: "voice:session:close",
    replayGuard: new Set(),
  }), { ok: false, error: "scope_denied" });
});

test("rejects wrong verifier keys and unsafe issuance lifetime", () => {
  const first = issue();
  const otherKeys = generateEphemeralCapabilityKeyPair();
  assert.deepEqual(verifyOfflineCapability(first.result.token, {
    publicKey: otherKeys.publicKey,
    now: 1_005_000,
    expectedSessionId: SESSION,
    requiredScope: SCOPE,
    replayGuard: new Set(),
  }), { ok: false, error: "signature_denied" });

  const denied = issueOfflineCapability({
    privateKey: first.keys.privateKey,
    sessionId: SESSION,
    scope: SCOPE,
    now: 1_000_000,
    ttlMs: 60_001,
    jti: "mockcap_toolongtoken",
  });
  assert.deepEqual(denied, { ok: false, error: "capability_lifetime_denied" });
});

test("fails closed without replay protection or signing keys", () => {
  const { keys, result } = issue();
  assert.deepEqual(verifyOfflineCapability(result.token, {
    publicKey: keys.publicKey,
    now: 1_005_000,
    expectedSessionId: SESSION,
    requiredScope: SCOPE,
  }), { ok: false, error: "replay_guard_required" });
  assert.deepEqual(issueOfflineCapability({
    sessionId: SESSION,
    scope: SCOPE,
    now: 1_000_000,
    ttlMs: 30_000,
    jti: "mockcap_nokeytoken",
  }), { ok: false, error: "issuer_key_denied" });
});
