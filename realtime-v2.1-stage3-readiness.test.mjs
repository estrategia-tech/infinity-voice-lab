import test from "node:test";
import assert from "node:assert/strict";
import { Stage3Control, createStage3Worker } from "./realtime-v2.1-stage3-worker.mjs";

class MemoryStorage {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.get(key); }
  async put(key, value) { this.map.set(key, value); }
}

class FakeDurableNamespace {
  constructor() { this.objects = new Map(); }
  idFromName(name) { return name; }
  get(id) {
    if (!this.objects.has(id)) {
      this.objects.set(id, new Stage3Control({ storage: new MemoryStorage() }));
    }
    const object = this.objects.get(id);
    return { fetch: (request) => object.fetch(request) };
  }
}

function readyEnv(overrides = {}) {
  return {
    OPENAI_API_KEY: "present-openai-key",
    OPENAI_WEBHOOK_SECRET: "present-webhook-secret",
    INTERNAL_CALLER_ALLOWLIST: "+525500000001",
    LAB_ACCESS_TOKEN: "present-admin-token",
    LIVE_ENABLED: "false",
    EMERGENCY_STOP: "true",
    STAGE3_CONTROL: new FakeDurableNamespace(),
    ...overrides,
  };
}

test("readiness reports configuration without exposing values", async () => {
  const env = readyEnv();
  const worker = createStage3Worker({ fetchImpl: async () => { throw new Error("network forbidden"); } });
  const response = await worker.fetch(new Request("https://stage3.example/readiness"), env);
  const text = await response.text();
  const data = JSON.parse(text);

  assert.equal(response.status, 200);
  assert.equal(data.configuration_ready, true);
  assert.equal(data.internal_allowlist_entries, 1);
  assert.equal(data.live_enabled, false);
  assert.equal(data.static_emergency_stop, true);
  assert.equal(data.dynamic_emergency_stop, "active");
  assert.equal(data.provider_call_performed, false);
  assert.equal(data.secret_values_exposed, false);

  for (const value of [
    env.OPENAI_API_KEY,
    env.OPENAI_WEBHOOK_SECRET,
    env.INTERNAL_CALLER_ALLOWLIST,
    env.LAB_ACCESS_TOKEN,
  ]) {
    assert.equal(text.includes(value), false);
  }
});

test("readiness is false when required configuration is missing", async () => {
  const env = readyEnv({ INTERNAL_CALLER_ALLOWLIST: "", LAB_ACCESS_TOKEN: "" });
  const worker = createStage3Worker({ fetchImpl: async () => { throw new Error("network forbidden"); } });
  const response = await worker.fetch(new Request("https://stage3.example/readiness"), env);
  const data = await response.json();

  assert.equal(data.configuration_ready, false);
  assert.equal(data.internal_allowlist_entries, 0);
  assert.equal(data.live_enabled, false);
  assert.equal(data.static_emergency_stop, true);
});
