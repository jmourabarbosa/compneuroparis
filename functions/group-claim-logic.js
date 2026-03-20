function planGroupClaimChange(group = {}, claimantUser = null, promotedPendingClaim = false) {
  const previousClaimedBy = group.claimedBy || null;
  const nextClaimedBy = claimantUser?.uid || null;
  const nextClaimedByEmail = claimantUser?.email || "";
  const groupName = group.name || "a PI page";

  return {
    mode: nextClaimedBy ? "assign" : "clear",
    nextClaimedBy,
    nextClaimedByEmail,
    shouldNotifyClaimant: Boolean(nextClaimedBy && previousClaimedBy !== nextClaimedBy && !promotedPendingClaim),
    emailSubject: `You have been granted ownership of ${groupName}`,
    emailHtml: `<p>An administrator has granted your account ownership of the PI page for <strong>${groupName}</strong> on Neuroscience in Paris.</p>
       <p>You can now edit the profile and manage related actions from your account.</p>`,
  };
}

module.exports = {
  planGroupClaimChange,
};
