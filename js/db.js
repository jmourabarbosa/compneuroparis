import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc,
  query, where, orderBy, serverTimestamp, setDoc
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';
import { db } from './firebase-config.js';

// ========== GROUPS ==========

export async function fetchGroups() {
  const q = query(collection(db, 'groups'), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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

  // Create group from submission (use overrideData if provided, always copy creatorUid)
  await createGroup({
    name: src.name,
    keywords: src.keywords || [],
    summary: src.summary || '',
    links: src.links || [],
    photoURL: src.photoURL || '',
    subfield: src.subfield || data.subfield || 'computational',
    institute: src.institute || data.institute || '',
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

export async function createInstitute(name, proposedByUid, { website = '', autoApprove = false } = {}) {
  const docRef = await addDoc(collection(db, 'institutes'), {
    name,
    status: autoApprove ? 'approved' : 'pending',
    proposedBy: proposedByUid,
    website,
    createdAt: serverTimestamp()
  });
  return docRef.id;
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

export async function createClaim({ piId, piName, claimantUid, claimantEmail }) {
  const docRef = await addDoc(collection(db, 'claims'), {
    piId,
    piName,
    claimantUid,
    claimantEmail,
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

  // Set claimedBy on the PI (group) doc
  await updateDoc(doc(db, 'groups', claim.piId), {
    claimedBy: claim.claimantUid,
    updatedAt: serverTimestamp()
  });

  // Mark this claim as approved
  await updateDoc(claimDoc, {
    status: 'approved',
    reviewedAt: serverTimestamp()
  });

  // Auto-reject other pending claims for the same PI
  const othersQ = query(
    collection(db, 'claims'),
    where('piId', '==', claim.piId),
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

export async function fetchMyClaimForPi(uid, piId) {
  const q = query(
    collection(db, 'claims'),
    where('claimantUid', '==', uid),
    where('piId', '==', piId),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.length > 0 ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } : null;
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

