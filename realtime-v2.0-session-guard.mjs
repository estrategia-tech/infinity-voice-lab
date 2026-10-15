/**
 * Infinity Voice v2.0 — deterministic offline session duration/budget guard.
 * Integer budget units only. No billing provider, clock, network or paid API.
 */
const SESSION_RE = /^mock_[a-zA-Z0-9_-]{8,64}$/;

function safeInt(value, min = 0) {
  return Number.isSafeInteger(value) && value >= min;
}

function validGuard(state) {
  return state?.kind === "offline-session-guard" && SESSION_RE.test(state.sessionId ?? "") &&
    safeInt(state.startedAt) && safeInt(state.expiresAt) && state.expiresAt > state.startedAt &&
    safeInt(state.maxBudgetUnits, 1) && safeInt(state.spentBudgetUnits) &&
    state.spentBudgetUnits <= state.maxBudgetUnits && ["active", "expired", "budget_exhausted"].includes(state.status);
}

export function createOfflineSessionGuard({
  sessionId,
  startedAt,
  maxDurationMs = 300_000,
  maxBudgetUnits = 10_000,
} = {}) {
  if (!SESSION_RE.test(sessionId ?? "") || !safeInt(startedAt) || !safeInt(maxDurationMs, 1_000) ||
      maxDurationMs > 3_600_000 || !safeInt(maxBudgetUnits, 1) || maxBudgetUnits > 1_000_000) {
    return { ok: false, error: "invalid_session_guard_config" };
  }
  return {
    ok: true,
    guard: Object.freeze({
      kind: "offline-session-guard",
      sessionId,
      startedAt,
      expiresAt: startedAt + maxDurationMs,
      maxBudgetUnits,
      spentBudgetUnits: 0,
      status: "active",
      stepsAuthorized: 0,
    }),
  };
}

export function authorizeOfflineSessionStep(guard, { now, costUnits = 0 } = {}) {
  if (!validGuard(guard) || !safeInt(now) || !safeInt(costUnits)) {
    return { ok: false, error: "invalid_session_step" };
  }
  if (guard.status !== "active") return { ok: false, error: guard.status };
  if (now >= guard.expiresAt) {
    return {
      ok: false,
      error: "session_expired",
      guard: Object.freeze({ ...guard, status: "expired" }),
    };
  }
  if (guard.spentBudgetUnits + costUnits > guard.maxBudgetUnits) {
    return {
      ok: false,
      error: "session_budget_exceeded",
      guard: Object.freeze({ ...guard, status: "budget_exhausted" }),
    };
  }
  const spentBudgetUnits = guard.spentBudgetUnits + costUnits;
  return {
    ok: true,
    remainingBudgetUnits: guard.maxBudgetUnits - spentBudgetUnits,
    guard: Object.freeze({
      ...guard,
      spentBudgetUnits,
      stepsAuthorized: guard.stepsAuthorized + 1,
      status: spentBudgetUnits === guard.maxBudgetUnits ? "budget_exhausted" : "active",
    }),
  };
}

export function canContinueOfflineSession(guard, now) {
  if (!validGuard(guard) || !safeInt(now)) return false;
  return guard.status === "active" && now < guard.expiresAt && guard.spentBudgetUnits < guard.maxBudgetUnits;
}
