import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { _getDb } from './_services';

type DefaultDoc = { id: string } & DocumentData;

export interface UseFirestoreCollectionOnceOptions<T> {
  /** Per-doc transform. Default: `(d) => ({ ...d.data(), id: d.id })`. */
  transform?: (doc: QueryDocumentSnapshot<DocumentData>) => T;
  /** Gate the fetch. When false, nothing happens and `data` stays empty. */
  enabled?: boolean;
  /** Error callback. Default logs a warning tagged with the collection name. */
  onError?: (err: Error) => void;
}

export interface UseFirestoreCollectionOnceResult<T> {
  data: T[];
  /** Exposes setter for optimistic local updates in handlers. */
  setData: React.Dispatch<React.SetStateAction<T[]>>;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * useFirestoreCollectionOnce — one-shot fetch of a Firestore collection.
 * Does NOT subscribe. Fetches once when enabled; re-fetch via `refetch`.
 *
 * `setData` is exposed so callers can apply optimistic local updates
 * (e.g. setOrdenes([...ordenes, newOrden])) without re-fetching.
 *
 * Sort removed per HANDOFF decision 39 — do it in the caller via useMemo.
 */
export function useFirestoreCollectionOnce<T = DefaultDoc>(
  name: string,
  opts: UseFirestoreCollectionOnceOptions<T> = {},
): UseFirestoreCollectionOnceResult<T> {
  const { transform, enabled = true, onError } = opts;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    const effectiveTransform: (d: QueryDocumentSnapshot<DocumentData>) => T =
      transform ?? ((d) => ({ ...d.data(), id: d.id } as unknown as T));

    getDocs(collection(_getDb(), name))
      .then((snap) => {
        if (cancelled) return;
        setData(snap.docs.map(effectiveTransform));
        setLoading(false);
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
        if (onError) onError(err);
        else console.warn(`${name}:`, err.message);
      });
    return () => { cancelled = true; };
  }, [name, enabled, tick]);

  return { data, setData, loading, error, refetch };
}
