import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  AuthProvider as HeadlessAuthProvider,
  useAuth as useHeadlessAuth,
  type TokenStorage,
} from 'thefactory-ui/headless/api'
import { authService, type AuthState } from '../../services/authService'

/**
 * Desktop's `useAuth` surface — the headless `AuthContextValue` (token,
 * unauthorized, setToken, clearToken, markUnauthorized, clearUnauthorized)
 * plus the desktop-specific baseUrl + ready + setBaseUrl + setBoth + clear,
 * which persist via Electron's `safeStorage` over the `auth:get|set|clear`
 * IPC bridge (`authService`). The renderer reads/writes the state
 * asynchronously; first render observes `null` until the initial
 * `authService.get()` resolves.
 */
export type AuthContextValue = {
  baseUrl: string | null
  token: string | null
  /** True once the initial `authService.get()` has resolved. */
  ready: boolean
  /** True if the API returned 401 for the current token. */
  unauthorized: boolean
  setBaseUrl: (baseUrl: string | null) => Promise<void>
  setToken: (token: string | null) => Promise<void>
  setBoth: (state: { baseUrl: string | null; token: string | null }) => Promise<void>
  /** Convenience: clears just the bearer token, leaves `baseUrl` in place. Parity with web. */
  clearToken: () => Promise<void>
  /** Wipes both fields. Desktop-specific (web's `clearToken` is the only "clear" path). */
  clear: () => Promise<void>
  markUnauthorized: () => void
  clearUnauthorized: () => void
}

// Shared cache between the sync `TokenStorage` adapter and the bridge.
// `safeStorage` IPC is async, but the headless `AuthProvider` expects a sync
// `read()`; the cache lets the adapter answer reads immediately after the
// initial bootstrap pushes the loaded state through `subscribe`.
let cachedBaseUrl: string | null = null
let cachedToken: string | null = null
const tokenListeners = new Set<(t: string | null) => void>()

async function bootstrapAuthState(): Promise<AuthState> {
  const state = await authService.get()
  cachedBaseUrl = state.baseUrl
  cachedToken = state.token
  tokenListeners.forEach((l) => l(state.token))
  return state
}

async function persistAuthState(state: AuthState): Promise<AuthState> {
  const next = await authService.set(state)
  cachedBaseUrl = next.baseUrl
  cachedToken = next.token
  tokenListeners.forEach((l) => l(next.token))
  return next
}

async function clearPersistedAuthState(): Promise<AuthState> {
  const next = await authService.clear()
  cachedBaseUrl = next.baseUrl
  cachedToken = next.token
  tokenListeners.forEach((l) => l(next.token))
  return next
}

const safeStorageTokenAdapter: TokenStorage = {
  read: () => cachedToken,
  write: (next) => {
    cachedToken = next
    // Pair with the cached baseUrl so authService stays internally consistent
    // when the headless layer mutates the token via `setToken` from screens
    // that don't go through the bridge's `setBoth`.
    void authService.set({ baseUrl: cachedBaseUrl, token: next })
  },
  subscribe: (listener) => {
    tokenListeners.add(listener)
    return () => {
      tokenListeners.delete(listener)
    }
  },
}

const DesktopAuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <HeadlessAuthProvider storage={safeStorageTokenAdapter}>
      <DesktopAuthBridge>{children}</DesktopAuthBridge>
    </HeadlessAuthProvider>
  )
}

function DesktopAuthBridge({ children }: { children: ReactNode }) {
  const { token, unauthorized, markUnauthorized, clearUnauthorized } = useHeadlessAuth()
  const [baseUrl, setBaseUrlState] = useState<string | null>(cachedBaseUrl)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void bootstrapAuthState()
      .then((state) => {
        if (cancelled) return
        setBaseUrlState(state.baseUrl)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setBoth = useCallback(
    async (next: { baseUrl: string | null; token: string | null }) => {
      const state = await persistAuthState(next)
      setBaseUrlState(state.baseUrl)
      // Token + `unauthorized=false` propagate via the headless provider's
      // `subscribe` handler in `safeStorageTokenAdapter`.
    },
    [],
  )

  const setBaseUrl = useCallback(
    async (next: string | null) => {
      await setBoth({ baseUrl: next, token })
    },
    [setBoth, token],
  )

  const setToken = useCallback(
    async (next: string | null) => {
      await setBoth({ baseUrl, token: next })
    },
    [setBoth, baseUrl],
  )

  const clearToken = useCallback(() => setToken(null), [setToken])

  const clear = useCallback(async () => {
    const state = await clearPersistedAuthState()
    setBaseUrlState(state.baseUrl)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      baseUrl,
      token,
      ready,
      unauthorized,
      setBaseUrl,
      setToken,
      setBoth,
      clearToken,
      clear,
      markUnauthorized,
      clearUnauthorized,
    }),
    [
      baseUrl,
      token,
      ready,
      unauthorized,
      setBaseUrl,
      setToken,
      setBoth,
      clearToken,
      clear,
      markUnauthorized,
      clearUnauthorized,
    ],
  )

  return <DesktopAuthContext.Provider value={value}>{children}</DesktopAuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(DesktopAuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
