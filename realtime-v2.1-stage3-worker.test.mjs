import test from "node:test";
import assert from "node:assert/strict";
import { Stage3Control, createStage3Worker } from "./realtime-v2.1-stage3-worker.mjs";

const CALLER = "+525500000001";
const SESSION = "live_stage3test1";
const NOW_SECONDS = 1_800_000_000;

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

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
      const object = new Stage3Control({ storage: new MemoryStorage() });
      this.objects.set(id, object);
    }
    const object = this.objects.get(id);
    return { fetch: (request) => object.fetch(request) };
  }
}

async function signingMaterial() {
  const keyBytes = new Uint8Array(32).fill(23);
  return {
    keyBytes,
    secret: `whsec_${bytesToBase64(keyBytes)}`,
  };
}

async function signedRequest({
  caller = CALLER,
  sessionId = SESSION,
  webhookId = "wh_stage3_worker_1",
  eventType = "live.transport.incoming",
  secret,
  keyBytes,
} = {}) {
  const body = JSON.stringify({
    object: "event",
    id: "evt_stage3",
    type: eventType,
    data: {
      type: "sip",
      session_id: sessionId,
      sip_headers: [
        { name: "From", value: `sip:${caller}@sip.example.com;tag=x` },
        { name: "To", value: "sip:proj_test@sip.api.openai.com" },
      ],
    },
  });
  const timestamp = String(NOW_SECONDS);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new TextEncoder().encode(`${webhookId}.${timestamp}.${body}`);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
  return new Request("https://stage3.example/webhooks/openai", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": webhookId,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${bytesToBase64(signature)}`,
    },
    body,
  });
}

async function setDynamicStop(namespace, active) {
  const stub = namespace.get(namespace.idFromName("global"));
  const response = await stub.fetch(new Request("https://control.invalid/emergency-stop", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ active }),
  }));
  assert.equal(response.ok, true);
}

async function envFixture(overrides = {}) {
  const signing = await signingMaterial();
  return {
    OPENAI_WEBHOOK_SECRET: signing.secret,
    OPENAI_API_KEY: "test-only-key-not-a-real-secret",
    OPENAI_ALPHA_VALUE: "quicksilver=v3",
    OPENAI_VOICE: "marin",
    INTERNAL_CALLER_ALLOWLIST: CALLER,
    LAB_ACCESS_TOKEN: "test-only-admin-token",
    LIVE_ENABLED: "true",
    EMERGENCY_STOP: "false",
    STAGE3_CONTROL: new FakeDurableNamespace(),
    __signing: signing,
    ...overrides,
  };
}

function providerRecorder(status = 200) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response("{}", { status, headers: { "content-type": "application/json" } });
  };
  return { calls, fetchImpl };
}

test("health is explicit about lab scope and never exposes secrets", async () => {
  const env = await envFixture();
  const worker = createStage3Worker({ fetchImpl: async () => { throw new Error("network forbidden"); } });
  const response = await worker.fetch(new Request("https://stage3.example/health"), env);
  const text = await response.text();
  const data = JSON.parse(text);
  assert.equal(response.status, 200);
  assert.equal(data.mode, "stage3-internal-only");
  assert.equal(data.customer_traffic, false);
  assert.equal(data.record_audio, false);
  assert.equal(text.includes(env.OPENAI_API_KEY), false);
  assert.equal(text.includes(env.OPENAI_WEBHOOK_SECRET), false);
});

test("invalid webhook signature fails before any provider action", async () => {
  const env = await envFixture();
  const recorder = providerRecorder();
  const worker = createStage3Worker({ fetchImpl: recorder.fetchImpl, nowMs: () => NOW_SECONDS * 1000 });
  const request = new Request("https://stage3.example/webhooks/openai", {
    method: "POST",
    headers: {
      "webhook-id": "bad",
      "webhook-timestamp": String(NOW_SECONDS),
      "webhook-signature": "v1,AAAA",
    },
    body: "{}",
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 401);
  assert.equal(recorder.calls.length, 0);
});

test("dynamic emergency stop defaults fail-closed and rejects the valid incoming call", async () => {
  const env = await envFixture();
  const recorder = providerRecorder();
  const worker = createStage3Worker({ fetchImpl: recorder.fetchImpl, nowMs: () => NOW_SECONDS * 1000 });
  const request = await signedRequest({ ...env.__signing });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 202);
  assert.equal(recorder.calls.length, 1);
  assert.match(recorder.calls[0].url, /\/reject$/);
});

