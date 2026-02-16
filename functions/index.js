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

async function isCallerAdmin(uid) {
  const snap = await admin.firestore().collection("admins").doc(uid).get();
  return snap.exists;
}

// ========== AUTH: VERIFICATION EMAIL ==========

exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  if (!user.email) return;

  try {
    const link = await admin.auth().generateEmailVerificationLink(user.email);
    await sendEmail(
      user.email,
      "Verify your email for Neuroscience in Paris",
      `<p>Welcome to Neuroscience in Paris!</p>
       <p>Please verify your email address by clicking the link below:</p>
       <p><a href="${link}">Verify my email</a></p>
       <p>If you didn't create this account, you can ignore this email.</p>`,
    );
  } catch (err) {
    console.error("Failed to send verification email:", err);
  }
});

// ========== SUBMISSIONS ==========

exports.onSubmissionCreated = functions.firestore
  .document("submissions/{id}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const email = data.submitterEmail || await getEmailFromUid(data.creatorUid);
    if (!email) return;

    const name = data.name || "a PI";
    await sendEmail(
      email,
      `We received your PI submission for ${name}`,
      `<p>Thank you for submitting <strong>${name}</strong> to Neuroscience in Paris.</p>
       <p>Our team will review your submission and you'll receive an email once a decision is made.</p>`,
    );
  });

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

exports.onClaimCreated = functions.firestore
  .document("claims/{id}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const email = data.claimantEmail;
    if (!email) return;

    const targetName = data.targetName || "a PI profile";
    await sendEmail(
      email,
      `We received your claim for ${targetName}`,
      `<p>Thank you for submitting your claim for <strong>${targetName}</strong> on Neuroscience in Paris.</p>
       <p>Our team will review your claim and you'll receive an email once a decision is made.</p>`,
    );
  });

exports.onClaimStatusChange = functions.firestore
  .document("claims/{id}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === after.status) return;

    const email = after.claimantEmail;
    if (!email) {
      console.log("No recipient email for claim", change.after.id);
      return;
    }

    const targetName = after.targetName || "a PI profile";

    if (before.status === "pending" && after.status === "approved") {
      await sendEmail(
        email,
        `Your claim for ${targetName} has been approved`,
        `<p>Your claim for <strong>${targetName}</strong> has been approved. You now have ownership of this profile on Neuroscience in Paris.</p>`,
      );
    } else if (before.status === "pending" && after.status === "rejected") {
      await sendEmail(
        email,
        `Your claim for ${targetName} was not approved`,
        `<p>Your claim for <strong>${targetName}</strong> was not approved. If you believe this is an error, you can contact us through the website.</p>`,
      );
    } else if (before.status === "approved" && after.status === "revoked") {
      await sendEmail(
        email,
        `Your claim for ${targetName} has been revoked`,
        `<p>Your claim for <strong>${targetName}</strong> has been revoked by an administrator. If you believe this is an error, you can contact us through the website.</p>`,
      );
    }
  });

// ========== INSTITUTES ==========

exports.onInstituteCreated = functions.firestore
  .document("institutes/{id}")
  .onCreate(async (snap) => {
    const data = snap.data();
    // Skip if auto-approved (no confirmation needed for instant approvals)
    if (data.status === "approved") return;

    const email = await getEmailFromUid(data.proposedBy);
    if (!email) return;

    const name = data.name || "an institution";
    await sendEmail(
      email,
      `We received your institution proposal for ${name}`,
      `<p>Thank you for proposing <strong>${name}</strong> to Neuroscience in Paris.</p>
       <p>Our team will review your proposal and you'll receive an email once a decision is made.</p>`,
    );
  });

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

exports.onReportCreated = functions.firestore
  .document("reports/{id}")
  .onCreate(async (snap) => {
    const data = snap.data();
    // Skip if anonymous
    if (!data.reporterEmail) return;

    const targetName = data.targetName || "a listing";
    await sendEmail(
      data.reporterEmail,
      `We received your report on ${targetName}`,
      `<p>Thank you for reporting an issue with <strong>${targetName}</strong> on Neuroscience in Paris.</p>
       <p>Our team will review your report and take appropriate action.</p>`,
    );
  });

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

// ========== MESSAGES ==========

