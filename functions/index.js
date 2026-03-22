const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { createAuthService } = require("./auth-service");
const { createClaimService } = require("./claim-service");
const { createEmailService } = require("./email-service");
const { planGroupClaimChange } = require("./group-claim-logic");
const {
  getDefaultStorageBucketName,
  migrateSingleProfileImage,
} = require("./profile-image-migration");

const storageBucket = getDefaultStorageBucketName(
  process.env.GCLOUD_PROJECT || "",
  process.env.STORAGE_BUCKET || "",
);

admin.initializeApp({ storageBucket });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM = `Neuroscience in Paris <${process.env.EMAIL_USER}>`;
const SITE_URL = "https://jmourabarbosa.github.io/compneuroparis";
const ADMIN_LINK = `<p><a href="${SITE_URL}/#admin">Open admin panel</a></p>`;
const NOTIFY_EMAIL = "neuroinparis@gmail.com";

const { getAdminEmails, getEmailFromUid, isCallerAdmin } = createAuthService({ admin });
const { sendEmail, notifyAdmins } = createEmailService({
  transporter,
  from: FROM,
  notifyEmail: NOTIFY_EMAIL,
  adminLink: ADMIN_LINK,
  getAdminEmails,
});
const { reconcileClaimsForTarget } = createClaimService({ admin });

// ========== SUBMISSIONS ==========

