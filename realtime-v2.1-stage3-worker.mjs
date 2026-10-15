import {
  verifyOpenAiWebhook,
  extractSipCallerE164,
  parseInternalAllowlist,
} from "./realtime-v2.1-openai-webhook-security.mjs";

const VERSION = "2.1.0-stage3-candidate";
const OPENAI_API_ORIGIN = "https://api.openai.com";
const LIVE_MODEL = "gpt-live-1";
const DEFAULT_VOICE = "marin";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function bearerToken(request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

function validSessionId(value) {
  return typeof value === "string" && /^live_[A-Za-z0-9_-]{3,200}$/.test(value);
}

function openAiHeaders(env) {
  const headers = {
    authorization: `Bearer ${env.OPENAI_API_KEY}`,
    "content-type": "application/json",
  };
  if (env.OPENAI_ALPHA_VALUE) headers["OpenAI-Alpha"] = env.OPENAI_ALPHA_VALUE;
  return headers;
}

async function doRequest(env, objectName, path, init = {}) {
  if (!env.STAGE3_CONTROL?.idFromName) throw new Error("stage3-control-binding-required");
  const id = env.STAGE3_CONTROL.idFromName(objectName);
  const stub = env.STAGE3_CONTROL.get(id);
  return stub.fetch(new Request(`https://stage3-control.invalid${path}`, init));
}

async function getDynamicEmergencyStop(env) {
  const response = await doRequest(env, "global", "/emergency-stop");
  if (!response.ok) throw new Error("emergency-stop-state-unavailable");
  const data = await response.json();
  return data.active !== false;
}

async function claimSession(env, sessionId, webhookId) {
  const response = await doRequest(env, `session:${sessionId}`, "/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ webhookId }),
  });
  if (response.status === 201) return { claimed: true };
  if (response.status === 409) return { claimed: false, duplicate: true };
  throw new Error("session-claim-unavailable");
}

async function rejectLiveSession(fetchImpl, env, sessionId, statusCode = 603) {
  if (!env.OPENAI_API_KEY) return { ok: false, reason: "openai-api-key-missing" };
  const response = await fetchImpl(
    `${OPENAI_API_ORIGIN}/v1/live/sessions/${encodeURIComponent(sessionId)}/reject`,
    {
      method: "POST",
      headers: openAiHeaders(env),
      body: JSON.stringify({ status_code: statusCode }),
    },
  );
  return { ok: response.ok, status: response.status };
}

async function acceptLiveSession(fetchImpl, env, sessionId) {
  if (!env.OPENAI_API_KEY) return { ok: false, reason: "openai-api-key-missing" };
  const instructions = [
    "You are Infinity Voice Lab, an internal technical test assistant.",
    "This session is only for an authorized internal test participant.",
    "Do not claim to contact customers, prospects, brokers, providers, or external systems.",
    "Do not make financial, legal, investment, availability, delivery-date, yield, or appreciation guarantees.",
    "Keep responses concise and conversational in Mexican Spanish unless the tester asks otherwise.",
  ].join(" ");

  const response = await fetchImpl(
    `${OPENAI_API_ORIGIN}/v1/live/sessions/${encodeURIComponent(sessionId)}/accept`,
    {
      method: "POST",
      headers: openAiHeaders(env),
      body: JSON.stringify({
        session: {
          type: "live",
          model: LIVE_MODEL,
          instructions,
          audio: { output: { voice: env.OPENAI_VOICE || DEFAULT_VOICE } },
          delegation: { type: "client" },
        },
      }),
    },
  );
  return { ok: response.ok, status: response.status };
}

