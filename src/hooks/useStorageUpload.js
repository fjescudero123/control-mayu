import { useState } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFbStorage } from '../firebase';

/**
 * useStorageUpload — upload a file to Firebase Storage under a given basePath.
 *
 * Filename is generated as `{timestamp}_{rand6}_{file.name}` to preserve
 * the original name for auditability while avoiding collisions.
 *
 * Full storage path: `{basePath}[/{subpath}]/{filename}`. The optional
 * `subpath` lets a single hook instance serve multiple dynamic targets
 * (e.g. `chk_projects` basePath + `{projectId}/{areaKey}` subpath per call).
 *
 * @param {string} basePath - Folder prefix (no trailing slash). e.g. 'bodega/recepciones'
 * @returns {{
 *   upload: (file: File, opts?: { subpath?: string }) => Promise<{ url: string, path: string }>,
 *   uploading: boolean,
 *   progress: number,
 * }}
 */
export function useStorageUpload(basePath) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (file, opts = {}) => {
    if (!file) throw new Error('useStorageUpload: file is required');
    const { subpath } = opts;
    setUploading(true);
    setProgress(0);
    try {
      const rand = Math.random().toString(36).substring(2, 8);
      const filename = `${Date.now()}_${rand}_${file.name}`;
      const path = subpath
        ? `${basePath}/${subpath}/${filename}`
        : `${basePath}/${filename}`;
      const fileRef = storageRef(getFbStorage(), path);
      setProgress(30);
      await uploadBytes(fileRef, file);
      setProgress(70);
      const url = await getDownloadURL(fileRef);
      setProgress(100);
      return { url, path };
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, progress };
}
