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

