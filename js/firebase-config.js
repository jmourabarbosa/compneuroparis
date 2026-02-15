import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCEUSVBEAPYfsoG00GKPqw_lHJQKelgVbk",
  authDomain: "compneuroparis.firebaseapp.com",
  projectId: "compneuroparis",
  storageBucket: "compneuroparis.firebasestorage.app",
  messagingSenderId: "768335946036",
  appId: "1:768335946036:web:61184dde3b4b66c58bc561"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
