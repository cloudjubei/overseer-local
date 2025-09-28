import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  GitHubCredentialsManager,
  GITHUB_CREDS_CHANGED_EVENT,
  GitHubCredentials,
} from '../utils/GitHubCredentialsManager'

export type GitHubCredentialsContextValue = {
  credentials: GitHubCredentials[]
  addCredentials: (c: Omit<GitHubCredentials, 'id'>) => void
  updateCredentials: (id: string, updates: Partial<GitHubCredentials>) => void
  removeCredentials: (id: string) => void
  getCredentials: (id: string) => GitHubCredentials | undefined
}

const GitHubCredentialsContext = createContext<GitHubCredentialsContextValue | null>(null)

export function GitHubCredentialsProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef(new GitHubCredentialsManager())
  const [credentials, setCreds] = useState<GitHubCredentials[]>([])

  const refresh = useCallback(() => {
    setCreds(managerRef.current.getAll())
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener(GITHUB_CREDS_CHANGED_EVENT, handler as EventListener)
    return () => window.removeEventListener(GITHUB_CREDS_CHANGED_EVENT, handler as EventListener)
  }, [refresh])

  const addCredentials = useCallback(
    (c: Omit<GitHubCredentials, 'id'>) => {
      managerRef.current.add(c)
      refresh()
    },
    [refresh],
  )

  const updateCredentials = useCallback(
    (id: string, updates: Partial<GitHubCredentials>) => {
      managerRef.current.update(id, updates)
      refresh()
    },
    [refresh],
  )

  const removeCredentials = useCallback(
    (id: string) => {
      managerRef.current.remove(id)
      refresh()
    },
    [refresh],
  )

  const getCredentials = useCallback(
    (id: string) => {
      return credentials.find((c) => c.id == id)
    },
    [credentials],
  )

  const value = useMemo<GitHubCredentialsContextValue>(
    () => ({
      credentials,
      addCredentials,
      updateCredentials,
      removeCredentials,
      getCredentials,
    }),
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