exports.onSubmissionCreated = functions.firestore
  .document("submissions/{id}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const name = data.name || "a PI";

    // Notify submitter
    const email = data.submitterEmail || await getEmailFromUid(data.creatorUid);
    if (email) {
      await sendEmail(
        email,
        `We received your PI submission for ${name}`,
        `<p>Thank you for submitting <strong>${name}</strong> to Neuroscience in Paris.</p>
         <p>Our team will review your submission and you'll receive an email once a decision is made.</p>`,
      );
    }

    // Notify admins
    await notifyAdmins(
      `New PI submission: ${name}`,
      `<p>A new PI submission for <strong>${name}</strong> needs review.</p>`,
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
    const targetName = data.targetName || "a PI profile";

    // Notify claimant
    const email = data.claimantEmail;
    if (email) {
      await sendEmail(
        email,
        `We received your claim for ${targetName}`,
        `<p>Thank you for submitting your claim for <strong>${targetName}</strong> on Neuroscience in Paris.</p>
         <p>Our team will review your claim and you'll receive an email once a decision is made.</p>`,
      );
    }

    // Notify admins
    await notifyAdmins(
      `New claim: ${targetName}`,
      `<p>A new claim for <strong>${targetName}</strong> needs review.</p>`,
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

    const name = data.name || "an institution";

    // Notify proposer
    const email = await getEmailFromUid(data.proposedBy);
    if (email) {
      await sendEmail(
        email,
        `We received your institution proposal for ${name}`,
        `<p>Thank you for proposing <strong>${name}</strong> to Neuroscience in Paris.</p>
         <p>Our team will review your proposal and you'll receive an email once a decision is made.</p>`,
      );
    }

    // Notify admins
    await notifyAdmins(
      `New institute proposal: ${name}`,
      `<p>A new institution proposal for <strong>${name}</strong> needs review.</p>`,
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
    const targetName = data.targetName || "a listing";

    // Notify reporter (skip if anonymous)
    if (data.reporterEmail) {
      await sendEmail(
        data.reporterEmail,
        `We received your report on ${targetName}`,
        `<p>Thank you for reporting an issue with <strong>${targetName}</strong> on Neuroscience in Paris.</p>
         <p>Our team will review your report and take appropriate action.</p>`,
      );
    }

    // Notify admins
    await notifyAdmins(
      `New report: ${targetName}`,
      `<p>A new report on <strong>${targetName}</strong> needs review.</p>`,
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

    // Notify sender
    if (data.email) {
      await sendEmail(
        data.email,
        "We received your message",
        `<p>Thank you for contacting Neuroscience in Paris.</p>
         <p>Our team will review your message and respond if needed.</p>`,
      );
    }

    // Notify admins
    await notifyAdmins(
      "New contact message",
      `<p>A new contact message needs review.</p>`,
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

// ========== PROFILE CHANGE ALERTS ==========

exports.onGroupUpdate = functions.firestore
  .document("groups/{id}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only proceed if lastEditedBy actually changed (skip system updates like claim approvals)
    if ((before.lastEditedBy || null) === (after.lastEditedBy || null)) return;

    const editorUid = after.lastEditedBy;
    if (!editorUid) return;

    // Skip if editor is an admin
    if (await isCallerAdmin(editorUid)) return;

    // Build a summary of what changed
    const name = after.name || "a PI";
    const changes = [];
    if (before.name !== after.name) changes.push("name");
    if (before.summary !== after.summary) changes.push("summary");
    if (before.photoURL !== after.photoURL) changes.push("photo");
    if (JSON.stringify(before.keywords) !== JSON.stringify(after.keywords)) changes.push("keywords");
    if (JSON.stringify(before.links) !== JSON.stringify(after.links)) changes.push("links");
    if (JSON.stringify(before.subfields) !== JSON.stringify(after.subfields)) changes.push("subfields");
    if (JSON.stringify(before.institutes) !== JSON.stringify(after.institutes)) changes.push("institutes");
    if (before.hiring !== after.hiring) changes.push("hiring status");

    const changedFields = changes.length > 0 ? changes.join(", ") : "profile fields";

    // Send to NOTIFY_EMAIL + any configured extra email
    const recipients = new Set([NOTIFY_EMAIL]);
    const settingsSnap = await admin.firestore().collection("settings").doc("notifications").get();
    if (settingsSnap.exists && settingsSnap.data().profileChangeEmail) {
      recipients.add(settingsSnap.data().profileChangeEmail);
    }
    for (const email of recipients) {
      await sendEmail(
        email,
        `Profile edited by user: ${name}`,
        `<p>A non-admin user has edited the profile for <strong>${name}</strong>.</p>
         <p><strong>Changed:</strong> ${changedFields}</p>` + ADMIN_LINK,
      );
    }
  });

// ========== ACCOUNT CREATION ==========

exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  const email = user.email || "(no email)";
  await notifyAdmins(
    `New account created: ${email}`,
    `<p>A new user account has been created on Neuroscience in Paris.</p>
     <p><strong>Email:</strong> ${email}</p>`,
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
      emailVerified: u.emailVerified,
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
        emailVerified: u.emailVerified,
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
      claimedByName: admin.firestore.FieldValue.delete(),
    });
  }

  // Remove claimedBy from institutes claimed by this user
  const instSnap = await firestore.collection("institutes").where("claimedBy", "==", uid).get();
  for (const doc of instSnap.docs) {
    await doc.ref.update({
      claimedBy: admin.firestore.FieldValue.delete(),
      claimedByEmail: admin.firestore.FieldValue.delete(),
      claimedByName: admin.firestore.FieldValue.delete(),
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

  // Grab email before deleting, so we can notify
  const userToDelete = await admin.auth().getUser(uid);
  const deletedEmail = userToDelete.email;

  // Delete from Firebase Auth
  await admin.auth().deleteUser(uid);

  // Notify the user
  if (deletedEmail) {
    await sendEmail(
      deletedEmail,
      "Your account on Neuroscience in Paris has been removed",
      `<p>Your account on Neuroscience in Paris has been removed by an administrator.</p>
       <p>Any profile claims associated with your account have been revoked.</p>
       <p>If you believe this is an error, please contact us through the website.</p>`,
    );
  }

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

  // If email or display name changed, update claim metadata on groups/institutes
  if (updatePayload.email || updatePayload.displayName !== undefined) {
    const firestore = admin.firestore();
    const nextClaimedByName = displayName || "";

    const groupsSnap = await firestore.collection("groups").where("claimedBy", "==", uid).get();
    for (const doc of groupsSnap.docs) {
      const claimUpdate = {};
      if (updatePayload.email) claimUpdate.claimedByEmail = email;
      if (updatePayload.displayName !== undefined) claimUpdate.claimedByName = nextClaimedByName;
      await doc.ref.update(claimUpdate);
    }

    const instSnap = await firestore.collection("institutes").where("claimedBy", "==", uid).get();
    for (const doc of instSnap.docs) {
      const claimUpdate = {};
      if (updatePayload.email) claimUpdate.claimedByEmail = email;
      if (updatePayload.displayName !== undefined) claimUpdate.claimedByName = nextClaimedByName;
      await doc.ref.update(claimUpdate);
    }

    if (updatePayload.email) {
      const adminDoc = await firestore.collection("admins").doc(uid).get();
      if (adminDoc.exists) {
        await adminDoc.ref.update({ email });
      }
    }
  }

  // Notify the user about profile changes
  const changes = [];
  if (updatePayload.email) changes.push(`email changed to <strong>${email}</strong>`);
  if (updatePayload.displayName !== undefined) changes.push(`display name changed to <strong>${displayName || "(empty)"}</strong>`);

  if (changes.length > 0) {
    const notifyEmail = oldUser.email;
    if (notifyEmail) {
      await sendEmail(
        notifyEmail,
        "Your account on Neuroscience in Paris has been updated",
        `<p>An administrator has made the following changes to your account:</p>
         <ul>${changes.map((c) => `<li>${c}</li>`).join("")}</ul>
         <p>If you did not expect this, please contact us through the website.</p>`,
      );
    }
  }

  return { success: true };
});

// ========== CALLABLE: VERIFY USER ==========

exports.verifyUser = functions.https.onCall(async (data, context) => {
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

  const userToVerify = await admin.auth().getUser(uid);
  await admin.auth().updateUser(uid, { emailVerified: true });

  if (userToVerify.email) {
    await sendEmail(
      userToVerify.email,
      "Your email has been verified on Neuroscience in Paris",
      `<p>An administrator has manually verified your email on Neuroscience in Paris. You now have full access to the platform.</p>`,
    );
  }

  return { success: true };
});

// ========== CALLABLE: SET GROUP CLAIM ==========

exports.setGroupClaim = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
  }
  if (!(await isCallerAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }

  const { groupId, claimantUid = null } = data || {};
  if (!groupId) {
    throw new functions.https.HttpsError("invalid-argument", "groupId is required.");
  }

  const firestore = admin.firestore();
  const groupRef = firestore.collection("groups").doc(groupId);
  const groupSnap = await groupRef.get();
  if (!groupSnap.exists) {
    throw new functions.https.HttpsError("not-found", "PI page not found.");
  }

  const group = groupSnap.data();
  let claimantUser = null;

  if (claimantUid) {
    try {
      claimantUser = await admin.auth().getUser(claimantUid);
    } catch (err) {
      throw new functions.https.HttpsError("invalid-argument", "Assigned account was not found.");
    }
    if (!claimantUser.email) {
      throw new functions.https.HttpsError("invalid-argument", "Assigned account must have an email.");
    }
  }

  const { promotedPendingClaim } = await reconcileClaimsForTarget(groupId, claimantUser?.uid || null);
  const claimPlan = planGroupClaimChange(group, claimantUser, promotedPendingClaim);

  if (claimPlan.mode === "assign") {
    await groupRef.update({
      claimedBy: claimPlan.nextClaimedBy,
      claimedByEmail: claimPlan.nextClaimedByEmail,
      claimedByName: claimantUser?.displayName || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await groupRef.update({
      claimedBy: admin.firestore.FieldValue.delete(),
      claimedByEmail: admin.firestore.FieldValue.delete(),
      claimedByName: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  if (claimPlan.shouldNotifyClaimant) {
    await sendEmail(
      claimPlan.nextClaimedByEmail,
      claimPlan.emailSubject,
      claimPlan.emailHtml,
    );
  }

  return {
    success: true,
    claimedBy: claimPlan.nextClaimedBy,
    claimedByEmail: claimPlan.nextClaimedByEmail,
    claimedByName: claimantUser?.displayName || "",
  };
});

// ========== CALLABLE: MIGRATE PROFILE IMAGES ==========

exports.migrateProfileImages = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
  }
  if (!(await isCallerAdmin(context.auth.uid))) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }

  const bucketName = getDefaultStorageBucketName(
    process.env.GCLOUD_PROJECT || "",
    process.env.STORAGE_BUCKET || storageBucket,
  );
  if (!bucketName) {
    throw new functions.https.HttpsError("internal", "Storage bucket is not configured.");
  }

  const firestore = admin.firestore();
  const bucket = admin.storage().bucket(bucketName);
  const groupsSnap = await firestore.collection("groups").orderBy("name").get();

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const results = [];

  for (const groupDoc of groupsSnap.docs) {
    try {
      const result = await migrateSingleProfileImage({
        groupDoc,
        bucket,
        bucketName,
        firestoreFieldValue: admin.firestore.FieldValue,
      });
      results.push(result);
      if (result.status === "migrated") migrated += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      const group = groupDoc.data() || {};
      results.push({
        status: "failed",
        groupId: groupDoc.id,
        name: group.name || "",
        currentPhotoURL: group.photoURL || "",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    success: true,
    bucketName,
    migrated,
    skipped,
    failed,
    total: groupsSnap.size,
    results,
  };
  });
