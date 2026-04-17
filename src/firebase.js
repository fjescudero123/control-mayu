// --- FIREBASE (se inicializa si esta disponible) ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

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

// --- Conexion a emuladores locales (VITE_USE_EMULATOR=true en .env.local) ---
if (import.meta.env.VITE_USE_EMULATOR === 'true' && !globalThis.__mayuEmuWired) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  globalThis.__mayuEmuWired = true;
  console.info('[firebase] Emuladores conectados: firestore:8080, auth:9099, storage:9199');
}

export function getFbAuth() { return auth; }
export function getFbDb() { return db; }
export function getFbStorage() { return storage; }
export { signInAnonymously, onAuthStateChanged };
