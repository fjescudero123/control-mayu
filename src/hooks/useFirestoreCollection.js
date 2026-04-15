import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getFbDb } from '../firebase';

/**
 * useFirestoreCollection — real-time subscription to a Firestore collection.
 *
 * @param {string} name - Collection name.
 * @param {object} [opts]
 * @param {(doc: import('firebase/firestore').QueryDocumentSnapshot) => any} [opts.transform]
 *   Per-doc transform. Default: `(d) => ({ ...d.data(), id: d.id })`.
 * @param {boolean} [opts.enabled=true] - Gate the subscription.
 * @param {(err: Error) => void} [opts.onError] - Error callback. Default logs
 *   a warning tagged with the collection name.
 * @returns {{ data: any[], loading: boolean, error: Error | null }}
 */
export function useFirestoreCollection(name, opts = {}) {
  const {
    transform = (d) => ({ ...d.data(), id: d.id }),
    enabled = true,
    onError,
  } = opts;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(
      collection(getFbDb(), name),
      (snap) => {
        setData(snap.docs.map(transform));
        setLoading(false);
        setError(null);
      },
      (err) => {
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
