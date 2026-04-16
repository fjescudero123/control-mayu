import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { _getDb } from './_services';

type DefaultDoc = { id: string } & DocumentData;

export interface UseFirestoreCollectionOptions<T> {
  /** Per-doc transform. Default: `(d) => ({ ...d.data(), id: d.id })`. */
  transform?: (doc: QueryDocumentSnapshot<DocumentData>) => T;
  /** Gate the subscription. When false, nothing happens and `data` stays empty. */
  enabled?: boolean;
  /** Error callback. Default logs a warning tagged with the collection name. */
  onError?: (err: Error) => void;
}

export interface UseFirestoreCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

/**
 * useFirestoreCollection — real-time subscription to a Firestore collection.
 *
 * Sort/filter are presentation concerns — do them in the caller via useMemo.
 */
export function useFirestoreCollection<T = DefaultDoc>(
  name: string,
  opts: UseFirestoreCollectionOptions<T> = {},
): UseFirestoreCollectionResult<T> {
  const { transform, enabled = true, onError } = opts;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const effectiveTransform: (d: QueryDocumentSnapshot<DocumentData>) => T =
      transform ?? ((d) => ({ ...d.data(), id: d.id } as unknown as T));

    const unsub = onSnapshot(
      collection(_getDb(), name),
      (snap) => {
        setData(snap.docs.map(effectiveTransform));
        setLoading(false);
        setError(null);
      },
      (err: Error) => {
        setError(err);
        setLoading(false);
        if (onError) onError(err);
        else console.warn(`${name}:`, err.message);
      },
    );
    return unsub;
  }, [name, enabled]);

  return { data, loading, error };
}
