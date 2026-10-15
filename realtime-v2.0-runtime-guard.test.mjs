import test from "node:test";
import assert from "node:assert/strict";
import {
  claimOfflineRuntimeSlot,
  createOfflineRuntimeGuard,
  releaseOfflineRuntimeSlot,
  setOfflineEmergencyStop,
} from "./realtime-v2.0-runtime-guard.mjs";

function fresh(overrides = {}) {
  return createOfflineRuntimeGuard({
    maxConcurrent: 2,
    maxStartsPerWindow: 2,
    windowMs: 10_000,
    ...overrides,
  }).runtime;
}

test("enforces global concurrency and releases capacity explicitly", () => {
  let runtime = fresh();
  runtime = claimOfflineRuntimeSlot(runtime, {
    sessionId: "mock_runtime_session01",
    actorId: "mockactor_alpha01",
    now: 1_000,
  }).runtime;
  runtime = claimOfflineRuntimeSlot(runtime, {
    sessionId: "mock_runtime_session02",
    actorId: "mockactor_beta001",
    now: 1_100,
  }).runtime;
  const denied = claimOfflineRuntimeSlot(runtime, {
    sessionId: "mock_runtime_session03",
    actorId: "mockactor_gamma01",
    now: 1_200,
  });
  assert.deepEqual(denied, { ok: false, error: "concurrency_limit" });

  const released = releaseOfflineRuntimeSlot(runtime, { sessionId: "mock_runtime_session01" });
  assert.equal(released.ok, true);
  assert.equal(released.released, true);
  assert.equal(released.runtime.activeSessions.length, 1);
});

test("duplicate active session cannot claim twice", () => {
  let runtime = fresh();
  runtime = claimOfflineRuntimeSlot(runtime, {
    sessionId: "mock_runtime_duplicate01",
    actorId: "mockactor_alpha01",
    now: 1_000,
  }).runtime;
  assert.deepEqual(claimOfflineRuntimeSlot(runtime, {
    sessionId: "mock_runtime_duplicate01",
    actorId: "mockactor_alpha01",
    now: 1_001,
  }), { ok: false, error: "session_already_active" });
});

test("per-actor rate limit fails closed and window expiry restores eligibility", () => {
  let runtime = fresh({ maxConcurrent: 5 });
  const actorId = "mockactor_rate001";
  for (const [sessionId, now] of [["mock_runtime_rate001", 1_000], ["mock_runtime_rate002", 2_000]]) {
    runtime = claimOfflineRuntimeSlot(runtime, { sessionId, actorId, now }).runtime;
    runtime = releaseOfflineRuntimeSlot(runtime, { sessionId }).runtime;
  }
  assert.deepEqual(claimOfflineRuntimeSlot(runtime, {
    sessionId: "mock_runtime_rate003",
    actorId,
    now: 3_000,
  }), { ok: false, error: "rate_limit" });

  const allowed = claimOfflineRuntimeSlot(runtime, {
    sessionId: "mock_runtime_rate004",
    actorId,
    now: 12_001,
  });
  assert.equal(allowed.ok, true);
});

test("emergency stop blocks new claims until deliberately cleared", () => {
  let runtime = fresh();
  runtime = setOfflineEmergencyStop(runtime, true).runtime;
  assert.deepEqual(claimOfflineRuntimeSlot(runtime, {
    sessionId: "mock_runtime_stop001",
    actorId: "mockactor_stop001",
    now: 1_000,
  }), { ok: false, error: "emergency_stop_active" });

  runtime = setOfflineEmergencyStop(runtime, false).runtime;
  assert.equal(claimOfflineRuntimeSlot(runtime, {
    sessionId: "mock_runtime_stop002",
    actorId: "mockactor_stop001",
    now: 1_100,
  }).ok, true);
});

test("release is idempotent and invalid configuration is rejected", () => {
  const runtime = fresh();
  const release = releaseOfflineRuntimeSlot(runtime, { sessionId: "mock_runtime_missing01" });
  assert.equal(release.ok, true);
  assert.equal(release.released, false);
  assert.equal(release.runtime, runtime);

  assert.deepEqual(createOfflineRuntimeGuard({ maxConcurrent: 0 }), {
    ok: false,
    error: "invalid_runtime_guard_config",
  });
  assert.deepEqual(createOfflineRuntimeGuard({ windowMs: 999 }), {
    ok: false,
    error: "invalid_runtime_guard_config",
  });
});
