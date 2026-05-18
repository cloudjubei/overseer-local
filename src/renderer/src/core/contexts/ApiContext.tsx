import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { configureBackendClient } from '../../api/bootstrap'
import { WsClient, type WsConnectionState } from '../../api/WsClient'
import { useAuth } from './AuthContext'

/**
 * Desktop's equivalent of web's [`ApiContext`](../../../../../../thefactory-overseer-web/src/core/contexts/ApiContext.tsx) —
 * same wiring (one hey-api HTTP client + one WsClient), but the base URL and
 * token come from `AuthContext` (backed by safeStorage IPC) instead of Vite
 * env vars + localStorage. `ws` is always non-null to mirror web's surface;
 * when no base URL is configured yet, the underlying socket simply never
 * connects (gated on `token` below).
 */
export type ApiContextValue = {
  ws: WsClient
  wsState: WsConnectionState
}

const ApiContext = createContext<ApiContextValue | null>(null)

export function ApiProvider({ children }: { children: ReactNode }) {
  const { baseUrl, token, markUnauthorized, clearUnauthorized } = useAuth()
  const [wsState, setWsState] = useState<WsConnectionState>('idle')

  const authRef = useRef({ token, markUnauthorized, clearUnauthorized })
  authRef.current = { token, markUnauthorized, clearUnauthorized }

  const ws = useMemo<WsClient>(
    () =>
      new WsClient({
        baseUrl: baseUrl ?? '',
        getToken: () => authRef.current.token,
        onStateChange: setWsState,
      }),
    [baseUrl],
  )

  useEffect(() => {
    if (!baseUrl) return
    return configureBackendClient({
      baseUrl,
      getToken: () => authRef.current.token,
      onUnauthorized: () => authRef.current.markUnauthorized(),
      onAuthorized: () => authRef.current.clearUnauthorized(),
    })
  }, [baseUrl])

  useEffect(() => {
    if (!baseUrl || !token) {
      ws.disconnect()
      return
    }
    ws.connect()
    return () => ws.disconnect()
  }, [ws, baseUrl, token])

  const value = useMemo<ApiContextValue>(() => ({ ws, wsState }), [ws, wsState])

  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
}

export function useApi(): ApiContextValue {
  const ctx = useContext(ApiContext)
  if (!ctx) throw new Error('useApi must be used within ApiProvider')
  return ctx
}
