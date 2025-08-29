import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ProjectSpec } from 'src/types/tasks'
import { projectsService, type ProjectsIndexSnapshot } from '../services/projectsService'
import notificationsService from '../services/notificationsService'

export type ProjectId = 'main' | string

export type ProjectContextValue = {
  // Identity
  activeProjectId: ProjectId
  isMain: boolean
  // The ProjectSpec for a child project, or null when on main project
  activeProject: ProjectSpec | null

  // Actions
  setActiveProjectId: (id: ProjectId) => void
  switchToMainProject: () => void

  // Data
  snapshot: ProjectsIndexSnapshot | null
  projects: ProjectSpec[]
  loading: boolean
  error: Error | null

  // Helpers
  getProjectById: (id: string) => ProjectSpec | undefined
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

const STORAGE_KEY = 'app.activeProjectId'

function loadStoredProjectId(): ProjectId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 'main'
    return (raw as ProjectId) || 'main'
  } catch {
    return 'main'
  }
}

function storeProjectId(id: ProjectId) {
  try { localStorage.setItem(STORAGE_KEY, id) } catch {}
}

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [activeProjectId, setActiveProjectIdState] = useState<ProjectId>(() => loadStoredProjectId())
  const [snapshot, setSnapshot] = useState<ProjectsIndexSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Initial load
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const snap = await projectsService.getSnapshot()
        if (!cancelled) {
          setSnapshot(snap)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e as Error)
          setLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Subscribe to updates
  useEffect(() => {
    const unsubscribe = projectsService.onUpdate((snap) => {
      setSnapshot(snap)
    })
    return unsubscribe
  }, [])

  // Validate selection against snapshot
  useEffect(() => {
    if (!snapshot) return

    // If we're on main, always valid
    if (activeProjectId === 'main') return

    const exists = !!snapshot.projectsById[activeProjectId]
    if (!exists) {
      // Fallback: try first available child; otherwise main
      const first = snapshot.orderedIds[0]
      const nextId: ProjectId = first || 'main'
      setActiveProjectIdState(nextId)
      storeProjectId(nextId)
    }
  }, [snapshot, activeProjectId])

  const setActiveProjectId = useCallback((id: ProjectId) => {
    setActiveProjectIdState(id)
    storeProjectId(id)
  }, [])

  const switchToMainProject = useCallback(() => setActiveProjectId('main'), [setActiveProjectId])

  const projects = useMemo(() => {
    if (!snapshot) return []
    return snapshot.orderedIds.map((id) => snapshot.projectsById[id]).filter(Boolean)
  }, [snapshot])

  const activeProject: ProjectSpec | null = useMemo(() => {
    if (!snapshot) return null
    if (activeProjectId === 'main') return null
    return snapshot.projectsById[activeProjectId] || null
  }, [snapshot, activeProjectId])

  // Sync active project with tasks, files, chat, and notifications context in main via preload API
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        if (window.tasksIndex && typeof window.tasksIndex.setContext === 'function') {
          window.tasksIndex.setContext(activeProjectId)
        }
        if (window.fileIndex && typeof window.fileIndex.setContext === 'function') {
          window.fileIndex.setContext(activeProjectId)
        }
        if (window.chat && typeof window.chat.setContext === 'function') {
          window.chat.setContext(activeProjectId)
        }
        notificationsService.setContext(activeProjectId)
      }
    } catch { /* ignore */ }
  }, [activeProjectId])

  const value = useMemo<ProjectContextValue>(() => ({
    activeProjectId,
    isMain: activeProjectId === 'main',
    activeProject,
    setActiveProjectId,
    switchToMainProject,
    snapshot,
    projects,
    loading,
    error,
    getProjectById: (id: string) => snapshot?.projectsById[id],
  }), [activeProjectId, activeProject, setActiveProjectId, switchToMainProject, snapshot, projects, loading, error])

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjectContext must be used within ProjectsProvider')
  return ctx
}

export function useActiveProject() {
  const { activeProjectId, activeProject } = useProjectContext()
  return {
    projectId: activeProjectId,
    project: activeProject,
    isMain: activeProjectId === 'main',
  }
}
