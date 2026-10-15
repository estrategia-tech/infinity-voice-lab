import test from "node:test";
import assert from "node:assert/strict";
import {
  beginOfflineOperation,
  canReleaseOfflineCapacity,
  createOfflineResilienceState,
  markOfflineRetryStarted,
  recordOfflineOperationFailure,
  recordOfflineOperationSuccess,
} from "./realtime-v2.0-resilience.mjs";

function fresh(overrides = {}) {
  return createOfflineResilienceState({ maxRetries: 2, baseRetryDelayMs: 500, ...overrides }).state;
}

test("idempotency key prevents duplicate operation creation", () => {
  let state = fresh();
  const first = beginOfflineOperation(state, {
    operationId: "mockop_provider_open01",
    sessionId: "mock_resilience_session01",
    operationKind: "provider_open",
    now: 1_000,
  });
  assert.equal(first.ok, true);
  assert.equal(first.duplicate, false);
  state = first.state;
  const duplicate = beginOfflineOperation(state, {
    operationId: "mockop_provider_open01",
    sessionId: "mock_resilience_session01",
    operationKind: "provider_open",
    now: 1_001,
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.state.operations.length, 1);
});

test("idempotency collision with different meaning fails closed", () => {
  let state = beginOfflineOperation(fresh(), {
    operationId: "mockop_collision0001",
    sessionId: "mock_resilience_session02",
    operationKind: "provider_open",
    now: 1_000,
  }).state;
  assert.deepEqual(beginOfflineOperation(state, {
    operationId: "mockop_collision0001",
    sessionId: "mock_resilience_session02",
    operationKind: "provider_close",
    now: 1_001,
  }), { ok: false, error: "idempotency_key_collision" });
});

test("retries are bounded and exhaustion requires manual review", () => {
  let state = beginOfflineOperation(fresh(), {
    operationId: "mockop_retrybound001",
    sessionId: "mock_resilience_session03",
    operationKind: "model_turn",
    now: 1_000,
  }).state;

  let failed = recordOfflineOperationFailure(state, {
    operationId: "mockop_retrybound001",
    now: 1_100,
    failureKind: "timeout",
  });
  assert.equal(failed.retryAllowed, true);
  assert.equal(failed.retryAt, 1_600);
  state = markOfflineRetryStarted(failed.state, {
    operationId: "mockop_retrybound001",
    now: 1_600,
  }).state;

  failed = recordOfflineOperationFailure(state, {
    operationId: "mockop_retrybound001",
    now: 1_700,
    failureKind: "provider_partial",
  });
  assert.equal(failed.retryAllowed, true);
  assert.equal(failed.retryAt, 2_700);
  state = markOfflineRetryStarted(failed.state, {
    operationId: "mockop_retrybound001",
    now: 2_700,
  }).state;

  failed = recordOfflineOperationFailure(state, {
    operationId: "mockop_retrybound001",
    now: 2_800,
    failureKind: "unknown",
  });
  assert.equal(failed.retryAllowed, false);
  assert.equal(failed.operation.status, "manual_review");
  assert.equal(failed.operation.manualReview, true);
});

test("retry cannot start before deterministic backoff deadline", () => {
  let state = beginOfflineOperation(fresh(), {
    operationId: "mockop_retryearly001",
    sessionId: "mock_resilience_session04",
    operationKind: "tool_plan",
    now: 1_000,
  }).state;
  state = recordOfflineOperationFailure(state, {
    operationId: "mockop_retryearly001",
    now: 1_100,
  }).state;
  assert.deepEqual(markOfflineRetryStarted(state, {
    operationId: "mockop_retryearly001",
    now: 1_599,
  }), { ok: false, error: "retry_not_authorized" });
});

test("provider close requires explicit simulated evidence before offline capacity release", () => {
  let state = beginOfflineOperation(fresh(), {
    operationId: "mockop_provider_close01",
    sessionId: "mock_resilience_session05",
    operationKind: "provider_close",
    now: 1_000,
  }).state;
  assert.deepEqual(recordOfflineOperationSuccess(state, {
    operationId: "mockop_provider_close01",
  }), { ok: false, error: "close_evidence_required" });
  assert.equal(canReleaseOfflineCapacity(state, "mockop_provider_close01"), false);

  const success = recordOfflineOperationSuccess(state, {
    operationId: "mockop_provider_close01",
    evidence: "mock-provider-close-confirmed",
  });
  assert.equal(success.ok, true);
  assert.equal(success.operation.simulatedOnly, true);
  assert.equal(canReleaseOfflineCapacity(success.state, "mockop_provider_close01"), true);
});

test("terminal manual-review operation cannot later be converted to success", () => {
  let state = beginOfflineOperation(fresh({ maxRetries: 0 }), {
    operationId: "mockop_terminal0001",
    sessionId: "mock_resilience_session06",
    operationKind: "provider_open",
    now: 1_000,
  }).state;
  state = recordOfflineOperationFailure(state, {
    operationId: "mockop_terminal0001",
    now: 1_100,
    failureKind: "unknown",
  }).state;
  assert.deepEqual(recordOfflineOperationSuccess(state, {
    operationId: "mockop_terminal0001",
  }), { ok: false, error: "operation_terminal" });
});
