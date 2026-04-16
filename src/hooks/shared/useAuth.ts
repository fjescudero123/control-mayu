import { useState, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { _getAuth } from './_services';

export interface UseAuthResult {
  firebaseUser: User | null;
  loading: boolean;
  error: Error | null;
}

/**
 * useAuth — Firebase anonymous auth.
 *
 * Calls signInAnonymously once on mount and tracks auth state via
 * onAuthStateChanged. The app-level currentUser (APP_USERS / MOCK_USERS)
 * is separate and stays in the component — this hook only manages the
 * Firebase identity layer.
 */
export function useAuth(): UseAuthResult {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    signInAnonymously(_getAuth()).catch((err: Error) => {
      console.error('useAuth: signInAnonymously failed:', err);
      setError(err);
    });

    const unsub = onAuthStateChanged(_getAuth(), (user) => {
      setFirebaseUser(user);
      setLoading(false);
    });

    return unsub;
  }, []);

  return { firebaseUser, loading, error };
}
