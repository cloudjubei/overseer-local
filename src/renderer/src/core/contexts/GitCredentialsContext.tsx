import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  createGitCredential,
  deleteGitCredential,
  listGitCredentials,
  updateGitCredential,
  type GetGitCredentialResponse,
  type GitCredentialCreateInput,
  type GitCredentialEditInput,
} from '../../generated/backend'
import { useAuth } from './AuthContext'

export type GitCredentialsContextValue = {
  isLoaded: boolean
  loadError: Error | null
  credentials: GetGitCredentialResponse[]
  createCredentials: (input: GitCredentialCreateInput) => Promise<GetGitCredentialResponse>
  updateCredentials: (
    id: string,
    patch: GitCredentialEditInput,
  ) => Promise<GetGitCredentialResponse>
  deleteCredentials: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

const GitCredentialsContext = createContext<GitCredentialsContextValue | null>(null)

export function GitCredentialsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const [credentials, setCredentials] = useState<GetGitCredentialResponse[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    try {
      const { data } = await listGitCredentials({ throwOnError: true })
      setCredentials(data)
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

  const createCredentials = useCallback(
    async (input: GitCredentialCreateInput) => {
      const { data } = await createGitCredential({ body: input, throwOnError: true })
      await refresh()
      return data
    },
    [refresh],
  )

  const updateCredentials = useCallback(
    async (id: string, patch: GitCredentialEditInput) => {
      const { data } = await updateGitCredential({
        path: { id },
        body: patch,
        throwOnError: true,
      })
      await refresh()
      return data
    },
    [refresh],
  )

  const deleteCredentials = useCallback(
    async (id: string) => {
      await deleteGitCredential({ path: { id }, throwOnError: true })
      await refresh()
    },
    [refresh],
  )

  const value = useMemo<GitCredentialsContextValue>(
    () => ({
      isLoaded,
      loadError,
      credentials,
      createCredentials,
      updateCredentials,
      deleteCredentials,
      refresh,
    }),
    [
      isLoaded,
      loadError,
      credentials,
      createCredentials,
      updateCredentials,
      deleteCredentials,
      refresh,
    ],
  )

  return <GitCredentialsContext.Provider value={value}>{children}</GitCredentialsContext.Provider>
}

export function useGitCredentials(): GitCredentialsContextValue {
  const ctx = useContext(GitCredentialsContext)
  if (!ctx) throw new Error('useGitCredentials must be used within GitCredentialsProvider')
  return ctx
}
