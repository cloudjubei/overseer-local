import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { gitService } from '../services/gitService'
import { useActiveProject } from './ProjectContext'

// Types mirrored from main GitManager to keep renderer generic
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
  // Aggregated across all known projects
  allProjects: ProjectGitSummary[]
  // Convenience: current active project summary (if available)
  currentProject?: ProjectGitSummary
  // Loading and error state for latest fetches
  loading: boolean
  error?: string

  // Actions
  refreshAll: () => Promise<void>
  refreshCurrent: () => Promise<void>
}

const GitContext = createContext<GitContextValue | null>(null)

export function GitProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useActiveProject()
  const [allProjects, setAllProjects] = useState<ProjectGitSummary[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refreshAll = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const res = await gitService.todo()
      if (!mountedRef.current) return
      setAllProjects(res?.projects ?? [])
    } catch (e: any) {
      if (!mountedRef.current) return
      setError(e?.message ?? String(e))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  const refreshCurrent = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(undefined)
    try {
      const res = await gitService.todo(projectId)
      if (!mountedRef.current) return
      const proj = res?.projects ?? []
      // Merge/replace current project entry in allProjects
      setAllProjects((prev) => {
        const map = new Map(prev.map((p) => [p.projectId, p]))
        for (const p of proj) map.set(p.projectId, p)
        return Array.from(map.values())
      })
    } catch (e: any) {
      if (!mountedRef.current) return
      setError(e?.message ?? String(e))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    // Initial load for all projects; UI can call refreshCurrent for focused updates
    refreshAll()
  }, [refreshAll])

  useEffect(() => {
    // When active project changes, refresh its summary quickly
    if (projectId) refreshCurrent()
  }, [projectId, refreshCurrent])

  const currentProject = useMemo(() => {
    if (!projectId) return undefined
    return allProjects.find((p) => p.projectId === projectId)
  }, [allProjects, projectId])

  const value: GitContextValue = useMemo(
    () => ({ allProjects, currentProject, loading, error, refreshAll, refreshCurrent }),
    [allProjects, currentProject, loading, error, refreshAll, refreshCurrent],
  )

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>
}

export function useGitContext(): GitContextValue {
  const ctx = useContext(GitContext)
  if (!ctx) throw new Error('useGitContext must be used within GitProvider')
  return ctx
}
