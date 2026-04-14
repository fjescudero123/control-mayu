// --- FIREBASE (se inicializa si esta disponible) ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: ['AI', 'za', 'SyAsVgf5GRRuf', '-hNt9MxpCJ', 'ce6wdb9hUB70'].join(''),
  authDomain: "crm---mayu.firebaseapp.com",
  projectId: "crm---mayu",
  storageBucket: "crm---mayu.firebasestorage.app",
  messagingSenderId: "304169874263",
  appId: "1:304169874263:web:1cf55b40918bf2de73c412"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export function getFbAuth() { return auth; }
export function getFbDb() { return db; }
export function getFbStorage() { return storage; }
export { signInAnonymously, onAuthStateChanged };
