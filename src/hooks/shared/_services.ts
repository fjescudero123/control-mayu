import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { Auth } from 'firebase/auth';

let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _auth: Auth | null = null;

export interface MayuHooksServices {
  db?: Firestore;
  storage?: FirebaseStorage;
  auth?: Auth;
}

/**
 * Call once in each app's main.jsx/tsx before ReactDOM.createRoot.
 * Only pass the services the app actually uses.
 */
export function initMayuHooks(services: MayuHooksServices): void {
  if (services.db) _db = services.db;
  if (services.storage) _storage = services.storage;
  if (services.auth) _auth = services.auth;
}

/** @internal */
export function _getDb(): Firestore {
  if (!_db) throw new Error('@mayu/hooks: call initMayuHooks({ db }) before using Firestore hooks');
  return _db;
}

/** @internal */
export function _getStorage(): FirebaseStorage {
  if (!_storage) throw new Error('@mayu/hooks: call initMayuHooks({ storage }) before using Storage hooks');
  return _storage;
}

/** @internal */
export function _getAuth(): Auth {
  if (!_auth) throw new Error('@mayu/hooks: call initMayuHooks({ auth }) before using Auth hooks');
  return _auth;
}
