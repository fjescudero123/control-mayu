// --- @mayu/hooks — shared React hooks for MAYU ERP apps ---

// Init — call once in main.jsx/tsx before ReactDOM.createRoot
export { initMayuHooks } from './_services';
export type { MayuHooksServices } from './_services';

// Hooks
export { useNotification } from './useNotification';
export { useFirestoreCollection } from './useFirestoreCollection';
export { useFirestoreCollectionOnce } from './useFirestoreCollectionOnce';
export { useStorageUpload } from './useStorageUpload';
export { useAuth } from './useAuth';

// Types
export type { Toast } from './useNotification';
export type { UseFirestoreCollectionOptions, UseFirestoreCollectionResult } from './useFirestoreCollection';
export type { UseFirestoreCollectionOnceOptions, UseFirestoreCollectionOnceResult } from './useFirestoreCollectionOnce';
export type { UploadResult, UploadOptions, UseStorageUploadResult } from './useStorageUpload';
export type { UseAuthResult } from './useAuth';
