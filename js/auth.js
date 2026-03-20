import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, sendPasswordResetEmail,
  sendEmailVerification, setPersistence,
  browserLocalPersistence, browserSessionPersistence
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

async function applyAuthPersistence(rememberMe = false) {
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
}

export async function login(email, password, { rememberMe = false } = {}) {
  await applyAuthPersistence(rememberMe);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function createAccount(email, password, { rememberMe = false } = {}) {
  await applyAuthPersistence(rememberMe);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user);
  return cred.user;
}

export function getAuthErrorMessage(err, fallback = 'Authentication failed.') {
  switch (err?.code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please log in instead, or use password reset if you no longer know the password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'That email/password combination was not recognized. Try logging in again or reset your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a bit and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return err?.message || fallback;
  }
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
