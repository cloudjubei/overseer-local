import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { listProjects, type GetProjectResponse } from '../../generated/backend'
import { useApi } from './ApiContext'
import { useAppSettings } from './AppSettingsContext'
import { useAuth } from './AuthContext'

export type ProjectsContextValue = {
  /** True once the first fetch has completed, whether it succeeded or failed. */
  isLoaded: boolean
  /** Set to the last fetch error; cleared on the next successful refresh. */
  loadError: Error | null
  projects: GetProjectResponse[]
  activeProjectId: string | undefined
  activeProject: GetProjectResponse | undefined
  setActiveProjectId: (id: string | undefined) => void
  /** Force a refetch — used by mutation flows until WS invalidation is reliable. */
  refresh: () => Promise<void>
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null)

function pickMostRecent(projects: GetProjectResponse[]): GetProjectResponse | undefined {
  if (projects.length === 0) return undefined
  return [...projects].sort((a, b) => {
    const at = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime()
    const bt = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime()
    return bt - at
  })[0]
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const { ws } = useApi()
  const { settings, setUserPreferences } = useAppSettings()

  const [projects, setProjects] = useState<GetProjectResponse[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(
    settings.userPreferences.lastActiveProjectId,
  )

  const refresh = useCallback(async () => {
    try {
      const { data } = await listProjects({ throwOnError: true })
      setProjects(data)
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

  useEffect(() => ws.on('projects:updated', () => void refresh()), [ws, refresh])

  // If the persisted active id no longer matches a project, fall back to the
  // most recently updated one. Only runs after the first load has completed.
  useEffect(() => {
    if (!isLoaded) return
    if (projects.length === 0) {
      if (activeProjectId !== undefined) setActiveProjectId(undefined)
      return
    }
    if (activeProjectId && projects.some((p) => p.id === activeProjectId)) return
    setActiveProjectId(pickMostRecent(projects)?.id)
  }, [isLoaded, projects, activeProjectId])

  const selectProject = useCallback(
    (id: string | undefined) => {
      setActiveProjectId(id)
      setUserPreferences({ lastActiveProjectId: id })
    },
    [setUserPreferences],
  )

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId),
    [projects, activeProjectId],
  )

  const value = useMemo<ProjectsContextValue>(
    () => ({
      isLoaded,
      loadError,
      projects,
      activeProjectId,
      activeProject,
      setActiveProjectId: selectProject,
      refresh,
    }),
    [isLoaded, loadError, projects, activeProjectId, activeProject, selectProject, refresh],
  )

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider')
  return ctx
}

export function useActiveProject() {
  const { activeProjectId, activeProject } = useProjects()
  return { projectId: activeProjectId, project: activeProject }
}
