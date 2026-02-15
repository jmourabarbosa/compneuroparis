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

