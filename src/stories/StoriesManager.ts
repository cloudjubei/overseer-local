import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import BaseManager from '../BaseManager'
import type ProjectsManager from '../projects/ProjectsManager'
import {
  createStoryTools,
  Feature,
  FeatureCreateInput,
  FeatureEditInput,
  ProjectSpec,
  ReorderPayload,
  Story,
  StoryCreateInput,
  StoryEditInput,
  StoryTools,
} from 'thefactory-tools'

export default class StoriesManager extends BaseManager {
  private tools: Record<string, StoryTools>

  private projectsManager: ProjectsManager

  constructor(projectRoot: string, window: BrowserWindow, projectsManager: ProjectsManager) {
    super(projectRoot, window)
    this.tools = {}

    this.projectsManager = projectsManager
  }

  async init(): Promise<void> {
    await this.__getTools('main')

    await super.init()
  }

  private async __getTools(projectId: string): Promise<StoryTools | undefined> {
    if (!this.tools[projectId]) {
      const projectRoot = await this.projectsManager.getProjectDir(projectId)
      if (!projectRoot) {
        return
      }

      this.tools[projectId] = createStoryTools(projectRoot)
    }
    return this.tools[projectId]
  }

  private __notify(msg: string) {
    if (msg) console.log(msg) //TODO: change into a logger
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.STORIES_SUBSCRIBE)
    }
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.STORIES_LIST] = ({ projectId }) => this.listStories(projectId)
    handlers[IPC_HANDLER_KEYS.STORIES_GET] = ({ projectId, storyId }) =>
      this.getStory(projectId, storyId)
    handlers[IPC_HANDLER_KEYS.STORIES_CREATE] = ({ projectId, input }) =>
      this.createStory(projectId, input)
    handlers[IPC_HANDLER_KEYS.STORIES_UPDATE] = ({ projectId, storyId, patch }) =>
      this.updateStory(projectId, storyId, patch)
    handlers[IPC_HANDLER_KEYS.STORIES_DELETE] = ({ projectId, storyId }) =>
      this.deleteStory(projectId, storyId)
    handlers[IPC_HANDLER_KEYS.STORIES_FEATURE_GET] = ({ projectId, storyId, featureId }) =>
      this.getFeature(projectId, storyId, featureId)
    handlers[IPC_HANDLER_KEYS.STORIES_FEATURE_ADD] = ({ projectId, storyId, input }) =>
      this.addFeature(projectId, storyId, input)
    handlers[IPC_HANDLER_KEYS.STORIES_FEATURE_UPDATE] = ({
      projectId,
      storyId,
      featureId,
      patch,
    }) => this.updateFeature(projectId, storyId, featureId, patch)
    handlers[IPC_HANDLER_KEYS.STORIES_FEATURE_DELETE] = ({ projectId, storyId, featureId }) =>
      this.deleteFeature(projectId, storyId, featureId)
    handlers[IPC_HANDLER_KEYS.STORIES_FEATURES_REORDER] = async ({ projectId, storyId, payload }) =>
      this.reorderFeatures(projectId, storyId, payload)

    return handlers
  }

  async listStories(projectId: string): Promise<Story[]> {
    const tools = await this.__getTools(projectId)
    return (await tools?.listStories()) ?? []
  }
  async getStory(projectId: string, storyId: string): Promise<Story | undefined> {
    const tools = await this.__getTools(projectId)
    if (tools) {
      return tools.getStory(storyId)
    }
  }
  async createStory(projectId: string, storyData: StoryCreateInput): Promise<Story | undefined> {
    const project = await this.projectsManager.getProject(projectId)
    if (!project) {
      return
    }
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }

    const newStory = await tools.createStory(storyData)

    const newProject = { ...project }
    newProject.storyIdToDisplayIndex[newStory.id] =
      Object.keys(newProject.storyIdToDisplayIndex).length + 1
    await this.projectsManager.updateProject(project.id, newProject)
    this.__notify(`New story added: ${newStory.id} : ${newStory.title}`)
    return newStory
  }
  async updateStory(
    projectId: string,
    storyId: string,
    patch: StoryEditInput,
  ): Promise<Story | undefined> {
    const tools = await this.__getTools(projectId)
    if (tools) {
      const t = await tools.updateStory(storyId, patch)
      if (t) {
        this.__notify(`Story updated: ${t.id}`)
      }
      return t
    }
  }

  async deleteStory(projectId: string, storyId: string): Promise<ProjectSpec | undefined> {
    const project = await this.projectsManager.getProject(projectId)
    if (!project) {
      return
    }
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    await tools.deleteStory(storyId)

    const newProject = { ...project }
    const index = newProject.storyIdToDisplayIndex[storyId]
    delete newProject.storyIdToDisplayIndex[storyId]
    for (const key of Object.keys(newProject.storyIdToDisplayIndex)) {
      if (newProject.storyIdToDisplayIndex[key] > index) {
        newProject.storyIdToDisplayIndex[key] = newProject.storyIdToDisplayIndex[key] - 1
      }
    }
    await this.projectsManager.updateProject(projectId, newProject)
    this.__notify('Story was deleted')
    return newProject
  }

  async getFeature(
    projectId: string,
    storyId: string,
    featureId: string,
  ): Promise<Feature | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    return await tools.getFeature(storyId, featureId)
  }
  async addFeature(
    projectId: string,
    storyId: string,
    input: FeatureCreateInput,
  ): Promise<Story | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    const t = await tools.addFeature(storyId, input)
    if (t) {
      this.__notify(`New feature added to story: ${t.id}`)
    }
    return t
  }
  async updateFeature(
    projectId: string,
    storyId: string,
    featureId: string,
    patch: FeatureEditInput,
  ): Promise<Story | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    const t = await tools.updateFeature(storyId, featureId, patch)
    if (t) {
      this.__notify(`Feature: ${featureId} updated in story: ${t.id}`)
    }
    return t
  }
  async deleteFeature(
    projectId: string,
    storyId: string,
    featureId: string,
  ): Promise<Story | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    const t = await tools.deleteFeature(storyId, featureId)
    if (t) {
      this.__notify(`Feature delete from story: ${t.id}`)
    }
    return t
  }
  async reorderFeatures(
    projectId: string,
    storyId: string,
    payload: ReorderPayload,
  ): Promise<Story | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    const t = await tools.reorderFeatures(storyId, payload)
    if (t) {
      this.__notify(`Features reordered in story: ${t.id}`)
    }
    return t
  }
}
