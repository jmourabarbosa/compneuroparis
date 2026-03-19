function planClaimReconciliation(claims, claimantUid = null) {
  let keptApprovedForClaimant = false;
  let promotedPendingClaim = false;
  const updates = [];

  for (const claim of claims) {
    const isTargetClaimant = claimantUid && claim.claimantUid === claimantUid;

    if (claim.status === "approved") {
      if (isTargetClaimant && !keptApprovedForClaimant) {
        keptApprovedForClaimant = true;
        continue;
      }
      updates.push({
        id: claim.id,
        status: "revoked",
        timestampField: "revokedAt",
      });
      continue;
    }

    if (claim.status === "pending") {
      if (isTargetClaimant && !keptApprovedForClaimant) {
        updates.push({
          id: claim.id,
          status: "approved",
          timestampField: "reviewedAt",
        });
        keptApprovedForClaimant = true;
        promotedPendingClaim = true;
      } else {
        updates.push({
          id: claim.id,
          status: "rejected",
          timestampField: "reviewedAt",
        });
      }
    }
  }

  return { promotedPendingClaim, updates };
}

module.exports = {
  planClaimReconciliation,
};
