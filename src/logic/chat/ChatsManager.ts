import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import type ProjectsManager from '../projects/ProjectsManager'
import type StoriesManager from '../stories/StoriesManager'
import { createCompletionClient, createChatsTools } from 'thefactory-tools'
import type {
  ChatMessage,
  ChatsTools,
  Chat,
  ChatContext,
  ChatCreateInput,
  ChatEditInput,
  ChatContextProject,
  ChatContextStory,
  ChatContextFeature,
  ChatContextAgentRun,
  ChatContextProjectTopic,
  CompletionMessage,
  LLMConfig,
} from 'thefactory-tools'
import { getSystemPrompt, defaultContextPrompts } from './promptTemplates'
import FactoryAgentRunManager from '../factory/FactoryAgentRunManager'
import BaseManager from '../BaseManager'

const MESSAGES_TO_SEND = 10

export default class ChatsManager extends BaseManager {
  private tools: ChatsTools
  private projectsManager: ProjectsManager
  private storiesManager: StoriesManager
  private factoryAgentRunManager: FactoryAgentRunManager

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    projectsManager: ProjectsManager,
    storiesManager: StoriesManager,
    factoryAgentRunManager: FactoryAgentRunManager,
  ) {
    super(projectRoot, window)

    this.projectsManager = projectsManager
    this.storiesManager = storiesManager
    this.factoryAgentRunManager = factoryAgentRunManager

    this.tools = createChatsTools(this.projectRoot)
  }

  async init(): Promise<void> {
    await this.tools.init()
    this.tools.subscribe(async (chatUpdate) => {
      if (this.window) {
        this.window.webContents.send(IPC_HANDLER_KEYS.CHATS_SUBSCRIBE, chatUpdate)
      }
    })
    await super.init()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.CHATS_COMPLETION] = async ({ context, newMessages, config }) =>
      this.getCompletion(context, newMessages, config)

    handlers[IPC_HANDLER_KEYS.CHATS_LIST] = async ({ projectId }) => this.listChats(projectId)
    handlers[IPC_HANDLER_KEYS.CHATS_CREATE] = async ({ input }) => this.createChat(input)
    handlers[IPC_HANDLER_KEYS.CHATS_GET] = async ({ context }) => this.getChat(context)
    handlers[IPC_HANDLER_KEYS.CHATS_UPDATE] = async ({ context, patch }) =>
      this.updateChat(context, patch)
    handlers[IPC_HANDLER_KEYS.CHATS_DELETE] = async ({ context }) => this.deleteChat(context)

    return handlers
  }

  private _withAttachmentsAsMentions(messages: CompletionMessage[]): CompletionMessage[] {
    // Transform messages with attachments into content that includes @path mentions
    return (messages || []).map((m) => {
      try {
        if (m && Array.isArray(m.files) && m.files.length) {
          const unique = Array.from(new Set(m.files.filter(Boolean)))
          const attachText = unique.map((p) => `@${p}`).join('\n')
          const sep = m.content && attachText ? '\n\n' : ''
          return {
            ...m,
            content: `${m.content || ''}${sep}Attached files:\n${attachText}`,
          }
        }
      } catch {}
      return m
    })
  }

  private async getContextPrompt(context: ChatContext): Promise<string> {
    switch (context.type) {
      case 'GENERAL':
        return 'GENERIC TODO' //TODO:
      case 'PROJECT': {
        const c = context as ChatContextProject
        const project = await this.projectsManager.getProject(c.projectId)
        return defaultContextPrompts.project
          .replace('@@project_title@@', project!.title)
          .replace('@@project_description@@', project!.description)
      }
      case 'STORY': {
        const c = context as ChatContextStory
        const project = await this.projectsManager.getProject(c.projectId)
        const story = await this.storiesManager.getStory(c.projectId, c.storyId)
        return defaultContextPrompts.story
          .replace('@@project_title@@', project!.title)
          .replace('@@project_description@@', project!.description)
          .replace('@@story_title@@', story!.title)
          .replace('@@story_description@@', story!.description)
      }
      case 'FEATURE': {
        const c = context as ChatContextFeature
        const project = await this.projectsManager.getProject(c.projectId)
        const story = await this.storiesManager.getStory(c.projectId, c.storyId)
        const feature = await this.storiesManager.getFeature(c.projectId, c.storyId, c.featureId)
        return defaultContextPrompts.feature
          .replace('@@project_title@@', project!.title)
          .replace('@@project_description@@', project!.description)
          .replace('@@story_title@@', story!.title)
          .replace('@@story_description@@', story!.description)
          .replace('@@feature_title@@', feature!.title)
          .replace('@@feature_description@@', feature!.description)
      }
      case 'AGENT_RUN': {
        const c = context as ChatContextAgentRun
        const project = await this.projectsManager.getProject(c.projectId)
        const story = await this.storiesManager.getStory(c.projectId, c.storyId)
        const agentRun = await this.factoryAgentRunManager.getRun(c.agentRunId)
        const conversations = agentRun!.conversations.map((c) => c.messages)
        return defaultContextPrompts.agentRun
          .replace('@@project_title@@', project!.title)
          .replace('@@project_description@@', project!.description)
          .replace('@@story_title@@', story!.title)
          .replace('@@story_description@@', story!.description)
          .replace('@@agent_type@@', agentRun!.agentType)
          .replace('@@agent_conversations@@', JSON.stringify(conversations))
      }
      case 'PROJECT_TOPIC': {
        const c = context as ChatContextProjectTopic
        const project = await this.projectsManager.getProject(c.projectId)
        const topic = c.projectTopic
        return defaultContextPrompts.projectTopic
          .replace('@@project_title@@', project!.title)
          .replace('@@project_description@@', project!.description)
          .replace('@@project_topic@@', topic)
      }
    }
    return 'UNKNOWN CONTEXT'
  }

  async getDefaultPrompt(context: ChatContext): Promise<string> {
    const contextPrompt = await this.getContextPrompt(context)
    return getSystemPrompt({ additionalContext: contextPrompt })
  }

  async listChats(projectId?: string): Promise<Chat[]> {
    return await this.tools.listChats(projectId)
  }
  async getChat(context: ChatContext): Promise<Chat> {
    return await this.tools.getChat(context)
  }
  async createChat(input: ChatCreateInput): Promise<Chat> {
    return await this.tools.createChat(input)
  }
  async updateChat(context: ChatContext, patch: ChatEditInput): Promise<Chat | undefined> {
    return await this.tools.updateChat(context, patch)
  }
  async deleteChat(context: ChatContext): Promise<void> {
    return await this.tools.deleteChat(context)
  }

  async getCompletion(
    context: ChatContext,
    newMessages: ChatMessage[],
    config: LLMConfig,
  ): Promise<any> {
    try {
      const chat = await this.getChat(context)
      if (!chat)
        throw new Error(`Couldn't load chat for the given context: ${JSON.stringify(context)}`)

      let messagesHistory: CompletionMessage[] = [
        ...(chat.messages.map((m) => m.completionMesage) || []),
        ...(newMessages.map((m) => m.completionMesage) || []),
      ]
      if (messagesHistory.length > MESSAGES_TO_SEND) {
        messagesHistory.splice(0, messagesHistory.length - MESSAGES_TO_SEND)
      }
      const providerMessages = this._withAttachmentsAsMentions(messagesHistory)
      const systemPrompt = await this.getDefaultPrompt(context)
      let currentMessages: CompletionMessage[] = [
        { role: 'system', content: systemPrompt },
        ...providerMessages,
      ]

      const { model, provider } = config
      const completion = createCompletionClient(config, false)

      const res = await completion({ model, messages: currentMessages })

      const message: ChatMessage = { completionMesage: res.message, model: { model, provider } }
      await this.tools.addChatMessages(context, [message])

      //TODO: thefactory-tools needs to provide a way of orchestrating a multi-tool completion turn
    } catch (error: any) {
      const details = [
        error?.message,
        error?.response?.data ? JSON.stringify(error.response.data) : null,
        error?.cause?.message || null,
      ]
        .filter(Boolean)
        .join('\n')
      console.error('Error in chat completion:', details)
      throw new Error('Failed to get completion and save error state.')
    }
  }
}
