import test from "node:test";
import assert from "node:assert/strict";
import {
  verifyOpenAiWebhook,
  extractSipCallerE164,
  parseInternalAllowlist,
} from "./realtime-v2.1-openai-webhook-security.mjs";

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

async function signedFixture({ body = '{"ok":true}', timestamp = 1_800_000_000 } = {}) {
  const keyBytes = new Uint8Array(32).fill(17);
  const secret = `whsec_${bytesToBase64(keyBytes)}`;
  const webhookId = "wh_stage3_test";
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = new TextEncoder().encode(`${webhookId}.${timestamp}.${body}`);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  return {
    body,
    secret,
    nowMs: timestamp * 1000,
    headers: {
      "webhook-id": webhookId,
      "webhook-timestamp": String(timestamp),
      "webhook-signature": `v1,${bytesToBase64(signature)}`,
    },
  };
}

test("accepts a valid fresh Standard Webhooks signature", async () => {
  const fixture = await signedFixture();
  const result = await verifyOpenAiWebhook(fixture);
  assert.equal(result.ok, true);
  assert.equal(result.webhookId, "wh_stage3_test");
});

test("rejects tampered raw body", async () => {
  const fixture = await signedFixture();
  const result = await verifyOpenAiWebhook({ ...fixture, body: '{"ok":false}' });
  assert.deepEqual(result, { ok: false, reason: "signature-mismatch" });
});

test("rejects stale timestamps before parsing the event", async () => {
  const fixture = await signedFixture();
  const result = await verifyOpenAiWebhook({
    ...fixture,
    nowMs: fixture.nowMs + 301_000,
  });
  assert.deepEqual(result, { ok: false, reason: "webhook-timestamp-outside-tolerance" });
});

test("supports multiple v1 signatures during rotation", async () => {
  const fixture = await signedFixture();
  fixture.headers["webhook-signature"] = `v1,AAAA ${fixture.headers["webhook-signature"]}`;
  const result = await verifyOpenAiWebhook(fixture);
  assert.equal(result.ok, true);
});

test("requires webhook id, timestamp and signature", async () => {
  const fixture = await signedFixture();
  const result = await verifyOpenAiWebhook({ ...fixture, headers: {} });
  assert.deepEqual(result, { ok: false, reason: "required-signature-headers-missing" });
});

test("extracts only an E.164 caller from the SIP From header", () => {
  const event = {
    data: {
      sip_headers: [
        { name: "To", value: "sip:+522200000000@sip.example.com" },
        { name: "From", value: "sip:+525500000001@sip.example.com;tag=abc" },
      ],
    },
  };
  assert.equal(extractSipCallerE164(event), "+525500000001");
  assert.equal(extractSipCallerE164({ data: { sip_headers: [] } }), null);
});

test("allowlist parser deduplicates valid E.164 entries and drops invalid values", () => {
  assert.deepEqual(
    parseInternalAllowlist("+525500000001, bad, +525500000001, +522200000002"),
    ["+525500000001", "+522200000002"],
  );
});
