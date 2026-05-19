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
  /**
   * Exposes setter for optimistic local updates in handlers — necesario para
   * apps que escriben a Firestore y mantienen state cacheado entre snapshots.
   * El listener real-time reconcilia el state usando docChanges() (incremental),
   * por lo que un optimistic update en un doc local NO se pierde cuando llega
   * un snapshot que solo trae cambios en otros docs.
   */
  setData: React.Dispatch<React.SetStateAction<T[]>>;
  loading: boolean;
  error: Error | null;
}

/**
 * useFirestoreCollection — real-time subscription to a Firestore collection.
 *
 * Updates incrementales via `snap.docChanges()`: cuando llega un snapshot,
 * solo aplicamos los docs que cambiaron (added/modified/removed). Esto evita
 * sobreescribir optimistic updates locales en docs que NO cambiaron en el
 * snapshot — fix del bug "saveProjectToDb sobrescribe state cacheado".
 *
 * Sort/filter son presentation concerns — hazlos en el caller via useMemo.
 */
export function useFirestoreCollection<T = DefaultDoc>(
  name: string,
  opts: UseFirestoreCollectionOptions<T> = {},
): UseFirestoreCollectionResult<T> {
  const { transform, enabled = true, onError } = opts;

  const [data, setData] = useState<T[]>([]);
  // `loading` se deriva de `enabled && !hasFetched` para que un consumidor que
  // hace flip de enabled false→true vea loading=true en el MISMO render. Si
  // usaramos un useState<boolean> el flag quedaria stale por un render, dando
  // tiempo a que un effect downstream (ej. seed) corra con data=[] aunque la
  // suscripcion todavia no entrego nada.
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setHasFetched(false);

    const effectiveTransform: (d: QueryDocumentSnapshot<DocumentData>) => T =
      transform ?? ((d) => ({ ...d.data(), id: d.id } as unknown as T));

    let isFirstSnapshot = true;

    const unsub = onSnapshot(
      collection(_getDb(), name),
      (snap) => {
        if (isFirstSnapshot) {
          // Initial load: set full data
          setData(snap.docs.map(effectiveTransform));
          isFirstSnapshot = false;
        } else {
          // Subsequent updates: apply only doc-level changes. Esto preserva
          // optimistic updates locales en docs que no aparecen en docChanges.
          const changes = snap.docChanges();
          if (changes.length > 0) {
            setData((prev) => {
              const next = [...prev];
              for (const change of changes) {
                const docId = change.doc.id;
                const transformed = effectiveTransform(change.doc as QueryDocumentSnapshot<DocumentData>);
                const idx = next.findIndex((d) => (d as { id?: string }).id === docId);
                if (change.type === 'added') {
                  if (idx < 0) next.push(transformed);
                  else next[idx] = transformed; // edge case: ya estaba (cache)
                } else if (change.type === 'modified') {
                  if (idx >= 0) next[idx] = transformed;
                  else next.push(transformed);
                } else if (change.type === 'removed') {
                  if (idx >= 0) next.splice(idx, 1);
                }
              }
              return next;
            });
          }
        }
        setHasFetched(true);
        setError(null);
      },
      (err: Error) => {
        setError(err);
        setHasFetched(true);
        if (onError) onError(err);
        else console.warn(`${name}:`, err.message);
      },
    );
    return unsub;
  }, [name, enabled]);

  const loading = enabled && !hasFetched;

  return { data, setData, loading, error };
}
