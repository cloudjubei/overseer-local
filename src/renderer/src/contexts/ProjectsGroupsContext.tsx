import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type {
  ProjectsGroup,
  ProjectsGroups,
  ProjectsGroupUpdate,
  ReorderPayload,
  ProjectsGroupEditInput,
  ProjectsGroupCreateInput,
} from 'thefactory-tools'
import { projectsGroupsService } from '../services/projectsGroupsService'

export type ProjectsGroupsContextValue = {
  groups: ProjectsGroup[]

  // queries
  getGroupById: (id: string) => ProjectsGroup | undefined
  getGroupForProject: (projectId: string) => ProjectsGroup | undefined

  // mutations (groups)
  createGroup: (title: string) => Promise<ProjectsGroup | undefined>
  updateGroupTitle: (groupId: string, title: string) => Promise<ProjectsGroup | undefined>
  deleteGroup: (groupId: string) => Promise<void>

  // mutations (ordering)
  reorderProject: (groupId: string, payload: ReorderPayload) => Promise<ProjectsGroup | undefined>
  reorderGroup: (payload: ReorderPayload) => Promise<ProjectsGroups>

  // membership
  setProjectGroup: (projectId: string, groupId: string | null) => Promise<void>
}

const ProjectsGroupsContext = createContext<ProjectsGroupsContextValue | null>(null)

export function ProjectsGroupsProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<ProjectsGroups>([])

  const refresh = async () => {
    const all: ProjectsGroups = await projectsGroupsService.listProjectsGroups()
    setGroups(all)
  }

  const onGroupsUpdate = async (update: ProjectsGroupUpdate) => {
    // Single update stream that always provides full groups snapshot
    setGroups(update.groups)
  }

  useEffect(() => {
    const unsubscribe = projectsGroupsService.subscribe(onGroupsUpdate)
    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [])

  const getGroupById = useCallback(
    (id: string) => {
      if (!groups || groups.length === 0) return undefined
      return groups.find((g) => g.id === id)
    },
    [groups],
  )

  const getGroupForProject = useCallback(
    (projectId: string) => {
      if (!groups || groups.length === 0) return undefined
      return groups.find((g) => g.projects?.includes(projectId))
    },
    [groups],
  )

  const createGroup = async (title: string): Promise<ProjectsGroup | undefined> => {
    const input: ProjectsGroupCreateInput = { title }
    const created = await projectsGroupsService.createProjectsGroup(input)
    // optimistic: append if returned; otherwise force refresh
    if (created) {
      setGroups((prev) => [...prev, created])
    } else {
      refresh()
    }
    return created
  }

  const updateGroupTitle = async (
    groupId: string,
    title: string,
  ): Promise<ProjectsGroup | undefined> => {
    const patch: ProjectsGroupEditInput = { title }
    const updated = await projectsGroupsService.updateProjectsGroup(groupId, patch)
    if (updated) {
      setGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)))
    } else {
      refresh()
    }
    return updated ?? undefined
  }

  const deleteGroup = async (groupId: string): Promise<void> => {
    try {
      // Some backends may return the new list; ignore and refresh via subscribe
      // @ts-ignore allow flexible return type
      await projectsGroupsService.deleteProjectsGroup(groupId)
    } finally {
      // rely on subscription to update; fallback refresh
      setTimeout(() => refresh(), 0)
    }
  }

  const reorderProject = async (
    groupId: string,
    payload: ReorderPayload,
  ): Promise<ProjectsGroup | undefined> => {
    const newGroup = await projectsGroupsService.reorderProject(groupId, payload)
    if (newGroup) {
      setGroups((prev) => prev.map((g) => (g.id !== groupId ? g : newGroup)))
    } else {
      refresh()
    }
    return newGroup
  }

  const reorderGroup = async (payload: ReorderPayload): Promise<ProjectsGroups> => {
    const next = await projectsGroupsService.reorderGroup(payload)
    if (Array.isArray(next)) {
      setGroups(next)
      return next
    }
    // fallback: refresh and return current snapshot
    await refresh()
    return groups
  }

  // Move a project into a group (or remove from any group when groupId == null)
  const setProjectGroup = async (projectId: string, groupId: string | null): Promise<void> => {
    const current = groups.find((g) => g.projects?.includes(projectId))
    const target = groupId ? groups.find((g) => g.id === groupId) : undefined

    // if already in desired state, nothing to do
    if (!groupId && !current) return
    if (groupId && current?.id === groupId) return

    // Remove from current group if present
    if (current) {
      const newProjects = current.projects.filter((pid) => pid !== projectId)
      // send patch allowing 'projects' even if type doesn't include it
      await projectsGroupsService.updateProjectsGroup(
        current.id,
        // @ts-ignore allow projects field in patch
        { projects: newProjects } as any,
      )
    }

    // Add to target group if provided
    if (target) {
      const newProjects = [...(target.projects || []), projectId]
      await projectsGroupsService.updateProjectsGroup(
        target.id,
        // @ts-ignore allow projects field in patch
        { projects: newProjects } as any,
      )
    }

    // optimistic local update; subscription should reconcile
    setGroups((prev) => {
      let next = prev.map((g) =>
        g.id === current?.id
          ? { ...g, projects: g.projects.filter((pid) => pid !== projectId) }
          : g,
      )
      if (target) {
        next = next.map((g) => (g.id === target.id ? { ...g, projects: [...g.projects, projectId] } : g))
      }
      return next
    })
  }

  const value = useMemo<ProjectsGroupsContextValue>(
    () => ({
      groups,
      getGroupById,
      getGroupForProject,
      createGroup,
      updateGroupTitle,
      deleteGroup,
      reorderProject,
      reorderGroup,
      setProjectGroup,
    }),
    [groups, getGroupById, getGroupForProject],
  )

  return <ProjectsGroupsContext.Provider value={value}>{children}</ProjectsGroupsContext.Provider>
}

export function useProjectsGroups(): ProjectsGroupsContextValue {
  const ctx = useContext(ProjectsGroupsContext)
  if (!ctx) throw new Error('useProjectsGroups must be used within ProjectsGroupsProvider')
  return ctx
}

// Types reference (from thefactory-tools)
// export type ProjectsGroups = ProjectsGroup[];
// export interface ProjectsGroup {
//   id: string;
//   title: string;
//   projects: string[];
//   createdAt: string;
//   updatedAt: string;
// }
// export type ProjectsGroupCreateInput = Pick<ProjectsGroup, 'title'>;
// export type ProjectsGroupEditInput = Partial<ProjectsGroupCreateInput>;
// export type ProjectsGroupUpdateType = 'change';
// export type ProjectsGroupUpdate = { type: ProjectsGroupUpdateType; groups: ProjectsGroups };
// export interface ReorderPayload { fromIndex: number; toIndex: number }
