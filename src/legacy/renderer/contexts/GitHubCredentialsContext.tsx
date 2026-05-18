import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { GitHubCredentials } from '../services/gitCredentialsService'
import { gitCredentialsService } from '../services/gitCredentialsService'

export type GitHubCredentialsContextValue = {
  credentials: GitHubCredentials[]
  addCredentials: (c: Omit<GitHubCredentials, 'id'>) => Promise<void>
  updateCredentials: (id: string, updates: Partial<GitHubCredentials>) => Promise<void>
  removeCredentials: (id: string) => Promise<void>
  getCredentials: (id: string) => Promise<GitHubCredentials | undefined>
}

const GitHubCredentialsContext = createContext<GitHubCredentialsContextValue | null>(null)

export function GitHubCredentialsProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCreds] = useState<GitHubCredentials[]>([])

  const refresh = useCallback(async () => {
    try {
      const list = await gitCredentialsService.list()
      setCreds(list || [])
    } catch {
      setCreds([])
    }
  }, [])

  useEffect(() => {
    refresh()
    const unsubscribe = gitCredentialsService.subscribe(() => {
      refresh()
    })
    return () => unsubscribe?.()
  }, [refresh])

  const addCredentials = useCallback(
    async (c: Omit<GitHubCredentials, 'id'>) => {
      await gitCredentialsService.add(c)
      await refresh()
    },
    [refresh],
  )

  const updateCredentials = useCallback(
    async (id: string, updates: Partial<GitHubCredentials>) => {
      await gitCredentialsService.update(id, updates)
      await refresh()
    },
    [refresh],
  )

  const removeCredentials = useCallback(
    async (id: string) => {
      await gitCredentialsService.remove(id)
      await refresh()
    },
    [refresh],
  )

  const getCredentials = useCallback(
    async (id: string) => {
      return await gitCredentialsService.get(id)
    },
    [credentials],
  )

  const value = useMemo<GitHubCredentialsContextValue>(
    () => ({ credentials, addCredentials, updateCredentials, removeCredentials, getCredentials }),
    [credentials, addCredentials, updateCredentials, removeCredentials, getCredentials],
  )

  return (
    <GitHubCredentialsContext.Provider value={value}>{children}</GitHubCredentialsContext.Provider>
  )
}

export function useGitHubCredentials(): GitHubCredentialsContextValue {
  const ctx = useContext(GitHubCredentialsContext)
  if (!ctx) throw new Error('useGitHubCredentials must be used within GitHubCredentialsProvider')
  return ctx
}
