const test = require("node:test");
const assert = require("node:assert/strict");

const { planClaimReconciliation } = require("./ownership-logic");

test("planClaimReconciliation promotes a matching pending claim and rejects competing pending claims", () => {
  const result = planClaimReconciliation([
    { id: "pending-a", status: "pending", claimantUid: "user-a" },
    { id: "pending-b", status: "pending", claimantUid: "user-b" },
  ], "user-a");

  assert.equal(result.promotedPendingClaim, true);
  assert.deepEqual(result.updates, [
    { id: "pending-a", status: "approved", timestampField: "reviewedAt" },
    { id: "pending-b", status: "rejected", timestampField: "reviewedAt" },
  ]);
});

test("planClaimReconciliation revokes prior approved claims when admin assigns a different claimant", () => {
  const result = planClaimReconciliation([
    { id: "approved-a", status: "approved", claimantUid: "user-a" },
    { id: "pending-b", status: "pending", claimantUid: "user-b" },
  ], "user-b");

  assert.equal(result.promotedPendingClaim, true);
  assert.deepEqual(result.updates, [
    { id: "approved-a", status: "revoked", timestampField: "revokedAt" },
    { id: "pending-b", status: "approved", timestampField: "reviewedAt" },
  ]);
});

test("planClaimReconciliation clears ownership by revoking approved claims and rejecting pending ones", () => {
  const result = planClaimReconciliation([
    { id: "approved-a", status: "approved", claimantUid: "user-a" },
    { id: "pending-b", status: "pending", claimantUid: "user-b" },
  ], null);

  assert.equal(result.promotedPendingClaim, false);
  assert.deepEqual(result.updates, [
    { id: "approved-a", status: "revoked", timestampField: "revokedAt" },
    { id: "pending-b", status: "rejected", timestampField: "reviewedAt" },
  ]);
});

test("planClaimReconciliation keeps an existing approved claim for the same claimant without extra updates", () => {
  const result = planClaimReconciliation([
    { id: "approved-a", status: "approved", claimantUid: "user-a" },
  ], "user-a");

  assert.equal(result.promotedPendingClaim, false);
  assert.deepEqual(result.updates, []);
});
