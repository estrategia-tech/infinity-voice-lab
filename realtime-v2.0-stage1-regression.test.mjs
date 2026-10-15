import test from "node:test";
import assert from "node:assert/strict";
import {
  createOfflineRevocationRegistry,
  generateEphemeralCapabilityKeyPair,
  issueOfflineCapability,
  revokeOfflineCapability,
  verifyOfflineCapability,
} from "./realtime-v2.0-capability.mjs";
import {
  canReleaseProviderCapacity,
  checkProviderDeadline,
  confirmProviderOpen,
  confirmProviderTermination,
  createOfflineProviderSupervisor,
  requestProviderCancel,
  requestProviderClose,
  requestProviderOpen,
} from "./realtime-v2.0-provider-supervisor.mjs";
import {
  applyOfflineProviderEvent,
  createOfflineProviderAdapter,
} from "./realtime-v2.0-provider-contract.mjs";

const SESSION = "mock_stage1_regression_01";
const CONTEXT = "mockctx_regression01";
const ORIGIN = "lab://voice-test";
const OPEN_SCOPE = "voice:session:open";
const CLOSE_SCOPE = "voice:session:close";
const SCOPES = new Set([OPEN_SCOPE, CLOSE_SCOPE]);

function verifiedCapability(scope, jti, registry = createOfflineRevocationRegistry()) {
  const keys = generateEphemeralCapabilityKeyPair();
  const issued = issueOfflineCapability({
    privateKey: keys.privateKey,
    sessionId: SESSION,
    contextId: CONTEXT,
    origin: ORIGIN,
    scope,
    authorizedScopes: SCOPES,
    now: 10_000,
    ttlMs: 20_000,
    jti,
  });
  assert.equal(issued.ok, true);
  return {
    issued,
    keys,
    registry,
    verify(now = 11_000) {
      return verifyOfflineCapability(issued.token, {
        publicKey: keys.publicKey,
        now,
        expectedSessionId: SESSION,
        expectedContextId: CONTEXT,
        expectedOrigin: ORIGIN,
        requiredScope: scope,
        allowedScopes: SCOPES,
        replayGuard: new Set(),
        revocationRegistry: registry,
      });
    },
  };
}

test("authorized capability can drive only the simulated provider lifecycle", () => {
  const openCap = verifiedCapability(OPEN_SCOPE, "mockcap_regressionopen");
  assert.equal(openCap.verify().ok, true);

  let adapter = createOfflineProviderAdapter({ sessionId: SESSION }).adapter;
  adapter = applyOfflineProviderEvent(adapter, {
    event: "session_open_requested",
    sessionId: SESSION,
    sequence: 1,
  }).adapter;
  adapter = applyOfflineProviderEvent(adapter, {
    event: "session_open_confirmed",
    sessionId: SESSION,
    sequence: 2,
  }).adapter;
  assert.equal(adapter.status, "open");

  let supervisor = createOfflineProviderSupervisor({ sessionId: SESSION }).supervisor;
  supervisor = requestProviderOpen(supervisor, 10_000).supervisor;
  supervisor = confirmProviderOpen(supervisor, 10_100).supervisor;
  assert.equal(supervisor.status, "open");

  const closeCap = verifiedCapability(CLOSE_SCOPE, "mockcap_regressionclose");
  assert.equal(closeCap.verify().ok, true);
  supervisor = requestProviderClose(supervisor, 12_000).supervisor;
  assert.equal(canReleaseProviderCapacity(supervisor), false);
  supervisor = confirmProviderTermination(supervisor, {
    now: 12_100,
    providerReceipt: "mock-only-confirmation",
    terminationKind: "close",
  }).supervisor;
  assert.equal(canReleaseProviderCapacity(supervisor), true);
});

test("revoked authorization cannot start a provider action", () => {
  const registry = createOfflineRevocationRegistry();
  const cap = verifiedCapability(OPEN_SCOPE, "mockcap_regressionrevoked", registry);
  assert.equal(revokeOfflineCapability(registry, {
    jti: "mockcap_regressionrevoked",
    now: 10_500,
    reason: "regression-test",
  }).ok, true);
  assert.deepEqual(cap.verify(11_000), { ok: false, error: "capability_revoked" });
});

test("timeout or cancellation ambiguity never releases provider capacity", () => {
  let supervisor = createOfflineProviderSupervisor({
    sessionId: SESSION,
    openTimeoutMs: 500,
    closeTimeoutMs: 500,
    cancelTimeoutMs: 500,
  }).supervisor;
  supervisor = requestProviderOpen(supervisor, 10_000).supervisor;
  supervisor = confirmProviderOpen(supervisor, 10_100).supervisor;
  supervisor = requestProviderCancel(supervisor, 10_200, "regression_abort").supervisor;
  assert.equal(canReleaseProviderCapacity(supervisor), false);
  const timed = checkProviderDeadline(supervisor, 10_700);
  assert.equal(timed.timedOut, true);
  assert.equal(timed.supervisor.status, "uncertain");
  assert.equal(canReleaseProviderCapacity(timed.supervisor), false);
});

test("provider contract refuses close proof outside the expected sequence", () => {
  let adapter = createOfflineProviderAdapter({ sessionId: SESSION }).adapter;
  adapter = applyOfflineProviderEvent(adapter, {
    event: "session_open_requested",
    sessionId: SESSION,
    sequence: 1,
  }).adapter;
  adapter = applyOfflineProviderEvent(adapter, {
    event: "session_open_confirmed",
    sessionId: SESSION,
    sequence: 2,
  }).adapter;
  const denied = applyOfflineProviderEvent(adapter, {
    event: "session_close_confirmed",
    sessionId: SESSION,
    sequence: 3,
    providerReceipt: "mock-only-confirmation",
  });
  assert.deepEqual(denied, { ok: false, error: "invalid_transition" });
});
