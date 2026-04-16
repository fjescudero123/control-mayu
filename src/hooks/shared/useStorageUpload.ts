import { useState } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { _getStorage } from './_services';

export interface UploadResult {
  url: string;
  path: string;
}

export interface UploadOptions {
  subpath?: string;
}

export interface UseStorageUploadResult {
  upload: (file: File, opts?: UploadOptions) => Promise<UploadResult>;
  uploading: boolean;
  progress: number;
}

/**
 * useStorageUpload — upload a file to Firebase Storage under a given basePath.
 *
 * Filename: `{timestamp}_{rand6}_{file.name}` — preserves original name
 * for auditability, rand6 avoids collisions.
 *
 * Full path: `{basePath}[/{subpath}]/{filename}`.
 */
export function useStorageUpload(basePath: string): UseStorageUploadResult {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = async (file: File, opts: UploadOptions = {}): Promise<UploadResult> => {
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
      const fileRef = storageRef(_getStorage(), path);
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
