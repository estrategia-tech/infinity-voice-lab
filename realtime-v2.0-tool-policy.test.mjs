import test from "node:test";
import assert from "node:assert/strict";
import {
  createOfflineMaterialCatalog,
  createOfflineToolPolicy,
  evaluateOfflineToolCall,
} from "./realtime-v2.0-tool-policy.mjs";

const policy = createOfflineToolPolicy({
  allowedTools: ["get_verified_material", "collect_visit_preferences", "request_human_review"],
}).policy;

const catalog = createOfflineMaterialCatalog([
  { id: "mock_material_01", version: "v1.2", verified: true, summary: "Precio e inventario verificados." },
  { id: "mock_material_02", version: "v1", verified: false, summary: "Material aún pendiente de validación." },
]).catalog;

test("returns verified material as data without executing a tool", () => {
  const result = evaluateOfflineToolCall(policy, {
    name: "get_verified_material",
    args: { material_id: "mock_material_01" },
  }, { catalog });
  assert.equal(result.ok, true);
  assert.equal(result.execute, false);
  assert.equal(result.disposition, "verified_material_available");
  assert.equal(result.material.version, "v1.2");
});

test("holds missing or unverified material", () => {
  const unverified = evaluateOfflineToolCall(policy, {
    name: "get_verified_material",
    args: { material_id: "mock_material_02" },
  }, { catalog });
  assert.deepEqual(unverified, {
    ok: true,
    disposition: "hold_for_verification",
    execute: false,
    material: null,
  });
  const missing = evaluateOfflineToolCall(policy, {
    name: "get_verified_material",
    args: { material_id: "mock_material_99" },
  }, { catalog });
  assert.equal(missing.disposition, "hold_for_verification");
});

test("denies unknown or non-allowlisted tools", () => {
  assert.deepEqual(evaluateOfflineToolCall(policy, {
    name: "delete_database",
    args: {},
  }, { catalog }), { ok: false, error: "tool_not_allowed" });
  const narrow = createOfflineToolPolicy({ allowedTools: ["request_human_review"] }).policy;
  assert.deepEqual(evaluateOfflineToolCall(narrow, {
    name: "collect_visit_preferences",
    args: {},
  }, { catalog }), { ok: false, error: "tool_not_allowed" });
});

test("human handoff and visit collection remain decisions only", () => {
  const visit = evaluateOfflineToolCall(policy, { name: "collect_visit_preferences", args: {} }, { catalog });
  const human = evaluateOfflineToolCall(policy, { name: "request_human_review", args: {} }, { catalog });
  assert.equal(visit.execute, false);
  assert.equal(human.execute, false);
  assert.equal(human.disposition, "human_review_requested");
});
