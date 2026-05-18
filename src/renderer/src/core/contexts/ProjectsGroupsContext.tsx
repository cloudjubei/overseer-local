import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  createProjectsGroup,
  deleteProjectsGroup,
  listProjectsGroups,
  reorderProjectInGroup,
  reorderProjectsGroups,
  updateProjectsGroup,
  type CreateProjectsGroupData,
  type ListProjectsGroupsResponse,
  type UpdateProjectsGroupData,
} from '../../generated/backend'
import { useApi } from './ApiContext'
import { useAuth } from './AuthContext'

export type ProjectsGroup = ListProjectsGroupsResponse[number]
export type GroupType = ProjectsGroup['type']

export type ProjectsGroupsContextValue = {
  isLoaded: boolean
  loadError: Error | null
  groups: ProjectsGroup[]

  /** Active group selection — drives sidebar / GroupHomeView focus. */
  activeGroupId: string | null
  setActiveGroupId: (id: string | null) => void

  /** MAIN groups own a project exclusively; SCOPE groups can overlap. */
  getGroupById: (id: string) => ProjectsGroup | undefined
  getGroupForProject: (projectId: string) => ProjectsGroup | undefined
  getScopeGroupsForProject: (projectId: string) => ProjectsGroup[]

  createGroup: (input: CreateProjectsGroupData['body']) => Promise<ProjectsGroup>
  updateGroup: (id: string, patch: UpdateProjectsGroupData['body']) => Promise<ProjectsGroup>
  deleteGroup: (id: string) => Promise<void>
  /** Reorder one project within its MAIN group. */
  reorderProject: (groupId: string, fromIndex: number, toIndex: number) => Promise<void>
  /** Reorder the groups list itself. */
  reorderGroup: (fromIndex: number, toIndex: number) => Promise<void>

  refresh: () => Promise<void>
}

const ProjectsGroupsContext = createContext<ProjectsGroupsContextValue | null>(null)

export function ProjectsGroupsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const { ws } = useApi()
  const [groups, setGroups] = useState<ProjectsGroup[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const { data } = await listProjectsGroups({ throwOnError: true })
      setGroups(data)
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

  // The backend broadcasts updates whenever a group is created / mutated.
  useEffect(() => ws.on('projectsGroups:updated', () => void refresh()), [ws, refresh])

  const getGroupById = useCallback((id: string) => groups.find((g) => g.id === id), [groups])

  const getGroupForProject = useCallback(
    (projectId: string) => groups.find((g) => g.type !== 'SCOPE' && g.projects.includes(projectId)),
    [groups],
  )

  const getScopeGroupsForProject = useCallback(
    (projectId: string) =>
      groups.filter((g) => g.type === 'SCOPE' && g.projects.includes(projectId)),
    [groups],
  )

  const createGroup = useCallback<ProjectsGroupsContextValue['createGroup']>(
    async (input) => {
      const { data } = await createProjectsGroup({ body: input, throwOnError: true })
      await refresh()
      return data
    },
    [refresh],
  )

  const updateGroup = useCallback<ProjectsGroupsContextValue['updateGroup']>(
    async (id, patch) => {
      const { data } = await updateProjectsGroup({
        path: { id },
        body: patch,
        throwOnError: true,
      })
      await refresh()
      return data
    },
    [refresh],
  )

  const deleteGroup = useCallback(
    async (id: string) => {
      await deleteProjectsGroup({ path: { id }, throwOnError: true })
      if (activeGroupId === id) setActiveGroupId(null)
      await refresh()
    },
    [activeGroupId, refresh],
  )

  const reorderProject = useCallback(
    async (groupId: string, fromIndex: number, toIndex: number) => {
      await reorderProjectInGroup({
        path: { id: groupId },
        body: { fromIndex, toIndex },
        throwOnError: true,
      })
      await refresh()
    },
    [refresh],
  )

  const reorderGroup = useCallback(
    async (fromIndex: number, toIndex: number) => {
      await reorderProjectsGroups({ body: { fromIndex, toIndex }, throwOnError: true })
      await refresh()
    },
    [refresh],
  )

  const value = useMemo<ProjectsGroupsContextValue>(
    () => ({
      isLoaded,
      loadError,
      groups,
      activeGroupId,
      setActiveGroupId,
      getGroupById,
      getGroupForProject,
      getScopeGroupsForProject,
      createGroup,
      updateGroup,
      deleteGroup,
      reorderProject,
      reorderGroup,
      refresh,
    }),
    [
      isLoaded,
      loadError,
      groups,
      activeGroupId,
      getGroupById,
      getGroupForProject,
      getScopeGroupsForProject,
      createGroup,
      updateGroup,
      deleteGroup,
      reorderProject,
      reorderGroup,
      refresh,
    ],
  )

  return <ProjectsGroupsContext.Provider value={value}>{children}</ProjectsGroupsContext.Provider>
}

export function useProjectsGroups(): ProjectsGroupsContextValue {
  const ctx = useContext(ProjectsGroupsContext)
  if (!ctx) throw new Error('useProjectsGroups must be used within ProjectsGroupsProvider')
  return ctx
}
