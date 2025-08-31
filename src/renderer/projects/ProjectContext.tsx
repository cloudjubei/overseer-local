import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ProjectSpec } from 'src/types/tasks'
import { projectsService } from '../services/projectsService'

const MAIN_PROJECT = 'main'

export type ProjectContextValue = {
  activeProjectId: string
  isMain: boolean
  activeProject?: ProjectSpec

  // Actions
  setActiveProjectId: (id: string) => void
  switchToMainProject: () => void

  // Data
  projects: ProjectSpec[]
  loading: boolean
  error: Error | null

  // Helpers
  getProjectById: (id: string) => ProjectSpec | undefined
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

const STORAGE_KEY = 'app.activeProjectId'

function loadStoredProjectId(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return MAIN_PROJECT
    return raw
  } catch {
    return MAIN_PROJECT
  }
}

function storeProjectId(id: string) {
  try { localStorage.setItem(STORAGE_KEY, id) } catch {}
}

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [activeProjectId, setActiveProjectIdState] = useState(() => loadStoredProjectId())
  const [projects, setProjects] = useState<ProjectSpec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const projects = await projectsService.listProjects()
        if (!cancelled) {
          setProjects(projects)
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

  useEffect(() => {
    const unsubscribe = projectsService.subscribe(async () => {
        const projects = await projectsService.listProjects()
        setProjects(projects)
    })
    return unsubscribe
  }, [])

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id)
    storeProjectId(id)
  }, [])

  const switchToMainProject = useCallback(() => setActiveProjectId(MAIN_PROJECT), [setActiveProjectId])

  const getProjectById = useCallback((id: string) => {
    if (projects.length == 0) return
    return projects.find(p => p.id === id)
  }, [projects])

  const activeProject: ProjectSpec | undefined = useMemo(() => {
    return getProjectById(activeProjectId)
  }, [projects, activeProjectId])

  const value = useMemo<ProjectContextValue>(() => ({
    activeProjectId,
    isMain: activeProjectId === MAIN_PROJECT,
    activeProject,
    setActiveProjectId,
    switchToMainProject,
    projects,
    loading,
    error,
    getProjectById,
  }), [activeProjectId, activeProject, setActiveProjectId, switchToMainProject, projects, loading, error])

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjectContext must be used within ProjectsProvider')
  return ctx
}

export function useActiveProject() {
  const { activeProjectId, activeProject, isMain } = useProjectContext()
  return {
    projectId: activeProjectId,
    project: activeProject,
    isMain
  }
}
