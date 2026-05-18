import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import type ProjectsManager from '../projects/ProjectsManager'
import {
  createStoryTools,
  Feature,
  FeatureCreateInput,
  FeatureEditInput,
  ReorderPayload,
  Story,
  StoryChangeHandler,
  StoryCreateInput,
  StoryEditInput,
  StoryTools,
} from 'thefactory-tools'
import Mutex from '../utils/Mutex'
import BaseManager from '../BaseManager'

export default class StoriesManager extends BaseManager {
  private toolsLock = new Mutex()
  private tools: Record<string, StoryTools> = {}

  private projectsManager: ProjectsManager

  constructor(projectRoot: string, window: BrowserWindow, projectsManager: ProjectsManager) {
    super(projectRoot, window)

    this.projectsManager = projectsManager
  }

  async init(): Promise<void> {
    await super.init()
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
    handlers[IPC_HANDLER_KEYS.STORIES_GET_ORDER] = async ({ projectId }) =>
      this.getStoriesOrder(projectId)
    handlers[IPC_HANDLER_KEYS.STORIES_REORDER] = async ({ projectId, payload }) =>
      this.reorderStory(projectId, payload)
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
    handlers[IPC_HANDLER_KEYS.STORIES_FEATURE_REORDER] = async ({ projectId, storyId, payload }) =>
      this.reorderFeature(projectId, storyId, payload)

    return handlers
  }

  async getTools(projectId: string): Promise<StoryTools | undefined> {
    await this.toolsLock.lock()
    try {
      if (!this.tools[projectId]) {
        // Catch per-project failures (missing dir, watcher init error, …)
        // so the lock is still released. Without this, a single bad
        // project freezes every subsequent getTools call across the app
        // — including the ones for healthy projects — and stories
        // silently fail to load for everyone after the first.
        try {
          await this.updateTool(projectId)
        } catch (e) {
          console.error(
            `StoriesManager.updateTool failed for project ${projectId}`,
            (e as Error)?.message ?? e,
          )
        }
      }
      return this.tools[projectId]
    } finally {
      this.toolsLock.unlock()
    }
  }

  async listStories(projectId: string): Promise<Story[]> {
    const tools = await this.getTools(projectId)
    return (await tools?.listStories()) ?? []
  }
  async getStory(projectId: string, storyId: string): Promise<Story | undefined> {
    const tools = await this.getTools(projectId)
    return tools?.getStory(storyId)
  }
  async createStory(projectId: string, storyData: StoryCreateInput): Promise<Story | undefined> {
    const tools = await this.getTools(projectId)
    if (!tools) return

    return await tools.addStory(storyData)
  }
  async updateStory(
    projectId: string,
    storyId: string,
    patch: StoryEditInput,
  ): Promise<Story | undefined> {
    const tools = await this.getTools(projectId)
    return await tools?.updateStory(storyId, patch)
  }

  async deleteStory(projectId: string, storyId: string) {
    const tools = await this.getTools(projectId)
    if (!tools) return

    await tools.deleteStory(storyId)
  }

  async getStoriesOrder(projectId: string): Promise<string[] | undefined> {
    const tools = await this.getTools(projectId)
    if (!tools) return
    return await tools.getStoriesOrder()
  }
  async reorderStory(projectId: string, payload: ReorderPayload): Promise<string[] | undefined> {
    const tools = await this.getTools(projectId)
    if (!tools) return
    return await tools.reorderStory(payload)
  }

  async getFeature(
    projectId: string,
    storyId: string,
    featureId: string,
  ): Promise<Feature | undefined> {
    const tools = await this.getTools(projectId)
    if (!tools) return
    return await tools.getFeature(storyId, featureId)
  }
  async addFeature(
    projectId: string,
    storyId: string,
    input: FeatureCreateInput,
  ): Promise<Story | undefined> {
    const tools = await this.getTools(projectId)
    if (!tools) return
    return await tools.addFeature(storyId, input)
  }
  async updateFeature(
    projectId: string,
    storyId: string,
    featureId: string,
    patch: FeatureEditInput,
  ): Promise<Story | undefined> {
    const tools = await this.getTools(projectId)
    if (!tools) return
    return await tools.updateFeature(storyId, featureId, patch)
  }
  async deleteFeature(
    projectId: string,
    storyId: string,
    featureId: string,
  ): Promise<Story | undefined> {
    const tools = await this.getTools(projectId)
    if (!tools) return
    return await tools.deleteFeature(storyId, featureId)
  }
  async reorderFeature(
    projectId: string,
    storyId: string,
    payload: ReorderPayload,
  ): Promise<Story | undefined> {
    const tools = await this.getTools(projectId)
    if (!tools) return
    return await tools.reorderFeature(storyId, payload)
  }

  async addChangeHandler(projectId: string, handler: StoryChangeHandler): Promise<void> {
    const tools = await this.getTools(projectId)
    if (!tools) return
    tools.subscribe(handler)
  }

  private async updateTool(projectId: string): Promise<StoryTools | undefined> {
    // `getProjectStoriesRoot` resolves `dataLocation` correctly: for
    // `'central'` projects it returns the overseer's central root (where
    // stories actually live), not the project's source-code path. Using
    // `getProjectDir` here was the bug — `central` projects had their
    // StoryTools watcher pointing at `<sourceRepo>/projects/<id>/stories`
    // (which doesn't exist), so `listStories` returned `[]` for every
    // non-active project, and the renderer's All-Projects views were
    // missing all but the first project's stories.
    const storiesRoot = await this.projectsManager.getProjectStoriesRoot(projectId)
    if (!storiesRoot) return

    const tools = createStoryTools(projectId, storiesRoot)
    await tools.init()

    this.tools[projectId] = tools

    tools.subscribe(async (storyUpdate) => {
      if (this.window) {
        this.window.webContents.send(IPC_HANDLER_KEYS.STORIES_SUBSCRIBE, storyUpdate)
      }
    })
    return tools
  }
}
