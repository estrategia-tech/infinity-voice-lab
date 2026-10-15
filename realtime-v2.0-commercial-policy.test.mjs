import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateOfflineCommercialClaims,
  evaluateOfflineHandoff,
} from "./realtime-v2.0-commercial-policy.mjs";

function claim(overrides = {}) {
  return {
    kind: "price",
    value: "$3,000,000 MXN",
    sourceId: "mocksrc_inventory01",
    sourceVersion: "v1.2",
    verified: true,
    guaranteed: false,
    ...overrides,
  };
}

test("surfaces only verified claims with source metadata", () => {
  const result = evaluateOfflineCommercialClaims([
    claim(),
    claim({ kind: "feature", value: "2 recámaras", verified: false }),
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.execute, false);
  assert.equal(result.safeClaims.length, 1);
  assert.equal(result.heldClaims.length, 1);
  assert.equal(result.disposition, "partial_hold_for_verification");
});

test("rejects guaranteed yield appreciation or delivery date", () => {
  for (const kind of ["yield", "appreciation", "delivery_date"]) {
    assert.deepEqual(evaluateOfflineCommercialClaims([
      claim({ kind, value: "dato documentado", guaranteed: true }),
    ]), { ok: false, error: "unsupported_guarantee" });
  }
});

test("marks sensitive verified claims as documented but not guaranteed", () => {
  const result = evaluateOfflineCommercialClaims([
    claim({ kind: "delivery_date", value: "1T 2027" }),
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.safeClaims[0].qualification, "documented_not_guaranteed");
});

test("handoff locks the automated conversation but never executes an external action", () => {
  const pending = evaluateOfflineHandoff({ requested: true, humanAvailable: false });
  assert.equal(pending.disposition, "handoff_pending");
  assert.equal(pending.lockConversation, true);
  assert.equal(pending.execute, false);
  const eligible = evaluateOfflineHandoff({ requested: true, humanAvailable: true });
  assert.equal(eligible.disposition, "handoff_eligible");
  assert.equal(eligible.execute, false);
});
