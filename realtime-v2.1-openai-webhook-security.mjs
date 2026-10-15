// Infinity Voice v2.1 — OpenAI webhook verification boundary.
// Web Crypto only; compatible with Cloudflare Workers and Node 22 tests.

const DEFAULT_TOLERANCE_SECONDS = 300;

function headerValue(headers, name) {
  if (headers?.get) return headers.get(name);
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === target) return String(value);
  }
  return null;
}

function decodeBase64(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function signatureCandidates(value) {
  if (typeof value !== "string") return [];
  return value
    .trim()
    .split(/\s+/)
    .map((item) => item.startsWith("v1,") ? item.slice(3) : null)
    .filter(Boolean);
}

export async function verifyOpenAiWebhook({
  body,
  headers,
  secret,
  nowMs = Date.now(),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
} = {}) {
  if (typeof body !== "string") return Object.freeze({ ok: false, reason: "raw-body-required" });
  if (typeof secret !== "string" || !secret.startsWith("whsec_") || secret.length <= 6) {
    return Object.freeze({ ok: false, reason: "valid-webhook-secret-required" });
  }

  const webhookId = headerValue(headers, "webhook-id");
  const timestampText = headerValue(headers, "webhook-timestamp");
  const signatureHeader = headerValue(headers, "webhook-signature");

  if (!webhookId || !timestampText || !signatureHeader) {
    return Object.freeze({ ok: false, reason: "required-signature-headers-missing" });
  }

  const timestamp = Number(timestampText);
  if (!Number.isInteger(timestamp) || timestamp <= 0) {
    return Object.freeze({ ok: false, reason: "invalid-webhook-timestamp" });
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return Object.freeze({ ok: false, reason: "webhook-timestamp-outside-tolerance" });
  }

  let keyBytes;
  try {
    keyBytes = decodeBase64(secret.slice(6));
  } catch {
    return Object.freeze({ ok: false, reason: "invalid-webhook-secret-encoding" });
  }

  if (keyBytes.byteLength < 16) {
    return Object.freeze({ ok: false, reason: "webhook-secret-too-short" });
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signedPayload = `${webhookId}.${timestampText}.${body}`;
  const data = new TextEncoder().encode(signedPayload);
  const candidates = signatureCandidates(signatureHeader);
  if (candidates.length === 0) {
    return Object.freeze({ ok: false, reason: "no-v1-signature" });
  }

  for (const candidate of candidates) {
    try {
      const signature = decodeBase64(candidate);
      if (await crypto.subtle.verify("HMAC", key, signature, data)) {
        return Object.freeze({ ok: true, webhookId, timestamp });
      }
    } catch {
      // Continue through signatures during key/signature rotation.
    }
  }

  return Object.freeze({ ok: false, reason: "signature-mismatch" });
}

export function extractSipCallerE164(event) {
  const headers = event?.data?.sip_headers;
  if (!Array.isArray(headers)) return null;
  const from = headers.find((item) => String(item?.name ?? "").toLowerCase() === "from");
  const value = String(from?.value ?? "");
  const match = value.match(/(?:sip:|tel:)(\+[1-9]\d{7,14})(?:@|[;>]|$)/i);
  return match?.[1] ?? null;
}

export function parseInternalAllowlist(value) {
  if (typeof value !== "string" || value.trim() === "") return Object.freeze([]);
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /^\+[1-9]\d{7,14}$/.test(item));
  return Object.freeze([...new Set(values)]);
}
