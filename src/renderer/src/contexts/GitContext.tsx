import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { gitService } from '../services/gitService'
import { useProjectContext } from './ProjectContext'

export type PendingBranchSummary = {
  projectId: string
  repoPath: string
  baseRef: string
  branch: string
  ahead: number
  behind: number
  storyId?: string
  featureId?: string
  totals?: { insertions: number; deletions: number; filesChanged: number }
}

export type ProjectGitSummary = {
  projectId: string
  repoPath?: string
  baseRef?: string
  pending: PendingBranchSummary[]
  error?: string
}

export type GitContextValue = {
  loading: boolean
  error?: string
  currentProject?: ProjectGitSummary
  allProjects: ProjectGitSummary[]
  refresh: () => Promise<void>
}

const GitContext = createContext<GitContextValue | null>(null)

export function GitProvider({ children }: { children: React.ReactNode }) {
  const { activeProjectId } = useProjectContext()
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const [currentProject, setCurrent] = useState<ProjectGitSummary | undefined>(undefined)
  const [allProjects, setAll] = useState<ProjectGitSummary[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      // Fetch current project only
      if (activeProjectId) {
        const { projects } = await gitService.todo(activeProjectId)
        setCurrent(projects[0])
      } else {
        setCurrent(undefined)
      }
      // Fetch all projects aggregate
      const { projects: all } = await gitService.todo()
      setAll(all || [])
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }, [activeProjectId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo<GitContextValue>(
    () => ({ loading, error, currentProject, allProjects, refresh }),
    [loading, error, currentProject, allProjects, refresh],
  )

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>
}

export function useGit(): GitContextValue {
  const ctx = useContext(GitContext)
  if (!ctx) throw new Error('useGit must be used within GitProvider')
  return ctx
}
