import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  cloneOverseer,
  confirmOverseerLocalOnly,
  getOverseer,
  pushOverseer,
  removeOverseerRemote,
  resetOverseer,
  setOverseerRemote,
  type OverseerState,
} from '@generated/backend'
import { useApi } from './ApiContext'
import { useAuth } from './AuthContext'

export type OverseerContextValue = {
  isLoaded: boolean
  loadError: Error | null
  state: OverseerState | null
  refresh: () => Promise<void>
  setRemote: (remoteUrl: string) => Promise<void>
  removeRemote: () => Promise<void>
  clone: (remoteUrl: string) => Promise<void>
  /**
   * One-shot push of the local overseer to its configured remote. Returns
   * the branches that were actually pushed. Useful right after `setRemote`
   * to seed a freshly-attached remote so backups don't wait until the
   * next daily squash.
   */
  push: () => Promise<{ pushedBranches: string[] }>
  /**
   * Disconnect the active overseer. The backend archives the working tree
   * to `~/.factory-overseer/archive/<iso-timestamp>/` (recoverable) and
   * resets local state. The remote, if any, is left untouched — re-running
   * setup with the same remote URL re-clones it. After this resolves the
   * `overseer:updated` broadcast clears `state.hasRemote`/`projectCount`,
   * so `AuthedRoot` will route back to the welcome flow on its own.
   */
  reset: () => Promise<void>
  /**
   * Mark the overseer as user-confirmed local-only. The connect and
   * fresh-github paths flip `setupCompleted` server-side as a side effect
   * of attaching a remote; the local-only path makes no other backend
   * call, so without this the next session can't tell "user picked
   * local-only" apart from "user has never run setup". Idempotent.
   */
  confirmLocalOnly: () => Promise<void>
}

const OverseerContext = createContext<OverseerContextValue | null>(null)

/**
 * Loads `getOverseer` once on mount and re-fetches on every `overseer:updated`
 * WS broadcast. Mutations (setRemote / removeRemote / clone) call the SDK with
 * `{ throwOnError: true }` and rely on the broadcast for refresh — never
 * optimistic-update, the move can fail mid-way and the server is the truth.
 */
export function OverseerProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const { ws } = useApi()
  const [state, setState] = useState<OverseerState | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    try {
      const { data } = await getOverseer({ throwOnError: true })
      setState(data)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    void refresh()
  }, [token, refresh])

  useEffect(() => ws.on('overseer:updated', () => void refresh()), [ws, refresh])

  const setRemote = useCallback(async (remoteUrl: string) => {
    await setOverseerRemote({ body: { remoteUrl }, throwOnError: true })
  }, [])

  const removeRemote = useCallback(async () => {
    await removeOverseerRemote({ throwOnError: true })
  }, [])

  const clone = useCallback(async (remoteUrl: string) => {
    await cloneOverseer({ body: { remoteUrl }, throwOnError: true })
  }, [])

  const push = useCallback(async () => {
    const { data } = await pushOverseer({ throwOnError: true })
    return data
  }, [])

  const reset = useCallback(async () => {
    await resetOverseer({ throwOnError: true })
  }, [])

  const confirmLocalOnly = useCallback(async () => {
    await confirmOverseerLocalOnly({ throwOnError: true })
  }, [])

  const value = useMemo<OverseerContextValue>(
    () => ({
      isLoaded,
      loadError,
      state,
      refresh,
      setRemote,
      removeRemote,
      clone,
      push,
      reset,
      confirmLocalOnly,
    }),
    [
      isLoaded,
      loadError,
      state,
      refresh,
      setRemote,
      removeRemote,
      clone,
      push,
      reset,
      confirmLocalOnly,
    ],
  )

  return <OverseerContext.Provider value={value}>{children}</OverseerContext.Provider>
}

export function useOverseer(): OverseerContextValue {
  const ctx = useContext(OverseerContext)
  if (!ctx) throw new Error('useOverseer must be used within OverseerProvider')
  return ctx
}