export class Stage3Control {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/emergency-stop" && request.method === "GET") {
      const active = await this.state.storage.get("emergencyStop");
      return json({ active: active !== false });
    }

    if (url.pathname === "/emergency-stop" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (typeof body?.active !== "boolean") return json({ error: "boolean-active-required" }, 400);
      await this.state.storage.put("emergencyStop", body.active);
      return json({ active: body.active });
    }

    if (url.pathname === "/claim" && request.method === "POST") {
      const body = await request.json().catch(() => null);
      if (typeof body?.webhookId !== "string" || body.webhookId.length < 3) {
        return json({ error: "webhook-id-required" }, 400);
      }
      const existing = await this.state.storage.get("claim");
      if (existing) return json({ claimed: false, duplicate: true }, 409);
      await this.state.storage.put("claim", {
        webhookId: body.webhookId,
        claimedAt: Date.now(),
      });
      return json({ claimed: true }, 201);
    }

    return json({ error: "not-found" }, 404);
  }
}

export function createStage3Worker({ fetchImpl = fetch, nowMs = () => Date.now() } = {}) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);

      if (url.pathname === "/health" && request.method === "GET") {
        return json({
          service: "infinity-voice-stage3-lab",
          version: VERSION,
          mode: "stage3-internal-only",
          route: "telnyx-inbound-direct-sip-to-openai-live",
          live_enabled: env.LIVE_ENABLED === "true",
          static_emergency_stop: env.EMERGENCY_STOP !== "false",
          record_audio: false,
          customer_traffic: false,
        });
      }

      if (url.pathname === "/admin/emergency-stop" && request.method === "POST") {
        if (!env.LAB_ACCESS_TOKEN || bearerToken(request) !== env.LAB_ACCESS_TOKEN) {
          return json({ error: "unauthorized" }, 401);
        }
        const body = await request.json().catch(() => null);
        if (typeof body?.active !== "boolean") return json({ error: "boolean-active-required" }, 400);
        const response = await doRequest(env, "global", "/emergency-stop", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ active: body.active }),
        });
        if (!response.ok) return json({ error: "control-state-write-failed" }, 503);
        return json({ emergency_stop: body.active });
      }

      if (url.pathname !== "/webhooks/openai" || request.method !== "POST") {
        return json({ error: "not-found" }, 404);
      }

      const rawBody = await request.text();
      const verified = await verifyOpenAiWebhook({
        body: rawBody,
        headers: request.headers,
        secret: env.OPENAI_WEBHOOK_SECRET,
        nowMs: nowMs(),
      });
      if (!verified.ok) return json({ error: "invalid-webhook" }, 401);

      const event = JSON.parse(rawBody);
      if (event?.type !== "live.transport.incoming") {
        return json({ received: true, action: "ignored-event-type" }, 202);
      }
      if (event?.data?.type !== "sip" || !validSessionId(event?.data?.session_id)) {
        return json({ error: "invalid-live-sip-event" }, 400);
      }

      const sessionId = event.data.session_id;
      const claim = await claimSession(env, sessionId, verified.webhookId);
      if (!claim.claimed) return json({ received: true, action: "duplicate-ignored" }, 202);

      const caller = extractSipCallerE164(event);
      const allowlist = parseInternalAllowlist(env.INTERNAL_CALLER_ALLOWLIST);
      const callerAllowed = caller !== null && allowlist.includes(caller);

      let dynamicEmergencyStop = true;
      try {
        dynamicEmergencyStop = await getDynamicEmergencyStop(env);
      } catch {
        dynamicEmergencyStop = true;
      }

      const liveEnabled = env.LIVE_ENABLED === "true";
      const staticEmergencyStop = env.EMERGENCY_STOP !== "false";
      const canAccept = liveEnabled && !staticEmergencyStop && !dynamicEmergencyStop && callerAllowed;

      if (!canAccept) {
        const rejected = await rejectLiveSession(fetchImpl, env, sessionId, callerAllowed ? 486 : 603);
        if (!rejected.ok) return json({ received: true, action: "blocked-no-provider-confirmation" }, 503);
        return json({ received: true, action: "rejected" }, 202);
      }

      const accepted = await acceptLiveSession(fetchImpl, env, sessionId);
      if (!accepted.ok) return json({ received: true, action: "accept-failed" }, 502);
      return json({ received: true, action: "accepted-internal-test" }, 202);
    },
  };
}

export default createStage3Worker();
