import type {
  ProjectsGroup,
  ProjectsGroups,
  ReorderPayload,
  ProjectsGroupEditInput,
  ProjectsGroupCreateInput,
  ProjectsGroupUpdate,
} from 'thefactory-tools'

export type ProjectsGroupsService = {
  subscribe: (callback: (update: ProjectsGroupUpdate) => Promise<void>) => () => void
  listProjectsGroups: () => Promise<ProjectsGroups>
  getProjectsGroup: (groupId: string) => Promise<ProjectsGroup | undefined>
  createProjectsGroup: (input: ProjectsGroupCreateInput) => Promise<ProjectsGroup>
  updateProjectsGroup: (
    groupId: string,
    patch: ProjectsGroupEditInput,
  ) => Promise<ProjectsGroup | undefined>
  deleteProjectsGroup: (groupId: string) => Promise<void>
  reorderProject: (groupId: string, payload: ReorderPayload) => Promise<ProjectsGroup | undefined>
  reorderGroup: (payload: ReorderPayload) => Promise<ProjectsGroup | undefined>
}

export const projectsGroupsService: ProjectsGroupsService = { ...window.projectsGroupsService }
