import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type {
  ProjectsGroup,
  ProjectsGroups,
  ProjectsGroupUpdate,
  ReorderPayload,
} from 'thefactory-tools'
import { projectsGroupsService } from '../services/projectsGroupsService'

export type ProjectsGroupsContextValue = {
  groups: ProjectsGroup[]

  getGroupById: (id: string) => ProjectsGroup | undefined
  reorderProject: (groupId: string, payload: ReorderPayload) => Promise<ProjectsGroup | undefined>
  reorderGroup: (payload: ReorderPayload) => Promise<ProjectsGroups>
}

const ProjectsGroupsContext = createContext<ProjectsGroupsContextValue | null>(null)

export function ProjectsGroupsProvider({ children }: { children: React.ReactNode }) {
  const [groups, setGroups] = useState<ProjectsGroups>([])

  const update = async () => {
    const all: ProjectsGroups = await projectsGroupsService.listProjectsGroups()
    setGroups(all)
  }

  const onGroupsUpdate = async (update: ProjectsGroupUpdate) => {
    switch (update.type) {
      // case 'change':
      default: {
        setGroups(update.groups)
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

  const getGroupById = useCallback(
    (id: string) => {
      if (groups.length === 0) return undefined
      return groups.find((g) => g.id === id)
    },
    [groups],
  )

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

  const reorderGroup = async (payload: ReorderPayload): Promise<ProjectsGroups> => {
    const groups = await projectsGroupsService.reorderGroup(payload)
    setGroups(groups)
    return groups
  }

  const value = useMemo<ProjectsGroupsContextValue>(
    () => ({
      groups,
      getGroupById,
      reorderProject,
      reorderGroup,
    }),
    [groups, getGroupById, reorderProject, reorderGroup],
  )

  return <ProjectsGroupsContext.Provider value={value}>{children}</ProjectsGroupsContext.Provider>
}

export function useProjectsGroups(): ProjectsGroupsContextValue {
  const ctx = useContext(ProjectsGroupsContext)
  if (!ctx) throw new Error('useProjectsGroups must be used within ProjectsGroupsProvider')
  return ctx
}

// export type ProjectsGroups = ProjectsGroup[];
// export interface ProjectsGroup {
//     id: string;
//     title: string;
//     projects: string[];
//     createdAt: string;
//     updatedAt: string;
// }
// export interface ProjectsGroup {
//     id: string;
//     title: string;
//     projects: string[];
//     createdAt: string;
//     updatedAt: string;
// }
// export type ProjectsGroupCreateInput = Pick<ProjectsGroup, 'title'>;
// export type ProjectsGroupEditInput = Partial<ProjectsGroupCreateInput>;
// export type ProjectsGroupUpdateType = 'change';
// export type ProjectsGroupUpdate = {
//     type: ProjectsGroupUpdateType;
//     groups: ProjectsGroups;
// };
// export type ProjectsGroupChangeHandler = (update: ProjectsGroupUpdate) => Promise<void>;
// export interface ReorderPayload {
//     fromIndex: number;
//     toIndex: number;
// }