exports.onMessageCreated = functions.firestore
  .document("messages/{id}")
  .onCreate(async (snap) => {
    const data = snap.data();
    if (!data.email) return;

    await sendEmail(
      data.email,
      "We received your message",
      `<p>Thank you for contacting Neuroscience in Paris.</p>
       <p>Our team will review your message and respond if needed.</p>`,
    );
  });

exports.onMessageStatusChange = functions.firestore
  .document("messages/{id}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== "open") return;
    if (after.status !== "resolved") return;

    const email = after.email;
    if (!email) return;

    await sendEmail(
      email,
      "Your message has been reviewed",
      `<p>Your message to Neuroscience in Paris has been reviewed by our team. Thank you for reaching out.</p>`,
    );
  });

// ========== CALLABLE: LIST USERS ==========

exports.listUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
  }
  if (!(await isCallerAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }

  const users = [];
  let result = await admin.auth().listUsers(1000);
  result.users.forEach((u) => {
    users.push({
      uid: u.uid,
      email: u.email || "",
      displayName: u.displayName || "",
      createdAt: u.metadata.creationTime || "",
      disabled: u.disabled,
    });
  });

  while (result.pageToken) {
    result = await admin.auth().listUsers(1000, result.pageToken);
    result.users.forEach((u) => {
      users.push({
        uid: u.uid,
        email: u.email || "",
        displayName: u.displayName || "",
        createdAt: u.metadata.creationTime || "",
        disabled: u.disabled,
      });
    });
  }

  return { users };
});

// ========== CALLABLE: DELETE USER ==========

exports.deleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
  }
  if (!(await isCallerAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }

  const uid = data.uid;
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "uid is required.");
  }

  const firestore = admin.firestore();

  // Remove claimedBy from groups claimed by this user
  const groupsSnap = await firestore.collection("groups").where("claimedBy", "==", uid).get();
  for (const doc of groupsSnap.docs) {
    await doc.ref.update({
      claimedBy: admin.firestore.FieldValue.delete(),
      claimedByEmail: admin.firestore.FieldValue.delete(),
    });
  }

  // Remove claimedBy from institutes claimed by this user
  const instSnap = await firestore.collection("institutes").where("claimedBy", "==", uid).get();
  for (const doc of instSnap.docs) {
    await doc.ref.update({
      claimedBy: admin.firestore.FieldValue.delete(),
      claimedByEmail: admin.firestore.FieldValue.delete(),
    });
  }

  // Revoke approved claims for this user
  const claimsSnap = await firestore.collection("claims")
    .where("claimantUid", "==", uid)
    .where("status", "==", "approved")
    .get();
  for (const doc of claimsSnap.docs) {
    await doc.ref.update({ status: "revoked", revokedAt: admin.firestore.FieldValue.serverTimestamp() });
  }

  // Delete from admins collection if exists
  await firestore.collection("admins").doc(uid).delete();

  // Delete from Firebase Auth
  await admin.auth().deleteUser(uid);

  return { success: true };
});

// ========== CALLABLE: UPDATE USER ==========

exports.updateUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
  }
  if (!(await isCallerAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }

  const { uid, email, displayName } = data;
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "uid is required.");
  }

  // Get old user data to check if email changed
  const oldUser = await admin.auth().getUser(uid);
  const updatePayload = {};
  if (email && email !== oldUser.email) updatePayload.email = email;
  if (displayName !== undefined) updatePayload.displayName = displayName;

  if (Object.keys(updatePayload).length > 0) {
    await admin.auth().updateUser(uid, updatePayload);
  }

  // If email changed, update claimedByEmail on groups/institutes
  if (updatePayload.email) {
    const firestore = admin.firestore();

    const groupsSnap = await firestore.collection("groups").where("claimedBy", "==", uid).get();
    for (const doc of groupsSnap.docs) {
      await doc.ref.update({ claimedByEmail: email });
    }

    const instSnap = await firestore.collection("institutes").where("claimedBy", "==", uid).get();
    for (const doc of instSnap.docs) {
      await doc.ref.update({ claimedByEmail: email });
    }

    // Update email in admins collection if exists
    const adminDoc = await firestore.collection("admins").doc(uid).get();
    if (adminDoc.exists) {
      await adminDoc.ref.update({ email });
    }
  }

  return { success: true };
});
