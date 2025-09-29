import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ProjectSpec, ProjectUpdate, ReorderPayload } from 'thefactory-tools'
import { projectsService } from '../services/projectsService'
import { useAppSettings } from '../contexts/AppSettingsContext'

export const MAIN_PROJECT = 'main'

export type ProjectContextValue = {
  activeProjectId: string
  activeProject?: ProjectSpec

  projects: ProjectSpec[]

  setActiveProjectId: (id: string) => void
  getProjectById: (id: string) => ProjectSpec | undefined
  reorderStory: (projectId: string, payload: ReorderPayload) => Promise<ProjectSpec | undefined>
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const { isAppSettingsLoaded, appSettings, setUserPreferences } = useAppSettings()
  const [initialLoad, setInitialLoad] = useState(true)
  const [activeProjectId, setActiveProjectIdState] = useState<string>(MAIN_PROJECT)
  const [projects, setProjects] = useState<ProjectSpec[]>([])

  // Load projects and subscribe to updates
  const update = async () => {
    const projects = await projectsService.listProjects()
    setProjects(projects)
  }
  const onProjectUpdate = async (projectUpdate: ProjectUpdate) => {
    switch (projectUpdate.type) {
      case 'add':
        const p =
          projectUpdate.project ?? (await projectsService.getProject(projectUpdate.projectId))
        if (p) {
          setProjects((prev) => [...prev, p])
        }
        break
      case 'delete':
        setProjects((prev) => prev.filter((p) => p.id !== projectUpdate.projectId))
        break
      case 'change':
        const p2 =
          projectUpdate.project ?? (await projectsService.getProject(projectUpdate.projectId))
        if (p2) {
          setProjects((prev) => prev.map((p) => (p.id !== projectUpdate.projectId ? p : p2)))
        }
        break
    }
  }
  useEffect(() => {
    const unsubscribe = projectsService.subscribe(onProjectUpdate)
    return () => {
      unsubscribe()
    }
  }, [onProjectUpdate])
  useEffect(() => {
    update()
  }, [])

  useEffect(() => {
    if (appSettings && initialLoad) {
      if (appSettings.userPreferences.lastActiveProjectId) {
        setActiveProjectIdState(appSettings.userPreferences.lastActiveProjectId)
      } else {
        setActiveProjectIdState(MAIN_PROJECT)
      }
      setInitialLoad(false)
    }
  }, [appSettings])

  useEffect(() => {
    if (!projects || projects.length === 0) return
    const exists = projects.some((p) => p.id === activeProjectId)
    if (!exists) {
      setActiveProjectIdState(MAIN_PROJECT)
    }
  }, [projects, activeProjectId])

  const setActiveProjectId = useCallback(
    (id: string) => {
      if (activeProjectId == id) {
        return
      }
      setActiveProjectIdState(id)

      if (isAppSettingsLoaded) {
        setUserPreferences({ lastActiveProjectId: id })
      }
    },
    [activeProjectId, isAppSettingsLoaded, setUserPreferences],
  )

  const getProjectById = useCallback(
    (id: string) => {
      if (projects.length == 0) return undefined
      return projects.find((p) => p.id === id)
    },
    [projects],
  )

  const activeProject: ProjectSpec | undefined = useMemo(() => {
    return getProjectById(activeProjectId)
  }, [projects, activeProjectId, getProjectById])

  const reorderStory = async (
    projectId: string,
    payload: ReorderPayload,
  ): Promise<ProjectSpec | undefined> => {
    const newProject = await projectsService.reorderStory(projectId, payload)
    if (newProject) {
      setProjects((prev) => prev.map((p) => (p.id !== projectId ? p : newProject)))
    }
    return newProject
  }

  const value = useMemo<ProjectContextValue>(
    () => ({
      activeProjectId,
      activeProject,
      setActiveProjectId,
      projects,
      getProjectById,
      reorderStory,
    }),
    [activeProjectId, activeProject, setActiveProjectId, projects, getProjectById, reorderStory],
  )

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
  }
}
