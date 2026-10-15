/**
 * Infinity Voice v2.0 — offline global concurrency/rate/kill-switch guard.
 * Pure deterministic state. No external store, provider, billing or network.
 */
const SESSION_RE = /^mock_[a-zA-Z0-9_-]{8,64}$/;
const ACTOR_RE = /^mockactor_[a-zA-Z0-9_-]{6,64}$/;

function safeInt(value, min = 0) {
  return Number.isSafeInteger(value) && value >= min;
}

function validRuntime(state) {
  return state?.kind === "offline-runtime-guard" && safeInt(state.maxConcurrent, 1) &&
    safeInt(state.maxStartsPerWindow, 1) && safeInt(state.windowMs, 1_000) && Array.isArray(state.activeSessions) &&
    Array.isArray(state.startEvents) && typeof state.emergencyStop === "boolean";
}

function prune(events, now, windowMs) {
  return events.filter((event) => now - event.at < windowMs);
}

export function createOfflineRuntimeGuard({
  maxConcurrent = 4,
  maxStartsPerWindow = 10,
  windowMs = 60_000,
} = {}) {
  if (!safeInt(maxConcurrent, 1) || maxConcurrent > 1_000 || !safeInt(maxStartsPerWindow, 1) ||
      maxStartsPerWindow > 10_000 || !safeInt(windowMs, 1_000) || windowMs > 3_600_000) {
    return { ok: false, error: "invalid_runtime_guard_config" };
  }
  return {
    ok: true,
    runtime: Object.freeze({
      kind: "offline-runtime-guard",
      maxConcurrent,
      maxStartsPerWindow,
      windowMs,
      emergencyStop: false,
      activeSessions: Object.freeze([]),
      startEvents: Object.freeze([]),
      sequence: 0,
    }),
  };
}

export function setOfflineEmergencyStop(runtime, enabled) {
  if (!validRuntime(runtime) || typeof enabled !== "boolean") return { ok: false, error: "invalid_emergency_stop" };
  return {
    ok: true,
    runtime: Object.freeze({ ...runtime, emergencyStop: enabled, sequence: runtime.sequence + 1 }),
  };
}

export function claimOfflineRuntimeSlot(runtime, { sessionId, actorId, now } = {}) {
  if (!validRuntime(runtime) || !SESSION_RE.test(sessionId ?? "") || !ACTOR_RE.test(actorId ?? "") || !safeInt(now)) {
    return { ok: false, error: "invalid_runtime_claim" };
  }
  if (runtime.emergencyStop) return { ok: false, error: "emergency_stop_active" };
  if (runtime.activeSessions.some((item) => item.sessionId === sessionId)) {
    return { ok: false, error: "session_already_active" };
  }
  if (runtime.activeSessions.length >= runtime.maxConcurrent) return { ok: false, error: "concurrency_limit" };
  const recent = prune(runtime.startEvents, now, runtime.windowMs);
  const actorStarts = recent.filter((event) => event.actorId === actorId);
  if (actorStarts.length >= runtime.maxStartsPerWindow) return { ok: false, error: "rate_limit" };
  const activeSessions = Object.freeze([...runtime.activeSessions, Object.freeze({ sessionId, actorId, claimedAt: now })]);
  const startEvents = Object.freeze([...recent, Object.freeze({ sessionId, actorId, at: now })]);
  return {
    ok: true,
    runtime: Object.freeze({ ...runtime, activeSessions, startEvents, sequence: runtime.sequence + 1 }),
  };
}

export function releaseOfflineRuntimeSlot(runtime, { sessionId } = {}) {
  if (!validRuntime(runtime) || !SESSION_RE.test(sessionId ?? "")) return { ok: false, error: "invalid_runtime_release" };
  if (!runtime.activeSessions.some((item) => item.sessionId === sessionId)) {
    return { ok: true, released: false, runtime };
  }
  return {
    ok: true,
    released: true,
    runtime: Object.freeze({
      ...runtime,
      activeSessions: Object.freeze(runtime.activeSessions.filter((item) => item.sessionId !== sessionId)),
      sequence: runtime.sequence + 1,
    }),
  };
}
