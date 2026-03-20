function createAuthService({ admin }) {
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

  async function getAdminEmails() {
    const snapshot = await admin.firestore().collection("admins").get();
    return snapshot.docs.map((doc) => doc.data().email).filter(Boolean);
  }

  return {
    getAdminEmails,
    getEmailFromUid,
    isCallerAdmin,
  };
}

module.exports = {
  createAuthService,
};
