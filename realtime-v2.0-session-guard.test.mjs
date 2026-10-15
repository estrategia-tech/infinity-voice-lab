import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeOfflineSessionStep,
  canContinueOfflineSession,
  createOfflineSessionGuard,
} from "./realtime-v2.0-session-guard.mjs";

function fresh() {
  return createOfflineSessionGuard({
    sessionId: "mock_stage4_budget_01",
    startedAt: 1_000,
    maxDurationMs: 5_000,
    maxBudgetUnits: 100,
  }).guard;
}

test("authorizes bounded usage and tracks integer budget", () => {
  let guard = fresh();
  const first = authorizeOfflineSessionStep(guard, { now: 2_000, costUnits: 30 });
  assert.equal(first.ok, true);
  assert.equal(first.remainingBudgetUnits, 70);
  guard = first.guard;
  const second = authorizeOfflineSessionStep(guard, { now: 3_000, costUnits: 20 });
  assert.equal(second.ok, true);
  assert.equal(second.guard.spentBudgetUnits, 50);
  assert.equal(canContinueOfflineSession(second.guard, 3_500), true);
});

test("budget overflow fails closed without overspending", () => {
  let guard = fresh();
  guard = authorizeOfflineSessionStep(guard, { now: 2_000, costUnits: 90 }).guard;
  const denied = authorizeOfflineSessionStep(guard, { now: 2_100, costUnits: 11 });
  assert.equal(denied.ok, false);
  assert.equal(denied.error, "session_budget_exceeded");
  assert.equal(denied.guard.spentBudgetUnits, 90);
  assert.equal(denied.guard.status, "budget_exhausted");
  assert.equal(canContinueOfflineSession(denied.guard, 2_200), false);
});

test("exact budget exhaustion prevents another step", () => {
  const result = authorizeOfflineSessionStep(fresh(), { now: 2_000, costUnits: 100 });
  assert.equal(result.ok, true);
  assert.equal(result.guard.status, "budget_exhausted");
  assert.deepEqual(authorizeOfflineSessionStep(result.guard, { now: 2_100, costUnits: 0 }), {
    ok: false,
    error: "budget_exhausted",
  });
});

test("duration deadline fails closed", () => {
  const denied = authorizeOfflineSessionStep(fresh(), { now: 6_000, costUnits: 1 });
  assert.equal(denied.ok, false);
  assert.equal(denied.error, "session_expired");
  assert.equal(denied.guard.status, "expired");
});

test("rejects unsafe duration or budget configuration", () => {
  assert.deepEqual(createOfflineSessionGuard({
    sessionId: "mock_stage4_budget_02",
    startedAt: 1_000,
    maxDurationMs: 999,
    maxBudgetUnits: 10,
  }), { ok: false, error: "invalid_session_guard_config" });
  assert.deepEqual(createOfflineSessionGuard({
    sessionId: "mock_stage4_budget_02",
    startedAt: 1_000,
    maxDurationMs: 5_000,
    maxBudgetUnits: 1_000_001,
  }), { ok: false, error: "invalid_session_guard_config" });
});
