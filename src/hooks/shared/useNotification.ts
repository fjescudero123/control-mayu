import { useState, useEffect, useCallback } from 'react';

export interface Toast {
  message: string;
  type: string;
}

/**
 * useNotification — toast state with auto-dismiss.
 *
 * @param durationMs - Auto-dismiss timeout in ms (default 4000).
 * @returns tuple:
 *   - toast: { message, type } | null
 *   - notify(message, type = 'success'): shows a toast.
 *   - dismiss(): clears the current toast manually.
 */
export function useNotification(
  durationMs: number = 4000,
): [Toast | null, (message: string, type?: string) => void, () => void] {
  const [toast, setToast] = useState<Toast | null>(null);

  const notify = useCallback((message: string, type: string = 'success') => {
    setToast({ message, type });
  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(t);
  }, [toast, durationMs]);

  return [toast, notify, dismiss];
}
