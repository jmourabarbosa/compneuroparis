const test = require("node:test");
const assert = require("node:assert/strict");

const { planGroupClaimChange } = require("./group-claim-logic");

test("planGroupClaimChange assigns claimant and requests notification for a new direct admin assignment", () => {
  const result = planGroupClaimChange(
    { name: "German Sumbre", claimedBy: null },
    { uid: "user-a", email: "german@example.org" },
    false,
  );

  assert.deepEqual(result, {
    mode: "assign",
    nextClaimedBy: "user-a",
    nextClaimedByEmail: "german@example.org",
    shouldNotifyClaimant: true,
    emailSubject: "You have been granted ownership of German Sumbre",
    emailHtml: `<p>An administrator has granted your account ownership of the PI page for <strong>German Sumbre</strong> on Neuroscience in Paris.</p>
       <p>You can now edit the profile and manage related actions from your account.</p>`,
  });
});

test("planGroupClaimChange skips notification when the matching pending claim was promoted", () => {
  const result = planGroupClaimChange(
    { name: "German Sumbre", claimedBy: "user-old" },
    { uid: "user-new", email: "german@example.org" },
    true,
  );

  assert.equal(result.mode, "assign");
  assert.equal(result.nextClaimedBy, "user-new");
  assert.equal(result.shouldNotifyClaimant, false);
});

test("planGroupClaimChange clears ownership without notification", () => {
  const result = planGroupClaimChange(
    { name: "German Sumbre", claimedBy: "user-old" },
    null,
    false,
  );

  assert.deepEqual(result, {
    mode: "clear",
    nextClaimedBy: null,
    nextClaimedByEmail: "",
    shouldNotifyClaimant: false,
    emailSubject: "You have been granted ownership of German Sumbre",
    emailHtml: `<p>An administrator has granted your account ownership of the PI page for <strong>German Sumbre</strong> on Neuroscience in Paris.</p>
       <p>You can now edit the profile and manage related actions from your account.</p>`,
  });
});
