import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ProjectSpec } from 'src/types/tasks'
import { projectsService } from '../services/projectsService'

const MAIN_PROJECT = 'main'

export type ProjectContextValue = {
  activeProjectId: string
  isMain: boolean
  activeProject?: ProjectSpec

  projects: ProjectSpec[]

  setActiveProjectId: (id: string) => void
  switchToMainProject: () => void
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

  const update = async () => {
      const files = await projectsService.listProjects()
      updateCurrentProjects(files)
  }
  const updateCurrentProjects = (projects: ProjectSpec[]) => {
    setProjects(projects)
  }
  useEffect(() => {
    update();

    const unsubscribe = projectsService.subscribe(updateCurrentProjects);

    return () => {
      unsubscribe();
    };
  }, []);


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
    console.log("activeProjectId: ", activeProjectId)
    return getProjectById(activeProjectId)
  }, [projects, activeProjectId])

  const value = useMemo<ProjectContextValue>(() => ({
    activeProjectId,
    isMain: activeProjectId === MAIN_PROJECT,
    activeProject,
    setActiveProjectId,
    switchToMainProject,
    projects,
    getProjectById,
  }), [activeProjectId, activeProject, setActiveProjectId, switchToMainProject, projects])

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
