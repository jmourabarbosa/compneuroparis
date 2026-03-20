const { planClaimReconciliation } = require("./ownership-logic");

function createClaimService({ admin }) {
  async function reconcileClaimsForTarget(targetId, claimantUid = null) {
    const firestore = admin.firestore();
    const [targetClaimsSnap, legacyClaimsSnap] = await Promise.all([
      firestore.collection("claims").where("targetId", "==", targetId).get(),
      firestore.collection("claims").where("piId", "==", targetId).get(),
    ]);

    const claimDocs = new Map();
    for (const snap of [targetClaimsSnap, legacyClaimsSnap]) {
      for (const claimDoc of snap.docs) {
        claimDocs.set(claimDoc.id, claimDoc);
      }
    }

    const { promotedPendingClaim, updates } = planClaimReconciliation(
      [...claimDocs.values()].map((claimDoc) => ({ id: claimDoc.id, ...claimDoc.data() })),
      claimantUid,
    );

    for (const update of updates) {
      const claimDoc = claimDocs.get(update.id);
      await claimDoc.ref.update({
        status: update.status,
        [update.timestampField]: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return { promotedPendingClaim };
  }

  return {
    reconcileClaimsForTarget,
  };
}

module.exports = {
  createClaimService,
};
