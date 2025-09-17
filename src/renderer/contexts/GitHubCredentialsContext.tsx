import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { GitHubCredentialsManager, GITHUB_CREDS_CHANGED_EVENT, GitHubCredentials } from '../utils/GitHubCredentialsManager'

export type GitHubCredentialsContextValue = {
  creds: GitHubCredentials[]
  addCreds: (c: Omit<GitHubCredentials, 'id'>) => void
  updateCreds: (id: string, updates: Partial<GitHubCredentials>) => void
  removeCreds: (id: string) => void
}

const GitHubCredentialsContext = createContext<GitHubCredentialsContextValue | null>(null)

export function GitHubCredentialsProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef(new GitHubCredentialsManager())
  const [creds, setCreds] = useState<GitHubCredentials[]>([])

  const refresh = useCallback(() => {
    setCreds(managerRef.current.getAll())
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener(GITHUB_CREDS_CHANGED_EVENT, handler as EventListener)
    return () => window.removeEventListener(GITHUB_CREDS_CHANGED_EVENT, handler as EventListener)
  }, [refresh])

  const addCreds = useCallback((c: Omit<GitHubCredentials, 'id'>) => {
    managerRef.current.add(c)
    refresh()
  }, [refresh])

  const updateCreds = useCallback((id: string, updates: Partial<GitHubCredentials>) => {
    managerRef.current.update(id, updates)
    refresh()
  }, [refresh])

  const removeCreds = useCallback((id: string) => {
    managerRef.current.remove(id)
    refresh()
  }, [refresh])

  const value = useMemo<GitHubCredentialsContextValue>(() => ({ creds, addCreds, updateCreds, removeCreds }), [creds, addCreds, updateCreds, removeCreds])

  return <GitHubCredentialsContext.Provider value={value}>{children}</GitHubCredentialsContext.Provider>
}

export function useGitHubCredentials(): GitHubCredentialsContextValue {
  const ctx = useContext(GitHubCredentialsContext)
  if (!ctx) throw new Error('useGitHubCredentials must be used within GitHubCredentialsProvider')
  return ctx
}
