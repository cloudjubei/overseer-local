import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ProjectSpec } from 'src/types/tasks'
import { projectsService } from '../services/projectsService'
import { userPreferencesService } from '../services/userPreferencesService'

export const MAIN_PROJECT = 'main'

export type ProjectContextValue = {
  activeProjectId: string
  activeProject?: ProjectSpec

  projects: ProjectSpec[]

  setActiveProjectId: (id: string) => void
  getProjectById: (id: string) => ProjectSpec | undefined
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [activeProjectId, setActiveProjectIdState] = useState<string>(MAIN_PROJECT)
  const [projects, setProjects] = useState<ProjectSpec[]>([])

  // Load projects and subscribe to updates
  const update = async () => {
    const files = await projectsService.listProjects()
    updateCurrentProjects(files)
  }
  const updateCurrentProjects = (projectsList: ProjectSpec[]) => {
    setProjects(projectsList)
  }
  useEffect(() => {
    update();
    const unsubscribe = projectsService.subscribe(updateCurrentProjects);
    return () => { unsubscribe(); };
  }, [])

  // Restore last active project id from user preferences on mount
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const id = await userPreferencesService.getLastActiveProjectId()
        if (!mounted) return
        if (id) {
          setActiveProjectIdState(id)
        } else {
          setActiveProjectIdState(MAIN_PROJECT)
        }
      } catch {
        // Fallback to MAIN_PROJECT silently
        setActiveProjectIdState(MAIN_PROJECT)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  // If the current active project id is not present in the projects list, fallback to MAIN_PROJECT
  useEffect(() => {
    if (!projects || projects.length === 0) return
    const exists = projects.some(p => p.id === activeProjectId)
    if (!exists) {
      setActiveProjectIdState(MAIN_PROJECT)
    }
  }, [projects, activeProjectId])

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id)
    // Persist choice for next app launch
    userPreferencesService.setLastActiveProjectId(id).catch(() => { /* ignore */ })
  }, [])

  const getProjectById = useCallback((id: string) => {
    if (projects.length == 0) return undefined
    return projects.find(p => p.id === id)
  }, [projects])

  const activeProject: ProjectSpec | undefined = useMemo(() => {
    return getProjectById(activeProjectId)
  }, [projects, activeProjectId, getProjectById])

  const value = useMemo<ProjectContextValue>(() => ({
    activeProjectId,
    activeProject,
    setActiveProjectId,
    projects,
    getProjectById,
  }), [activeProjectId, activeProject, setActiveProjectId, projects, getProjectById])

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
    project: activeProject
  }
}
