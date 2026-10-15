/**
 * Infinity Voice v2.0 — offline idempotency/retry/recovery contract.
 * Simulated evidence only. No provider calls, timers, storage, network or capacity release in real systems.
 */
const SESSION_RE = /^mock_[a-zA-Z0-9_-]{8,64}$/;
const OP_RE = /^mockop_[a-zA-Z0-9_-]{8,64}$/;
const KINDS = new Set(["provider_open", "provider_close", "model_turn", "tool_plan"]);
const CLOSE_EVIDENCE = "mock-provider-close-confirmed";

function safeInt(value, min = 0) {
  return Number.isSafeInteger(value) && value >= min;
}

function validState(state) {
  return state?.kind === "offline-resilience" && safeInt(state.maxRetries) && state.maxRetries <= 10 &&
    safeInt(state.baseRetryDelayMs, 100) && state.baseRetryDelayMs <= 60_000 && Array.isArray(state.operations);
}

function replaceOperation(state, operation) {
  return Object.freeze({
    ...state,
    operations: Object.freeze(state.operations.map((item) => item.operationId === operation.operationId ? operation : item)),
    sequence: state.sequence + 1,
  });
}

export function createOfflineResilienceState({ maxRetries = 2, baseRetryDelayMs = 500 } = {}) {
  if (!safeInt(maxRetries) || maxRetries > 10 || !safeInt(baseRetryDelayMs, 100) || baseRetryDelayMs > 60_000) {
    return { ok: false, error: "invalid_resilience_config" };
  }
  return {
    ok: true,
    state: Object.freeze({
      kind: "offline-resilience",
      maxRetries,
      baseRetryDelayMs,
      operations: Object.freeze([]),
      sequence: 0,
    }),
  };
}

export function beginOfflineOperation(state, { operationId, sessionId, operationKind, now } = {}) {
  if (!validState(state) || !OP_RE.test(operationId ?? "") || !SESSION_RE.test(sessionId ?? "") ||
      !KINDS.has(operationKind) || !safeInt(now)) {
    return { ok: false, error: "invalid_operation" };
  }
  const existing = state.operations.find((item) => item.operationId === operationId);
  if (existing) {
    if (existing.sessionId !== sessionId || existing.operationKind !== operationKind) {
      return { ok: false, error: "idempotency_key_collision" };
    }
    return { ok: true, duplicate: true, operation: existing, state };
  }
  const operation = Object.freeze({
    operationId,
    sessionId,
    operationKind,
    status: "pending",
    attempts: 0,
    createdAt: now,
    retryAt: null,
    manualReview: false,
    closeEvidence: false,
    simulatedOnly: true,
  });
  return {
    ok: true,
    duplicate: false,
    operation,
    state: Object.freeze({ ...state, operations: Object.freeze([...state.operations, operation]), sequence: state.sequence + 1 }),
  };
}

export function recordOfflineOperationFailure(state, { operationId, now, failureKind = "transient" } = {}) {
  if (!validState(state) || !OP_RE.test(operationId ?? "") || !safeInt(now) ||
      !["transient", "timeout", "provider_partial", "unknown"].includes(failureKind)) {
    return { ok: false, error: "invalid_failure_record" };
  }
  const current = state.operations.find((item) => item.operationId === operationId);
  if (!current) return { ok: false, error: "operation_not_found" };
  if (["completed", "manual_review"].includes(current.status)) return { ok: false, error: "operation_terminal" };

  const attempts = current.attempts + 1;
  const retryAllowed = attempts <= state.maxRetries;
  const operation = Object.freeze({
    ...current,
    status: retryAllowed ? "retry_pending" : "manual_review",
    attempts,
    retryAt: retryAllowed ? now + state.baseRetryDelayMs * attempts : null,
    manualReview: !retryAllowed,
    lastFailureKind: failureKind,
  });
  return {
    ok: true,
    retryAllowed,
    retryAt: operation.retryAt,
    operation,
    state: replaceOperation(state, operation),
  };
}

export function markOfflineRetryStarted(state, { operationId, now } = {}) {
  if (!validState(state) || !OP_RE.test(operationId ?? "") || !safeInt(now)) {
    return { ok: false, error: "invalid_retry" };
  }
  const current = state.operations.find((item) => item.operationId === operationId);
  if (!current) return { ok: false, error: "operation_not_found" };
  if (current.status !== "retry_pending" || !safeInt(current.retryAt) || now < current.retryAt) {
    return { ok: false, error: "retry_not_authorized" };
  }
  const operation = Object.freeze({ ...current, status: "pending", retryAt: null });
  return { ok: true, operation, state: replaceOperation(state, operation) };
}

export function recordOfflineOperationSuccess(state, { operationId, evidence } = {}) {
  if (!validState(state) || !OP_RE.test(operationId ?? "")) return { ok: false, error: "invalid_success_record" };
  const current = state.operations.find((item) => item.operationId === operationId);
  if (!current) return { ok: false, error: "operation_not_found" };
  if (current.status === "manual_review") return { ok: false, error: "operation_terminal" };
  if (current.status === "completed") return { ok: true, duplicate: true, operation: current, state };
  if (current.operationKind === "provider_close" && evidence !== CLOSE_EVIDENCE) {
    return { ok: false, error: "close_evidence_required" };
  }
  const operation = Object.freeze({
    ...current,
    status: "completed",
    retryAt: null,
    closeEvidence: current.operationKind === "provider_close",
  });
  return { ok: true, duplicate: false, operation, state: replaceOperation(state, operation) };
}

export function canReleaseOfflineCapacity(state, operationId) {
  if (!validState(state) || !OP_RE.test(operationId ?? "")) return false;
  const operation = state.operations.find((item) => item.operationId === operationId);
  return Boolean(operation && operation.operationKind === "provider_close" && operation.status === "completed" &&
    operation.closeEvidence === true && operation.simulatedOnly === true);
}
