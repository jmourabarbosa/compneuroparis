const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM = `Neuroscience in Paris <${process.env.EMAIL_USER}>`;

async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err);
  }
}

async function getEmailFromUid(uid) {
  if (!uid) return null;
  try {
    const user = await admin.auth().getUser(uid);
    return user.email || null;
  } catch (err) {
    console.error(`Failed to look up user ${uid}:`, err);
    return null;
  }
}

// ========== SUBMISSIONS ==========

exports.onSubmissionStatusChange = functions.firestore
  .document("submissions/{id}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== "pending") return;
    if (after.status !== "approved" && after.status !== "rejected") return;

    const email = after.submitterEmail || await getEmailFromUid(after.creatorUid);
    if (!email) {
      console.log("No recipient email for submission", change.after.id);
      return;
    }

    const name = after.name || "a PI";
    const approved = after.status === "approved";

    await sendEmail(
      email,
      approved
        ? `Your PI submission for ${name} has been approved`
        : `Your PI submission for ${name} was not approved`,
      approved
        ? `<p>Good news! Your PI submission for <strong>${name}</strong> has been approved and is now listed on Neuroscience in Paris.</p>`
        : `<p>Your PI submission for <strong>${name}</strong> was not approved. If you believe this is an error, you can contact us through the website.</p>`,
    );
  });

// ========== CLAIMS ==========

exports.onClaimStatusChange = functions.firestore
  .document("claims/{id}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== "pending") return;
    if (after.status !== "approved" && after.status !== "rejected") return;

    const email = after.claimantEmail;
    if (!email) {
      console.log("No recipient email for claim", change.after.id);
      return;
    }

    const targetName = after.targetName || "a PI profile";
    const approved = after.status === "approved";

    await sendEmail(
      email,
      approved
        ? `Your claim for ${targetName} has been approved`
        : `Your claim for ${targetName} was not approved`,
      approved
        ? `<p>Your claim for <strong>${targetName}</strong> has been approved. You now have ownership of this profile on Neuroscience in Paris.</p>`
        : `<p>Your claim for <strong>${targetName}</strong> was not approved. If you believe this is an error, you can contact us through the website.</p>`,
    );
  });

// ========== INSTITUTES ==========

exports.onInstituteStatusChange = functions.firestore
  .document("institutes/{id}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== "pending") return;
    if (after.status !== "approved" && after.status !== "rejected") return;

    const email = await getEmailFromUid(after.proposedBy);
    if (!email) {
      console.log("No recipient email for institute", change.after.id);
      return;
    }

    const name = after.name || "an institution";
    const approved = after.status === "approved";

    await sendEmail(
      email,
      approved
        ? `Your institution ${name} has been approved`
        : `Your institution ${name} was not approved`,
      approved
        ? `<p>Your proposed institution <strong>${name}</strong> has been approved and is now available on Neuroscience in Paris.</p>`
        : `<p>Your proposed institution <strong>${name}</strong> was not approved. If you believe this is an error, you can contact us through the website.</p>`,
    );
  });

// ========== REPORTS ==========

exports.onReportStatusChange = functions.firestore
  .document("reports/{id}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== "open") return;
    if (after.status !== "resolved") return;

    const email = after.reporterEmail;
    if (!email) {
      console.log("No reporter email for report", change.after.id, "(anonymous)");
      return;
    }

    const targetName = after.targetName || "a listing";

    await sendEmail(
      email,
      `Your report on ${targetName} has been reviewed`,
      `<p>Your report regarding <strong>${targetName}</strong> has been reviewed by our team. Thank you for helping us maintain accurate listings on Neuroscience in Paris.</p>`,
    );
  });
