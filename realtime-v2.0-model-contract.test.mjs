import test from "node:test";
import assert from "node:assert/strict";
import { validateOfflineModelProposal } from "./realtime-v2.0-model-contract.mjs";

function proposal(overrides = {}) {
  return {
    turn: 1,
    reply: "Puedo ayudarte con información verificada.",
    intent: "property_information",
    toolCalls: [{ name: "get_verified_material", args: { material_id: "mock_material_01" } }],
    claims: [{
      kind: "price",
      value: "$3,000,000 MXN",
      sourceId: "mocksrc_inventory01",
      sourceVersion: "v1.2",
      verified: true,
      guaranteed: false,
    }],
    handoffRequested: false,
    sourceVersion: "mockmodel-v1",
    ...overrides,
  };
}

test("accepts a bounded provider-agnostic model proposal", () => {
  const result = validateOfflineModelProposal(proposal(), { expectedTurn: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.proposal.toolCalls[0].name, "get_verified_material");
  assert.equal(result.proposal.claims[0].verified, true);
});

test("rejects turn mismatch unknown intent and extra fields", () => {
  assert.deepEqual(validateOfflineModelProposal(proposal(), { expectedTurn: 2 }), {
    ok: false,
    error: "invalid_model_proposal",
  });
  assert.deepEqual(validateOfflineModelProposal(proposal({ intent: "delete_everything" }), { expectedTurn: 1 }), {
    ok: false,
    error: "invalid_model_proposal",
  });
  assert.deepEqual(validateOfflineModelProposal({ ...proposal(), hiddenInstruction: true }, { expectedTurn: 1 }), {
    ok: false,
    error: "invalid_model_proposal_shape",
  });
});

test("rejects oversized or malformed tool arguments", () => {
  assert.equal(validateOfflineModelProposal(proposal({
    toolCalls: [{ name: "get_verified_material", args: { material_id: "x".repeat(241) } }],
  }), { expectedTurn: 1 }).ok, false);
  assert.equal(validateOfflineModelProposal(proposal({
    toolCalls: [{ name: "Bad-Tool", args: {} }],
  }), { expectedTurn: 1 }).ok, false);
});

test("rejects malformed structured commercial claims", () => {
  assert.equal(validateOfflineModelProposal(proposal({
    claims: [{
      kind: "yield",
      value: "10%",
      sourceId: "invalid",
      sourceVersion: "v1",
      verified: true,
      guaranteed: true,
    }],
  }), { expectedTurn: 1 }).ok, false);
});
