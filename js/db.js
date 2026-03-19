import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, serverTimestamp, setDoc, deleteField
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-functions.js';
import { db } from './firebase-config.js';
import { buildApprovedGroupData } from './ownership-utils.mjs';

const functions = getFunctions();

// ========== GROUPS ==========

export async function fetchGroups() {
  const q = query(collection(db, 'groups'), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchGroupById(id) {
  const snap = await getDoc(doc(db, 'groups', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchInstituteById(id) {
  const snap = await getDoc(doc(db, 'institutes', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createGroup(data) {
  const docRef = await addDoc(collection(db, 'groups'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

export async function updateGroup(id, data) {
  await updateDoc(doc(db, 'groups', id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteGroup(id) {
  await deleteDoc(doc(db, 'groups', id));
}

// ========== SUBMISSIONS ==========

export async function createSubmission(data) {
  const docRef = await addDoc(collection(db, 'submissions'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function fetchPendingSubmissions() {
  const q = query(
    collection(db, 'submissions'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveSubmission(submissionId, adminUid, overrideData = null) {
  const subDoc = doc(db, 'submissions', submissionId);
  const subSnap = await getDoc(subDoc);
  if (!subSnap.exists()) throw new Error('Submission not found');

  const data = subSnap.data();
  await createGroup(buildApprovedGroupData(data, overrideData));

  // Mark submission as approved
  await updateDoc(subDoc, {
    status: 'approved',
    reviewedBy: adminUid,
    reviewedAt: serverTimestamp()
  });
}

export async function fetchGroupsByCreator(uid) {
  const q = query(collection(db, 'groups'), where('creatorUid', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function rejectSubmission(submissionId, adminUid) {
  await updateDoc(doc(db, 'submissions', submissionId), {
    status: 'rejected',
    reviewedBy: adminUid,
    reviewedAt: serverTimestamp()
  });
}

// ========== INSTITUTES ==========

export async function fetchApprovedInstitutes() {
  const q = query(
    collection(db, 'institutes'),
    where('status', '==', 'approved'),
    orderBy('name')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchPendingInstitutes() {
  const q = query(
    collection(db, 'institutes'),
    where('status', '==', 'pending'),
    orderBy('name')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createInstitute(name, proposedByUid, { website = '', summary = '', keywords = [], links = [], logoURL = '', autoApprove = false } = {}) {
  const docRef = await addDoc(collection(db, 'institutes'), {
    name,
    status: autoApprove ? 'approved' : 'pending',
    proposedBy: proposedByUid,
    website,
    summary,
    keywords,
    links,
    logoURL,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function updateInstitute(id, data) {
  const instituteRef = doc(db, 'institutes', id);
  const instituteSnap = await getDoc(instituteRef);
  if (!instituteSnap.exists()) throw new Error('Institute not found');

  const existingInstitute = instituteSnap.data();
  const previousName = existingInstitute.name || '';
  const nextName = data.name || previousName;

  await updateDoc(instituteRef, {
    ...data,
    updatedAt: serverTimestamp()
  });

  if (previousName && nextName && previousName !== nextName) {
    const groupsSnap = await getDocs(collection(db, 'groups'));
    const updates = groupsSnap.docs
      .filter(groupDoc => {
        const groupData = groupDoc.data();
        const institutes = Array.isArray(groupData.institutes)
          ? groupData.institutes
          : (groupData.institute ? [groupData.institute] : []);
        return institutes.includes(previousName);
      })
      .map(groupDoc => {
        const groupData = groupDoc.data();
        const institutes = Array.isArray(groupData.institutes)
          ? groupData.institutes.map(name => (name === previousName ? nextName : name))
          : [];
        const updateData = {
          institutes,
          updatedAt: serverTimestamp()
        };
        if ((groupData.institute || '') === previousName) {
          updateData.institute = nextName;
        }
        return updateDoc(groupDoc.ref, updateData);
      });

    await Promise.all(updates);
  }
}

export async function deleteInstitute(id) {
  await deleteDoc(doc(db, 'institutes', id));
}

export async function fetchAllInstitutes() {
  const q = query(collection(db, 'institutes'), where('status', '==', 'approved'), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveInstitute(id) {
  await updateDoc(doc(db, 'institutes', id), {
    status: 'approved'
  });
}

export async function rejectInstitute(id) {
  await updateDoc(doc(db, 'institutes', id), {
    status: 'rejected'
  });
}

// ========== CLAIMS ==========

export async function createClaim({ targetId, targetName, type = 'pi', claimantUid, claimantEmail, justification }) {
  const docRef = await addDoc(collection(db, 'claims'), {
    targetId,
    targetName,
    type,
    // Backward compat fields
    piId: targetId,
    piName: targetName,
    claimantUid,
    claimantEmail,
    justification: justification || '',
    status: 'pending',
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function fetchPendingClaims() {
  const q = query(
    collection(db, 'claims'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveClaim(claimId) {
  const claimDoc = doc(db, 'claims', claimId);
  const claimSnap = await getDoc(claimDoc);
  if (!claimSnap.exists()) throw new Error('Claim not found');

  const claim = claimSnap.data();
  const targetId = claim.targetId || claim.piId;
  const targetCollection = claim.type === 'institute' ? 'institutes' : 'groups';

  // Set claimedBy on the target doc
  await updateDoc(doc(db, targetCollection, targetId), {
    claimedBy: claim.claimantUid,
    claimedByEmail: claim.claimantEmail || '',
    updatedAt: serverTimestamp()
  });

  // Mark this claim as approved
  await updateDoc(claimDoc, {
    status: 'approved',
    reviewedAt: serverTimestamp()
  });

  // Auto-reject other pending claims for the same target
  const othersQ = query(
    collection(db, 'claims'),
    where('targetId', '==', targetId),
    where('status', '==', 'pending')
  );
  const othersSnap = await getDocs(othersQ);
  for (const d of othersSnap.docs) {
    if (d.id !== claimId) {
      await updateDoc(d.ref, {
        status: 'rejected',
        reviewedAt: serverTimestamp()
      });
    }
  }
}

export async function rejectClaim(claimId) {
  await updateDoc(doc(db, 'claims', claimId), {
    status: 'rejected',
    reviewedAt: serverTimestamp()
  });
}

export async function revokeClaim(targetId, type = 'pi') {
  const targetCollection = type === 'institute' ? 'institutes' : 'groups';

  // Remove claimedBy fields from the target document
  await updateDoc(doc(db, targetCollection, targetId), {
    claimedBy: deleteField(),
    claimedByEmail: deleteField(),
    updatedAt: serverTimestamp()
  });

  // Mark approved claim(s) as revoked
  const q = query(
    collection(db, 'claims'),
    where('targetId', '==', targetId),
    where('status', '==', 'approved')
  );
  const snapshot = await getDocs(q);
  for (const d of snapshot.docs) {
    await updateDoc(d.ref, {
      status: 'revoked',
      revokedAt: serverTimestamp()
    });
  }
}

export async function setGroupClaimAdmin(groupId, claimantUid = '') {
  const fn = httpsCallable(functions, 'setGroupClaim');
  const result = await fn({
    groupId,
    claimantUid: claimantUid || null
  });
  return result.data;
}

export async function fetchMyClaimForTarget(uid, targetId) {
  const q = query(
    collection(db, 'claims'),
    where('claimantUid', '==', uid),
    where('targetId', '==', targetId),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.length > 0 ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } : null;
}

export async function fetchApprovedClaimForTarget(targetId) {
  const q = query(
    collection(db, 'claims'),
    where('targetId', '==', targetId),
    where('status', '==', 'approved')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.length > 0 ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } : null;
}

// Backward compat alias
export const fetchMyClaimForPi = fetchMyClaimForTarget;

// ========== REPORTS ==========

export async function createReport({ targetId, targetName, type, reporterEmail, message }) {
  const docRef = await addDoc(collection(db, 'reports'), {
    targetId,
    targetName,
    type,
    reporterEmail: reporterEmail || '',
    message,
    status: 'open',
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function fetchOpenReports() {
  const q = query(
    collection(db, 'reports'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function resolveReport(reportId) {
  await updateDoc(doc(db, 'reports', reportId), {
    status: 'resolved',
    resolvedAt: serverTimestamp()
  });
}

// ========== ADMINS ==========

export async function fetchAdmins() {
  const snapshot = await getDocs(collection(db, 'admins'));
  return snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
}

export async function addAdmin(uid, email, addedBy) {
  await setDoc(doc(db, 'admins', uid), {
    email,
    addedBy,
    addedAt: serverTimestamp()
  });
}

export async function removeAdmin(uid) {
  await deleteDoc(doc(db, 'admins', uid));
}

export async function isAdmin(uid) {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}

// ========== CONTACT MESSAGES ==========

export async function createMessage({ email, message }) {
  const docRef = await addDoc(collection(db, 'messages'), {
    email: email || '',
    message,
    status: 'open',
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function fetchOpenMessages() {
  const q = query(
    collection(db, 'messages'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function resolveMessage(id) {
  await updateDoc(doc(db, 'messages', id), {
    status: 'resolved',
    resolvedAt: serverTimestamp()
  });
}

export async function fetchGroupsClaimedBy(uid) {
  const q = query(collection(db, 'groups'), where('claimedBy', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchInstitutesClaimedBy(uid) {
  const q = query(collection(db, 'institutes'), where('claimedBy', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ========== JOBS ==========

export async function createJob({ piId, piName, positionType, title, description, keywords, link, postedBy, postedByEmail }) {
  const docRef = await addDoc(collection(db, 'jobs'), {
    piId,
    piName,
    positionType,
    title,
    description: description || '',
    keywords: keywords || [],
    link,
    postedBy,
    postedByEmail,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function fetchJobs() {
  const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchJobsByPi(piId) {
  const q = query(collection(db, 'jobs'), where('piId', '==', piId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchJobsByPoster(uid) {
  const q = query(collection(db, 'jobs'), where('postedBy', '==', uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateJob(id, data) {
  await updateDoc(doc(db, 'jobs', id), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteJob(id) {
  await deleteDoc(doc(db, 'jobs', id));
}

// ========== SETTINGS ==========

export async function fetchNotificationSettings() {
  const snap = await getDoc(doc(db, 'settings', 'notifications'));
  return snap.exists() ? snap.data() : {};
}

export async function updateNotificationSettings(data) {
  await setDoc(doc(db, 'settings', 'notifications'), data, { merge: true });
}

// ========== USER MANAGEMENT (CALLABLE) ==========

export async function listAllUsers() {
  const fn = httpsCallable(functions, 'listUsers');
  const result = await fn();
  return result.data.users;
}

export async function deleteUserAccount(uid) {
  const fn = httpsCallable(functions, 'deleteUser');
  await fn({ uid });
}

export async function updateUserAccount(uid, data) {
  const fn = httpsCallable(functions, 'updateUser');
  await fn({ uid, ...data });
}

export async function verifyUserAccount(uid) {
  const fn = httpsCallable(functions, 'verifyUser');
  await fn({ uid });
}
