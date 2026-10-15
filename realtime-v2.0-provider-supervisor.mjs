/**
 * Infinity Voice v2.0 — offline provider timeout/cancellation supervisor.
 * Pure state machine: no clocks, network, credentials, providers or paid calls.
 */
const SESSION_RE = /^mock_[a-zA-Z0-9_-]{8,64}$/;
const RECEIPT = "mock-only-confirmation";
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 60_000;

function validNow(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validTimeout(value) {
  return Number.isSafeInteger(value) && value >= MIN_TIMEOUT_MS && value <= MAX_TIMEOUT_MS;
}

function validSupervisor(value) {
  return value?.kind === "offline-provider-supervisor" && SESSION_RE.test(value.sessionId ?? "") &&
    Number.isSafeInteger(value.sequence) && value.sequence >= 0;
}

function evolve(state, patch) {
  return Object.freeze({ ...state, ...patch, sequence: state.sequence + 1 });
}

export function createOfflineProviderSupervisor({
  sessionId,
  openTimeoutMs = 5_000,
  closeTimeoutMs = 5_000,
  cancelTimeoutMs = 5_000,
} = {}) {
  if (!SESSION_RE.test(sessionId ?? "") || !validTimeout(openTimeoutMs) ||
      !validTimeout(closeTimeoutMs) || !validTimeout(cancelTimeoutMs)) {
    return { ok: false, error: "invalid_supervisor_config" };
  }
  return {
    ok: true,
    supervisor: Object.freeze({
      kind: "offline-provider-supervisor",
      sessionId,
      sequence: 0,
      status: "idle",
      deadlineAt: null,
      openTimeoutMs,
      closeTimeoutMs,
      cancelTimeoutMs,
      terminationConfirmed: false,
      capacityReleased: false,
      terminationKind: null,
      lastReason: null,
    }),
  };
}

export function requestProviderOpen(state, now) {
  if (!validSupervisor(state) || !validNow(now)) return { ok: false, error: "invalid_supervisor_state" };
  if (state.status !== "idle") return { ok: false, error: "invalid_transition" };
  return {
    ok: true,
    supervisor: evolve(state, {
      status: "opening",
      deadlineAt: now + state.openTimeoutMs,
      lastReason: "open_requested",
    }),
  };
}

export function confirmProviderOpen(state, now) {
  if (!validSupervisor(state) || !validNow(now)) return { ok: false, error: "invalid_supervisor_state" };
  if (state.status !== "opening" || now >= state.deadlineAt) return { ok: false, error: "open_confirmation_denied" };
  return {
    ok: true,
    supervisor: evolve(state, { status: "open", deadlineAt: null, lastReason: "open_confirmed" }),
  };
}

export function requestProviderClose(state, now) {
  if (!validSupervisor(state) || !validNow(now)) return { ok: false, error: "invalid_supervisor_state" };
  if (state.status !== "open") return { ok: false, error: "invalid_transition" };
  return {
    ok: true,
    supervisor: evolve(state, {
      status: "closing",
      deadlineAt: now + state.closeTimeoutMs,
      lastReason: "close_requested",
      capacityReleased: false,
      terminationConfirmed: false,
    }),
  };
}

export function requestProviderCancel(state, now, reason = "operator_cancel") {
  if (!validSupervisor(state) || !validNow(now) || typeof reason !== "string" || reason.length < 1 || reason.length > 80) {
    return { ok: false, error: "invalid_cancel_request" };
  }
  if (!["opening", "open", "closing"].includes(state.status)) return { ok: false, error: "invalid_transition" };
  return {
    ok: true,
    supervisor: evolve(state, {
      status: "cancelling",
      deadlineAt: now + state.cancelTimeoutMs,
      lastReason: reason,
      capacityReleased: false,
      terminationConfirmed: false,
    }),
  };
}

export function confirmProviderTermination(state, { now, providerReceipt, terminationKind } = {}) {
  if (!validSupervisor(state) || !validNow(now)) return { ok: false, error: "invalid_supervisor_state" };
  const expectedKind = state.status === "closing" ? "close" : state.status === "cancelling" ? "cancel" : null;
  if (!expectedKind || terminationKind !== expectedKind || now >= state.deadlineAt || providerReceipt !== RECEIPT) {
    return { ok: false, error: "termination_evidence_denied" };
  }
  return {
    ok: true,
    supervisor: evolve(state, {
      status: "terminated",
      deadlineAt: null,
      terminationConfirmed: true,
      capacityReleased: true,
      terminationKind,
      lastReason: `${terminationKind}_confirmed`,
    }),
  };
}

export function checkProviderDeadline(state, now) {
  if (!validSupervisor(state) || !validNow(now)) return { ok: false, error: "invalid_supervisor_state" };
  if (!["opening", "closing", "cancelling"].includes(state.status) || state.deadlineAt === null || now < state.deadlineAt) {
    return { ok: true, supervisor: state, timedOut: false };
  }
  return {
    ok: true,
    timedOut: true,
    supervisor: evolve(state, {
      status: "uncertain",
      deadlineAt: null,
      terminationConfirmed: false,
      capacityReleased: false,
      terminationKind: null,
      lastReason: `${state.status}_timeout`,
    }),
  };
}

export function markProviderFailure(state, { now, reason = "provider_failure" } = {}) {
  if (!validSupervisor(state) || !validNow(now) || typeof reason !== "string" || reason.length < 1 || reason.length > 80) {
    return { ok: false, error: "invalid_failure" };
  }
  if (!["opening", "open", "closing", "cancelling"].includes(state.status)) return { ok: false, error: "invalid_transition" };
  return {
    ok: true,
    supervisor: evolve(state, {
      status: "uncertain",
      deadlineAt: null,
      terminationConfirmed: false,
      capacityReleased: false,
      terminationKind: null,
      lastReason: reason,
    }),
  };
}

export function canReleaseProviderCapacity(state) {
  return Boolean(validSupervisor(state) && state.status === "terminated" && state.terminationConfirmed && state.capacityReleased);
}
