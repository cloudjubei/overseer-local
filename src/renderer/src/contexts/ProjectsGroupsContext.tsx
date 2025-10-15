import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ProjectsGroup, ProjectsGroups, ProjectsGroupUpdate, ReorderPayload } from 'thefactory-tools'
import { projectsGroupsService } from '../services/projectsGroupsService'

export const MAIN_GROUP = 'main'

export type ProjectsGroupsContextValue = {
  activeGroupId: string
  activeGroup?: ProjectsGroup

  groups: ProjectsGroup[]

  setActiveGroupId: (id: string) => void
  getGroupById: (id: string) => ProjectsGroup | undefined
  reorderProject: (groupId: string, payload: ReorderPayload) => Promise<ProjectsGroup | undefined>
  reorderGroup: (payload: ReorderPayload) => Promise<ProjectsGroup | undefined>
}

const ProjectsGroupsContext = createContext<ProjectsGroupsContextValue | null>(null)

export function ProjectsGroupsProvider({ children }: { children: React.ReactNode }) {
  const [activeGroupId, setActiveGroupIdState] = useState<string>(MAIN_GROUP)
  const [groups, setGroups] = useState<ProjectsGroup[]>([])

  // Load groups and subscribe to updates
  const update = async () => {
    const all: ProjectsGroups = await projectsGroupsService.listProjectsGroups()
    setGroups(all.groups)
  }

  const onGroupsUpdate = async (groupUpdate: ProjectsGroupUpdate) => {
    switch (groupUpdate.type) {
      case 'add': {
        const g = groupUpdate.group ?? (await projectsGroupsService.getProjectsGroup(groupUpdate.groupId))
        if (g) setGroups((prev) => [...prev, g])
        break
      }
      case 'delete': {
        setGroups((prev) => prev.filter((g) => g.id !== groupUpdate.groupId))
        break
      }
      case 'change': {
        const g = groupUpdate.group ?? (await projectsGroupsService.getProjectsGroup(groupUpdate.groupId))
        if (g) setGroups((prev) => prev.map((pg) => (pg.id !== groupUpdate.groupId ? pg : g)))
        break
      }
    }
  }

  useEffect(() => {
    const unsubscribe = projectsGroupsService.subscribe(onGroupsUpdate)
    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    update()
  }, [])

  useEffect(() => {
    if (!groups || groups.length === 0) return
    const exists = groups.some((g) => g.id === activeGroupId)
    if (!exists) {
      setActiveGroupIdState(MAIN_GROUP)
    }
  }, [groups, activeGroupId])

  const setActiveGroupId = useCallback((id: string) => {
    if (activeGroupId === id) return
    setActiveGroupIdState(id)
  }, [activeGroupId])

  const getGroupById = useCallback((id: string) => {
    if (groups.length === 0) return undefined
    return groups.find((g) => g.id === id)
  }, [groups])

  const activeGroup: ProjectsGroup | undefined = useMemo(() => {
    return getGroupById(activeGroupId)
  }, [groups, activeGroupId, getGroupById])

  const reorderProject = async (
    groupId: string,
    payload: ReorderPayload,
  ): Promise<ProjectsGroup | undefined> => {
    const newGroup = await projectsGroupsService.reorderProject(groupId, payload)
    if (newGroup) {
      setGroups((prev) => prev.map((g) => (g.id !== groupId ? g : newGroup)))
    }
    return newGroup
  }

  const reorderGroup = async (
    payload: ReorderPayload,
  ): Promise<ProjectsGroup | undefined> => {
    const updated = await projectsGroupsService.reorderGroup(payload)
    if (updated) {
      setGroups((prev) => prev.map((g) => (g.id !== updated.id ? g : updated)))
    }
    return updated
  }

  const value = useMemo<ProjectsGroupsContextValue>(
    () => ({
      activeGroupId,
      activeGroup,
      groups,
      setActiveGroupId,
      getGroupById,
      reorderProject,
      reorderGroup,
    }),
    [activeGroupId, activeGroup, groups, setActiveGroupId, getGroupById, reorderProject, reorderGroup],
  )

  return <ProjectsGroupsContext.Provider value={value}>{children}</ProjectsGroupsContext.Provider>
}

export function useProjectsGroups(): ProjectsGroupsContextValue {
  const ctx = useContext(ProjectsGroupsContext)
  if (!ctx) throw new Error('useProjectsGroups must be used within ProjectsGroupsProvider')
  return ctx
}
