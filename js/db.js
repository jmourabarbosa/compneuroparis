import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, serverTimestamp, setDoc, deleteField
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';
import { db } from './firebase-config.js';

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
  const src = overrideData || data;

  // Normalize array helper
  const toArr = v => Array.isArray(v) ? v : (v ? [v] : []);

  // Resolve subfields/institutes from override or original data
  const subfields = toArr(src.subfields || src.subfield || data.subfields || data.subfield || ['computational']);
  const institutes = toArr(src.institutes || src.institute || data.institutes || data.institute);

  // Create group from submission (use overrideData if provided, always copy creatorUid)
  await createGroup({
    name: src.name,
    keywords: src.keywords || [],
    summary: src.summary || '',
    links: src.links || [],
    photoURL: src.photoURL || '',
    // New array fields
    subfields,
    institutes,
    // Backward compat single-value fields
    subfield: subfields[0] || 'computational',
    institute: institutes[0] || '',
    ...(data.creatorUid ? { creatorUid: data.creatorUid } : {})
  });

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
  await updateDoc(doc(db, 'institutes', id), {
    ...data,
    updatedAt: serverTimestamp()
  });
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
  await deleteDoc(doc(db, 'institutes', id));
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

