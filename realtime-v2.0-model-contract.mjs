/**
 * Infinity Voice v2.0 — provider-agnostic offline model proposal contract.
 * Model output is always untrusted data. No model/API call occurs here.
 */
const INTENTS = new Set(["greeting", "property_information", "schedule_visit", "human_handoff", "unknown"]);
const TOOL_NAME_RE = /^[a-z][a-z0-9_]{2,63}$/;
const SOURCE_VERSION_RE = /^mockmodel-v[0-9]+$/;
const CLAIM_KINDS = new Set(["price", "availability", "delivery_date", "yield", "appreciation", "feature"]);

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, expected) {
  if (!plainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function validArgs(args) {
  if (!plainObject(args) || Object.keys(args).length > 8) return false;
  return Object.entries(args).every(([key, value]) =>
    TOOL_NAME_RE.test(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean") &&
    (typeof value !== "string" || value.length <= 240));
}

function validateToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls) || toolCalls.length > 4) return false;
  return toolCalls.every((call) => exactKeys(call, ["name", "args"]) && TOOL_NAME_RE.test(call.name ?? "") && validArgs(call.args));
}

function validateClaims(claims) {
  if (!Array.isArray(claims) || claims.length > 8) return false;
  return claims.every((claim) => exactKeys(claim, ["kind", "value", "sourceId", "sourceVersion", "verified", "guaranteed"]) &&
    CLAIM_KINDS.has(claim.kind) && typeof claim.value === "string" && claim.value.length >= 1 && claim.value.length <= 280 &&
    typeof claim.sourceId === "string" && /^mocksrc_[a-zA-Z0-9_-]{6,64}$/.test(claim.sourceId) &&
    typeof claim.sourceVersion === "string" && /^v[0-9]+(?:\.[0-9]+){0,2}$/.test(claim.sourceVersion) &&
    typeof claim.verified === "boolean" && typeof claim.guaranteed === "boolean");
}

export function validateOfflineModelProposal(raw, { expectedTurn } = {}) {
  if (!Number.isSafeInteger(expectedTurn) || expectedTurn < 1) return { ok: false, error: "invalid_model_context" };
  if (!exactKeys(raw, ["turn", "reply", "intent", "toolCalls", "claims", "handoffRequested", "sourceVersion"])) {
    return { ok: false, error: "invalid_model_proposal_shape" };
  }
  if (raw.turn !== expectedTurn || typeof raw.reply !== "string" || raw.reply.length < 1 || raw.reply.length > 800 ||
      !INTENTS.has(raw.intent) || typeof raw.handoffRequested !== "boolean" || !SOURCE_VERSION_RE.test(raw.sourceVersion ?? "") ||
      !validateToolCalls(raw.toolCalls) || !validateClaims(raw.claims)) {
    return { ok: false, error: "invalid_model_proposal" };
  }
  return {
    ok: true,
    proposal: Object.freeze({
      turn: raw.turn,
      reply: raw.reply,
      intent: raw.intent,
      toolCalls: Object.freeze(raw.toolCalls.map((call) => Object.freeze({ name: call.name, args: Object.freeze({ ...call.args }) }))),
      claims: Object.freeze(raw.claims.map((claim) => Object.freeze({ ...claim }))),
      handoffRequested: raw.handoffRequested,
      sourceVersion: raw.sourceVersion,
    }),
  };
}
