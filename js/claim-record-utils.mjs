export function getClaimTargetId(claim = {}) {
  return claim.targetId || claim.piId || '';
}

export function getClaimTargetName(claim = {}) {
  return claim.targetName || claim.piName || '';
}

export function getClaimTargetCollection(type = 'pi') {
  return type === 'institute' ? 'institutes' : 'groups';
}

export function buildClaimedByUpdate(claim = {}) {
  return {
    claimedBy: claim.claimantUid,
    claimedByEmail: claim.claimantEmail || '',
    claimedByName: claim.claimantName || ''
  };
}
