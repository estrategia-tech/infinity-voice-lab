/**
 * Infinity Voice v2.0 — offline tool allowlist and verified-material policy.
 * Tool calls are evaluated only; this module performs no external action.
 */
const KNOWN_TOOLS = new Set(["get_verified_material", "collect_visit_preferences", "request_human_review"]);
const MATERIAL_ID_RE = /^mock_material_[a-zA-Z0-9_-]{2,64}$/;

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

export function createOfflineToolPolicy({ allowedTools = [] } = {}) {
  if (!Array.isArray(allowedTools) || allowedTools.length < 1 ||
      allowedTools.some((name) => !KNOWN_TOOLS.has(name)) || new Set(allowedTools).size !== allowedTools.length) {
    return { ok: false, error: "invalid_tool_policy" };
  }
  return {
    ok: true,
    policy: Object.freeze({ kind: "offline-tool-policy", allowedTools: new Set(allowedTools) }),
  };
}

export function createOfflineMaterialCatalog(materials = []) {
  if (!Array.isArray(materials) || materials.length > 100) return { ok: false, error: "invalid_material_catalog" };
  const map = new Map();
  for (const material of materials) {
    if (!plainObject(material) || !MATERIAL_ID_RE.test(material.id ?? "") || typeof material.version !== "string" ||
        !/^v[0-9]+(?:\.[0-9]+){0,2}$/.test(material.version) || typeof material.verified !== "boolean" ||
        typeof material.summary !== "string" || material.summary.length < 1 || material.summary.length > 800 || map.has(material.id)) {
      return { ok: false, error: "invalid_material_catalog" };
    }
    map.set(material.id, Object.freeze({ ...material }));
  }
  return { ok: true, catalog: Object.freeze({ kind: "offline-material-catalog", materials: map }) };
}

export function evaluateOfflineToolCall(policy, call, { catalog } = {}) {
  if (policy?.kind !== "offline-tool-policy" || !(policy.allowedTools instanceof Set) || !plainObject(call) ||
      typeof call.name !== "string" || !plainObject(call.args)) {
    return { ok: false, error: "invalid_tool_evaluation" };
  }
  if (!policy.allowedTools.has(call.name) || !KNOWN_TOOLS.has(call.name)) {
    return { ok: false, error: "tool_not_allowed" };
  }

  if (call.name === "get_verified_material") {
    if (catalog?.kind !== "offline-material-catalog" || !(catalog.materials instanceof Map)) {
      return { ok: false, error: "material_catalog_required" };
    }
    const materialId = call.args.material_id;
    if (!MATERIAL_ID_RE.test(materialId ?? "")) return { ok: false, error: "invalid_material_request" };
    const material = catalog.materials.get(materialId);
    if (!material || !material.verified) {
      return { ok: true, disposition: "hold_for_verification", execute: false, material: null };
    }
    return {
      ok: true,
      disposition: "verified_material_available",
      execute: false,
      material: Object.freeze({ id: material.id, version: material.version, summary: material.summary }),
    };
  }

  if (call.name === "collect_visit_preferences") {
    return { ok: true, disposition: "collect_preferences_only", execute: false };
  }

  return { ok: true, disposition: "human_review_requested", execute: false };
}
