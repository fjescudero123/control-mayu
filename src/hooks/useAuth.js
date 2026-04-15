import { useState, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFbAuth } from '../firebase';

/**
 * useAuth — Firebase anonymous auth.
 *
 * Calls signInAnonymously once on mount and tracks auth state via
 * onAuthStateChanged. The app-level currentUser (APP_USERS / MOCK_USERS)
 * is separate and stays in the component — this hook only manages the
 * Firebase identity layer.
 *
 * @returns {{
 *   firebaseUser: import('firebase/auth').User | null,
 *   loading: boolean,
 *   error: Error | null,
 * }}
 */
export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    signInAnonymously(getFbAuth()).catch((err) => {
      console.error('useAuth: signInAnonymously failed:', err);
      setError(err);
    });

    const unsub = onAuthStateChanged(getFbAuth(), (user) => {
      setFirebaseUser(user);
      setLoading(false);
    });

    return unsub;
  }, []);

  return { firebaseUser, loading, error };
}
