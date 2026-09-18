import { useCallback, useEffect, useState } from "react";
import {
  authClearSemester,
  authClearTokens,
  authGetState,
  authGetTokens,
  authLogin,
  authLogout,
  authRestoreSession,
  authSetTokens,
  type AuthState,
  type AuthTokens,
} from "@/lib/tauri-auth";

export type UseAuthReturn = {
  /** Current authentication state from the backend */
  authState: AuthState | null;
  /** Whether an async auth operation is in progress */
  loading: boolean;
  /** Last error message, or null */
  error: string | null;
  /** Whether tokens are currently stored */
  hasTokens: boolean;
  /** Shorthand — true when authState.loggedIn is true */
  isLoggedIn: boolean;
  /** Whether the initial session check on boot has completed */
  initialized: boolean;
  /** Login with registration number and password */
  login: (regNo: string, password: string) => Promise<void>;
  /** Logout — clears ALL auth data (state + tokens + disk) */
  logout: () => Promise<void>;
  /** Re-fetch auth state from the backend store */
  refresh: () => Promise<void>;
  /** Fetch current tokens from the backend */
  fetchTokens: () => Promise<AuthTokens | null>;
  /** Persist new tokens to the backend */
  setTokens: (tokens: AuthTokens) => Promise<void>;
  /** Delete stored tokens (but keep auth state) */
  clearTokens: () => Promise<void>;
};

interface AuthStoreState {
  authState: AuthState | null;
  loading: boolean;
  error: string | null;
  hasTokens: boolean;
  initialized: boolean;
}

// Module-level global state shared across all hook instances
let storeState: AuthStoreState = {
  authState: null,
  loading: true,
  error: null,
  hasTokens: false,
  initialized: false,
};

const listeners = new Set<(state: AuthStoreState) => void>();

function updateStore(updates: Partial<AuthStoreState>) {
  storeState = { ...storeState, ...updates };
  listeners.forEach((listener) => listener(storeState));
}

// Keep track of the active refresh promise to avoid duplicate concurrent calls to the backend
let refreshPromise: Promise<void> | null = null;

/**
 * Standalone hook for all auth operations.
 *
 * State is synchronized globally across all instances of this hook.
 * Talks directly to the Tauri backend via invoke.
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthStoreState>(storeState);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const isLoggedIn = state.authState?.loggedIn ?? false;

  // ---------- public API ----------

  const refresh = useCallback(async () => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      updateStore({ loading: true, error: null });
      try {
        const restored = await authRestoreSession();
        if (restored) {
          updateStore({ authState: restored });
        } else {
          updateStore({ authState: await authGetState() });
        }
        
        // Sync token existence
        const tokens = await authGetTokens();
        updateStore({ hasTokens: tokens !== null });
      } catch (_err) {
        const state = await authGetState().catch(() => null);
        updateStore({ authState: state, error: null });
      } finally {
        updateStore({ loading: false, initialized: true });
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }, []);

  const login = useCallback(
    async (regNo: string, password: string) => {
      updateStore({ loading: true, error: null });
      try {
        const response = await authLogin(regNo, password);
        updateStore({ authState: response.state, hasTokens: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateStore({ error: msg });
        throw err;
      } finally {
        updateStore({ loading: false, initialized: true });
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    updateStore({ loading: true, error: null });
    try {
      await authLogout();
      await authClearSemester();
      updateStore({ authState: null, hasTokens: false });
      localStorage.clear();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStore({ error: msg });
      throw err;
    } finally {
      updateStore({ loading: false, initialized: true });
    }
  }, []);

  const fetchTokens = useCallback(async (): Promise<AuthTokens | null> => {
    try {
      const tokens = await authGetTokens();
      updateStore({ hasTokens: tokens !== null });
      return tokens;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStore({ error: msg });
      return null;
    }
  }, []);

  const setTokens = useCallback(
    async (tokens: AuthTokens) => {
      try {
        await authSetTokens(tokens);
        updateStore({ hasTokens: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        updateStore({ error: msg });
        throw err;
      }
    },
    [],
  );

  const clearTokens = useCallback(async () => {
    try {
      await authClearTokens();
      updateStore({ hasTokens: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateStore({ error: msg });
      throw err;
    }
  }, []);

  // ---------- bootstrap ----------

  useEffect(() => {
    // Only refresh on mount if we haven't checked/established initial session state
    if (storeState.authState === null && storeState.loading) {
      void refresh();
    }
  }, [refresh]);

  return {
    authState: state.authState,
    loading: state.loading,
    error: state.error,
    hasTokens: state.hasTokens,
    isLoggedIn,
    initialized: state.initialized,
    login,
    logout,
    refresh,
    fetchTokens,
    setTokens,
    clearTokens,
  };
}
