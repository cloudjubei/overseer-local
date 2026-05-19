import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  deleteWebSearchKey,
  listWebSearchKeys,
  updateWebSearchKeys,
} from 'thefactory-ui/headless/api'
import type {
  WebSearchKeyEntry,
  WebSearchKeyUpsertInput,
} from 'thefactory-ui/headless/api'
import { useAuth } from './AuthContext'

export type WebSearchKeysContextValue = {
  isLoaded: boolean
  loadError: Error | null
  keys: WebSearchKeyEntry[]
  upsertKey: (input: WebSearchKeyUpsertInput) => Promise<void>
  deleteKey: (provider: string) => Promise<void>
  refresh: () => Promise<void>
}

const WebSearchKeysContext = createContext<WebSearchKeysContextValue | null>(null)

export function WebSearchKeysProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const [keys, setKeys] = useState<WebSearchKeyEntry[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    try {
      const { data } = await listWebSearchKeys({ throwOnError: true })
      setKeys(data)
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

  const upsertKey = useCallback(
    async (input: WebSearchKeyUpsertInput) => {
      await updateWebSearchKeys({ body: input, throwOnError: true })
      await refresh()
    },
    [refresh],
  )

  const deleteKey = useCallback(
    async (provider: string) => {
      await deleteWebSearchKey({ path: { provider }, throwOnError: true })
      await refresh()
    },
    [refresh],
  )

  const value = useMemo<WebSearchKeysContextValue>(
    () => ({ isLoaded, loadError, keys, upsertKey, deleteKey, refresh }),
    [isLoaded, loadError, keys, upsertKey, deleteKey, refresh],
  )

  return <WebSearchKeysContext.Provider value={value}>{children}</WebSearchKeysContext.Provider>
}

export function useWebSearchKeys(): WebSearchKeysContextValue {
  const ctx = useContext(WebSearchKeysContext)
  if (!ctx) throw new Error('useWebSearchKeys must be used within WebSearchKeysProvider')
  return ctx
}
