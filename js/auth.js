import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, sendPasswordResetEmail,
  sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import { auth } from './firebase-config.js';
import { isAdmin, addAdmin } from './db.js';

let currentUser = null;
let currentIsAdmin = false;
let authReadyResolve;
export const authReady = new Promise(resolve => { authReadyResolve = resolve; });

export function getCurrentUser() {
  return currentUser;
}

export function getIsAdmin() {
  return currentIsAdmin;
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function createAccount(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user);
  return cred.user;
}

export async function resendVerification() {
  if (auth.currentUser && !auth.currentUser.emailVerified) {
    await sendEmailVerification(auth.currentUser);
  }
}

export function isEmailVerified() {
  return auth.currentUser?.emailVerified ?? false;
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await signOut(auth);
}

export async function createAdminUser(email, password, addedByUid) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await addAdmin(cred.user.uid, email, addedByUid);
  return cred.user;
}

export function onAuthChange(callback) {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      currentIsAdmin = await isAdmin(user.uid);
    } else {
      currentIsAdmin = false;
    }
    callback(user, currentIsAdmin);
    authReadyResolve();
  });
}
