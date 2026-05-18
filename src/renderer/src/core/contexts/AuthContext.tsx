import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authService } from '../../services/authService'

/**
 * Desktop's equivalent of web's [`AuthContext`](../../../../../../thefactory-overseer-web/src/core/contexts/AuthContext.tsx) —
 * same API surface, but token + baseUrl persist via Electron's `safeStorage`
 * over the `auth:get|set|clear` IPC bridge (`authService`). The renderer
 * reads/writes the state asynchronously; first render observes `null` until
 * the initial `authService.get()` resolves.
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

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [baseUrl, setBaseUrlState] = useState<string | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)

  useEffect(() => {
    let cancelled = false
    authService
      .get()
      .then((state) => {
        if (cancelled) return
        setBaseUrlState(state.baseUrl)
        setTokenState(state.token)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setBoth = useCallback(async (state: { baseUrl: string | null; token: string | null }) => {
    const next = await authService.set(state)
    setBaseUrlState(next.baseUrl)
    setTokenState(next.token)
    setUnauthorized(false)
  }, [])

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
    const next = await authService.clear()
    setBaseUrlState(next.baseUrl)
    setTokenState(next.token)
    setUnauthorized(false)
  }, [])

  const markUnauthorized = useCallback(() => setUnauthorized(true), [])
  const clearUnauthorized = useCallback(() => setUnauthorized(false), [])

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
