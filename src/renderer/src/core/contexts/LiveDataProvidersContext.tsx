import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  createLiveDataProvider,
  deleteLiveDataProvider,
  fetchLiveDataProvider,
  getLiveDataPayload,
  listLiveDataProviders,
  updateLiveDataProvider,
  type LiveDataPayload,
  type LiveDataProvider,
  type LiveDataProviderCreateInput,
  type LiveDataProviderEditInput,
} from '../../generated/backend'
import type { LiveDataUpdatedEvent } from '../../api/types'
import { useApi } from './ApiContext'
import { useActiveProject } from './ProjectsContext'

export type LiveDataProvidersContextValue = {
  isLoaded: boolean
  loadError: Error | null
  /** Project-scoped + globals visible from the active project. */
  providers: LiveDataProvider[]
  createProvider: (input: LiveDataProviderCreateInput) => Promise<LiveDataProvider>
  updateProvider: (id: string, patch: LiveDataProviderEditInput) => Promise<LiveDataProvider>
  deleteProvider: (id: string) => Promise<void>
  /** Kicks a refresh; resolves with the freshly-fetched payload. */
  fetchProvider: (id: string) => Promise<LiveDataPayload>
  /** Reads the last cached payload for `id`; resolves to `null` on 404. */
  getProviderPayload: (id: string) => Promise<LiveDataPayload | null>
  refresh: () => Promise<void>
}

const LiveDataProvidersContext = createContext<LiveDataProvidersContextValue | null>(null)

const EMPTY: LiveDataProvider[] = []

function isLiveDataUpdatedEvent(v: unknown): v is LiveDataUpdatedEvent {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Partial<LiveDataUpdatedEvent>
  return typeof e.providerId === 'string' && typeof e.status === 'string'
}

export function LiveDataProvidersProvider({ children }: { children: ReactNode }) {
  const { ws } = useApi()
  const { projectId } = useActiveProject()

  const [providers, setProviders] = useState<LiveDataProvider[]>(EMPTY)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) {
      setProviders(EMPTY)
      setIsLoaded(true)
      setLoadError(null)
      return
    }
    try {
      const { data } = await listLiveDataProviders({
        query: { projectId },
        throwOnError: true,
      })
      setProviders(data)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoaded(true)
    }
  }, [projectId])

  useEffect(() => {
    setIsLoaded(false)
    setProviders(EMPTY)
    setLoadError(null)
    void refresh()
  }, [projectId, refresh])

  // Apply incremental status updates so a long-running fetch flips the row's
  // `isUpdating` flag in real time. The terminal `fresh` / `error` status
  // also triggers a list reload to pick up `lastUpdated` and any payload
  // metadata the server bumped.
  useEffect(
    () =>
      ws.on('liveData:updated', (raw) => {
        if (!isLiveDataUpdatedEvent(raw)) return
        setProviders((current) =>
          current.map((p) =>
            p.id === raw.providerId ? { ...p, isUpdating: raw.status === 'fetching' } : p,
          ),
        )
        if (raw.status !== 'fetching') void refresh()
      }),
    [ws, refresh],
  )

  const createProviderImpl = useCallback<LiveDataProvidersContextValue['createProvider']>(
    async (input) => {
      const { data } = await createLiveDataProvider({ body: input, throwOnError: true })
      await refresh()
      return data
    },
    [refresh],
  )

  const updateProviderImpl = useCallback<LiveDataProvidersContextValue['updateProvider']>(
    async (id, patch) => {
      const { data } = await updateLiveDataProvider({
        path: { id },
        body: patch,
        throwOnError: true,
      })
      await refresh()
      return data
    },
    [refresh],
  )

  const deleteProviderImpl = useCallback<LiveDataProvidersContextValue['deleteProvider']>(
    async (id) => {
      await deleteLiveDataProvider({ path: { id }, throwOnError: true })
      await refresh()
    },
    [refresh],
  )

  const fetchProviderImpl = useCallback<LiveDataProvidersContextValue['fetchProvider']>(
    async (id) => {
      // Optimistic flag flip so the row shows "Updating…" without waiting on
      // the WS round-trip. The terminal broadcast clears it via `refresh()`.
      setProviders((current) => current.map((p) => (p.id === id ? { ...p, isUpdating: true } : p)))
      const { data } = await fetchLiveDataProvider({ path: { id }, throwOnError: true })
      return data
    },
    [],
  )

  const getProviderPayloadImpl = useCallback<LiveDataProvidersContextValue['getProviderPayload']>(
    async (id) => {
      const res = await getLiveDataPayload({ path: { id } })
      if (res.error) return null
      return res.data ?? null
    },
    [],
  )

  const value = useMemo<LiveDataProvidersContextValue>(
    () => ({
      isLoaded,
      loadError,
      providers,
      createProvider: createProviderImpl,
      updateProvider: updateProviderImpl,
      deleteProvider: deleteProviderImpl,
      fetchProvider: fetchProviderImpl,
      getProviderPayload: getProviderPayloadImpl,
      refresh,
    }),
    [
      isLoaded,
      loadError,
      providers,
      createProviderImpl,
      updateProviderImpl,
      deleteProviderImpl,
      fetchProviderImpl,
      getProviderPayloadImpl,
      refresh,
    ],
  )

  return (
    <LiveDataProvidersContext.Provider value={value}>{children}</LiveDataProvidersContext.Provider>
  )
}

export function useLiveDataProviders(): LiveDataProvidersContextValue {
  const ctx = useContext(LiveDataProvidersContext)
  if (!ctx) throw new Error('useLiveDataProviders must be used within LiveDataProvidersProvider')
  return ctx
}