test("authorized admin can deliberately clear the dynamic emergency stop", async () => {
  const env = await envFixture();
  const worker = createStage3Worker({ fetchImpl: async () => { throw new Error("network forbidden"); } });
  const response = await worker.fetch(new Request("https://stage3.example/admin/emergency-stop", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.LAB_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ active: false }),
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { emergency_stop: false });
});

test("unauthorized caller is actively rejected and never accepted", async () => {
  const env = await envFixture();
  await setDynamicStop(env.STAGE3_CONTROL, false);
  const recorder = providerRecorder();
  const worker = createStage3Worker({ fetchImpl: recorder.fetchImpl, nowMs: () => NOW_SECONDS * 1000 });
  const request = await signedRequest({
    ...env.__signing,
    caller: "+525500000009",
    webhookId: "wh_stage3_worker_unauthorized",
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 202);
  assert.equal(recorder.calls.length, 1);
  assert.match(recorder.calls[0].url, /\/reject$/);
  const body = JSON.parse(recorder.calls[0].init.body);
  assert.equal(body.status_code, 603);
});

test("fully gated internal caller uses only GPT-Live accept endpoint", async () => {
  const env = await envFixture();
  await setDynamicStop(env.STAGE3_CONTROL, false);
  const recorder = providerRecorder();
  const worker = createStage3Worker({ fetchImpl: recorder.fetchImpl, nowMs: () => NOW_SECONDS * 1000 });
  const request = await signedRequest({ ...env.__signing, webhookId: "wh_stage3_worker_accept" });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { received: true, action: "accepted-internal-test" });
  assert.equal(recorder.calls.length, 1);
  assert.match(recorder.calls[0].url, /\/v1\/live\/sessions\/live_stage3test1\/accept$/);
  const body = JSON.parse(recorder.calls[0].init.body);
  assert.equal(body.session.type, "live");
  assert.equal(body.session.model, "gpt-live-1");
  assert.equal(body.session.audio.output.voice, "marin");
  assert.equal("format" in body.session.audio, false);
  assert.equal("store" in body.session, false);
  assert.equal("tools" in body.session, false);
});

test("duplicate delivery for the same session cannot trigger a second provider action", async () => {
  const env = await envFixture();
  await setDynamicStop(env.STAGE3_CONTROL, false);
  const recorder = providerRecorder();
  const worker = createStage3Worker({ fetchImpl: recorder.fetchImpl, nowMs: () => NOW_SECONDS * 1000 });
  const request1 = await signedRequest({ ...env.__signing, webhookId: "wh_stage3_duplicate" });
  const request2 = await signedRequest({ ...env.__signing, webhookId: "wh_stage3_duplicate" });
  const first = await worker.fetch(request1, env);
  const second = await worker.fetch(request2, env);
  assert.equal(first.status, 202);
  assert.equal(second.status, 202);
  assert.deepEqual(await second.json(), { received: true, action: "duplicate-ignored" });
  assert.equal(recorder.calls.length, 1);
});

test("static emergency stop overrides a cleared dynamic stop", async () => {
  const env = await envFixture({ EMERGENCY_STOP: "true" });
  await setDynamicStop(env.STAGE3_CONTROL, false);
  const recorder = providerRecorder();
  const worker = createStage3Worker({ fetchImpl: recorder.fetchImpl, nowMs: () => NOW_SECONDS * 1000 });
  const request = await signedRequest({ ...env.__signing, webhookId: "wh_stage3_static_stop" });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 202);
  assert.match(recorder.calls[0].url, /\/reject$/);
});
