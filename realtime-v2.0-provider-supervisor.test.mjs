import test from "node:test";
import assert from "node:assert/strict";
import {
  canReleaseProviderCapacity,
  checkProviderDeadline,
  confirmProviderOpen,
  confirmProviderTermination,
  createOfflineProviderSupervisor,
  markProviderFailure,
  requestProviderCancel,
  requestProviderClose,
  requestProviderOpen,
} from "./realtime-v2.0-provider-supervisor.mjs";

function fresh() {
  return createOfflineProviderSupervisor({
    sessionId: "mock_provider_supervisor_01",
    openTimeoutMs: 1_000,
    closeTimeoutMs: 1_000,
    cancelTimeoutMs: 1_000,
  }).supervisor;
}

test("confirmed close is the only normal path that releases capacity", () => {
  let state = fresh();
  state = requestProviderOpen(state, 1_000).supervisor;
  state = confirmProviderOpen(state, 1_100).supervisor;
  state = requestProviderClose(state, 2_000).supervisor;
  assert.equal(canReleaseProviderCapacity(state), false);
  const result = confirmProviderTermination(state, {
    now: 2_100,
    providerReceipt: "mock-only-confirmation",
    terminationKind: "close",
  });
  assert.equal(result.ok, true);
  assert.equal(result.supervisor.status, "terminated");
  assert.equal(result.supervisor.terminationConfirmed, true);
  assert.equal(canReleaseProviderCapacity(result.supervisor), true);
});

test("close timeout becomes uncertain and never releases capacity", () => {
  let state = fresh();
  state = requestProviderOpen(state, 1_000).supervisor;
  state = confirmProviderOpen(state, 1_100).supervisor;
  state = requestProviderClose(state, 2_000).supervisor;
  const timed = checkProviderDeadline(state, 3_000);
  assert.equal(timed.timedOut, true);
  assert.equal(timed.supervisor.status, "uncertain");
  assert.equal(timed.supervisor.lastReason, "closing_timeout");
  assert.equal(canReleaseProviderCapacity(timed.supervisor), false);
});

test("cancel request does not release capacity until explicit confirmation", () => {
  let state = fresh();
  state = requestProviderOpen(state, 1_000).supervisor;
  state = confirmProviderOpen(state, 1_100).supervisor;
  state = requestProviderCancel(state, 1_200, "operator_abort").supervisor;
  assert.equal(state.status, "cancelling");
  assert.equal(canReleaseProviderCapacity(state), false);
  const confirmed = confirmProviderTermination(state, {
    now: 1_300,
    providerReceipt: "mock-only-confirmation",
    terminationKind: "cancel",
  });
  assert.equal(confirmed.ok, true);
  assert.equal(canReleaseProviderCapacity(confirmed.supervisor), true);
});

test("spoofed or mismatched termination evidence fails closed", () => {
  let state = fresh();
  state = requestProviderOpen(state, 1_000).supervisor;
  state = confirmProviderOpen(state, 1_100).supervisor;
  state = requestProviderClose(state, 2_000).supervisor;
  assert.deepEqual(confirmProviderTermination(state, {
    now: 2_100,
    providerReceipt: "real-looking-proof",
    terminationKind: "close",
  }), { ok: false, error: "termination_evidence_denied" });
  assert.deepEqual(confirmProviderTermination(state, {
    now: 2_100,
    providerReceipt: "mock-only-confirmation",
    terminationKind: "cancel",
  }), { ok: false, error: "termination_evidence_denied" });
  assert.equal(canReleaseProviderCapacity(state), false);
});

test("late confirmations are denied after deadline", () => {
  let state = fresh();
  state = requestProviderOpen(state, 1_000).supervisor;
  assert.deepEqual(confirmProviderOpen(state, 2_000), {
    ok: false,
    error: "open_confirmation_denied",
  });
  const timed = checkProviderDeadline(state, 2_000);
  assert.equal(timed.supervisor.status, "uncertain");
  assert.equal(canReleaseProviderCapacity(timed.supervisor), false);
});

test("provider failure is uncertainty, not termination proof", () => {
  let state = fresh();
  state = requestProviderOpen(state, 1_000).supervisor;
  state = confirmProviderOpen(state, 1_100).supervisor;
  const failed = markProviderFailure(state, { now: 1_200, reason: "mock_transport_drop" });
  assert.equal(failed.ok, true);
  assert.equal(failed.supervisor.status, "uncertain");
  assert.equal(failed.supervisor.terminationConfirmed, false);
  assert.equal(canReleaseProviderCapacity(failed.supervisor), false);
});

test("invalid transition and unsafe timeout config are rejected", () => {
  const state = fresh();
  assert.deepEqual(requestProviderClose(state, 1_000), { ok: false, error: "invalid_transition" });
  assert.deepEqual(createOfflineProviderSupervisor({
    sessionId: "mock_provider_supervisor_02",
    openTimeoutMs: 1,
    closeTimeoutMs: 1_000,
    cancelTimeoutMs: 1_000,
  }), { ok: false, error: "invalid_supervisor_config" });
});
