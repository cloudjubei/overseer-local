import type { BrowserWindow } from 'electron'
import path from 'path'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import ChatsStorage from './ChatsStorage'
import BaseManager from '../BaseManager'
import type ProjectsManager from '../projects/ProjectsManager'
import type StoriesManager from '../stories/StoriesManager'
import type FilesManager from '../files/FilesManager'
import type SettingsManager from '../settings/SettingsManager'
import {
  buildChatTools,
  createCompletionClient,
  parseAgentResponse,
  normalizeTool,
  ToolCall,
} from 'thefactory-tools'
import { getSystemPrompt, defaultContextPrompts } from './promptTemplates'

const MESSAGES_TO_SEND = 10

type ChatConfig = any

export type LLMProviderType = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'local' | 'custom'

export type ChatRole = 'user' | 'assistant' | 'system'
export type ChatMessage = {
  role: ChatRole
  content: string
  model?: string
  attachments?: string[]
  error?: {
    message: string
  }
}

export type ChatContext = {
  projectId: string
  storyId?: string
  featureId?: string
  type?: 'tests' | 'agents' | 'project'
}

export type ChatSettings = {
  model?: string
  autoToolCall?: boolean
  allowedTools?: string[]
  prompt?: string
}

export type Chat = {
  id: string
  messages: ChatMessage[]
  creationDate: string
  updateDate: string
  settings?: ChatSettings
}

export default class ChatsManager extends BaseManager {
  private storages: Record<string, ChatsStorage>

  private projectsManager: ProjectsManager
  private storiesManager: StoriesManager
  private filesManager: FilesManager
  private settingsManager: SettingsManager

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    projectsManager: ProjectsManager,
    storiesManager: StoriesManager,
    filesManager: FilesManager,
    settingsManager: SettingsManager,
  ) {
    super(projectRoot, window)
    this.storages = {}

    this.projectsManager = projectsManager
    this.storiesManager = storiesManager
    this.filesManager = filesManager
    this.settingsManager = settingsManager
  }

  private async __getStorage(projectId: string): Promise<ChatsStorage | undefined> {
    if (!this.storages[projectId]) {
      const projectRoot = await this.projectsManager.getProjectDir(projectId)
      if (!projectRoot) {
        return
      }
      const chatsDir = path.join(projectRoot, '.factory', 'chats')
      const storage = new ChatsStorage(projectId, chatsDir, this.window)
      await storage.init()
      this.storages[projectId] = storage
    }
    return this.storages[projectId]
  }

  async init(): Promise<void> {
    await this.__getStorage('main')
    await super.init()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.CHATS_LIST_MODELS] = async ({ config }) =>
      await this.listModels(config)
    handlers[IPC_HANDLER_KEYS.CHATS_LIST] = async ({ projectId }) =>
      (await this.__getStorage(projectId))?.listChats()
    handlers[IPC_HANDLER_KEYS.CHATS_CREATE] = async ({ context }) =>
      this.createChat(context)
    handlers[IPC_HANDLER_KEYS.CHATS_GET] = async ({ context }) =>
      (await this.__getStorage(context.projectId))?.getChat(context)
    handlers[IPC_HANDLER_KEYS.CHATS_DELETE] = async ({ context }) =>
      (await this.__getStorage(context.projectId))?.deleteChat(context)
    handlers[IPC_HANDLER_KEYS.CHATS_COMPLETION] = async ({
      context,
      newMessages,
      config,
    }) => this.getCompletion(context, newMessages, config)
    handlers[IPC_HANDLER_KEYS.CHATS_GET_DEFAULT_PROMPT] = async ({ context }) =>
      this.getDefaultPrompt(context)
    handlers[IPC_HANDLER_KEYS.CHATS_SAVE_PROMPT] = async ({ context, prompt }) =>
      this.savePrompt(context, prompt)

    return handlers
  }

  private _withAttachmentsAsMentions(messages: ChatMessage[]): ChatMessage[] {
    // Transform messages with attachments into content that includes @path mentions
    return (messages || []).map((m) => {
      try {
        if (m && Array.isArray(m.attachments) && m.attachments.length) {
          const unique = Array.from(new Set(m.attachments.filter(Boolean)))
          const attachText = unique.map((p) => `@${p}`).join('\n')
          const sep = m.content && attachText ? '\n\n' : ''
          return { ...m, content: `${m.content || ''}${sep}Attached files:\n${attachText}` }
        }
      } catch {}
      return m
    })
  }

  private async _constructSystemPrompt(context: ChatContext): Promise<string> {
    const chat = await (await this.__getStorage(context.projectId))?.getChat(context)
    if (chat?.settings?.prompt) {
      return chat.settings.prompt
    }
    return this.getDefaultPrompt(context)
  }

  private async getDefaultPrompt(context: ChatContext): Promise<string> {
    const project: any = await this.projectsManager.getProject(context.projectId as any)

    const parts = []
    let basePrompt = defaultContextPrompts.project

    if (context.featureId) {
      basePrompt = defaultContextPrompts.feature
    } else if (context.storyId) {
      basePrompt = defaultContextPrompts.story
    } else if (context.type) {
      basePrompt = defaultContextPrompts[context.type]
    }

    parts.push(basePrompt)

    if (project) {
      parts.push(`\n#CURRENT PROJECT: ${project.name}`)
      if (project.description) {
        parts.push(`##DESCRIPTION:\n${project.description}`)
      }
    }

    // TODO: Add more context based on storyId, featureId, etc.

    return getSystemPrompt({ additionalContext: parts.join('\n') })
  }

  async savePrompt(context: ChatContext, prompt: string): Promise<{ ok: true }> {
    const storage = await this.__getStorage(context.projectId)
    if (!storage) throw new Error('Could not get storage for project')

    const chat = await storage.getChat(context)
    if (!chat) throw new Error('Chat not found')

    const newSettings = { ...(chat.settings || {}), prompt }
    return await storage.saveChat(context, chat.messages, (chat as any).rawResponses, newSettings)
  }

  private async _ensureSystemSeeded(storage: ChatsStorage, chat: Chat, context: ChatContext) {
    if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) {
      try {
        const systemPromptContent = await this._constructSystemPrompt(context)
        const systemPrompt: ChatMessage = { role: 'system', content: systemPromptContent }
        await storage.saveChat(context, [systemPrompt], chat && (chat as any).rawResponses, chat.settings)
      } catch (e) {
        // best effort: do not block chat creation
      }
    }
  }

  private async createChat(context: ChatContext): Promise<Chat | undefined> {
    const storage = await this.__getStorage(context.projectId)
    if (!storage) return undefined

    // Check if chat already exists, if so return it
    const existingChat = await storage.getChat(context)
    if (existingChat) return existingChat

    const chat = await storage.createChat(context)
    // Seed system prompt as first message
    await this._ensureSystemSeeded(storage, chat as Chat, context)
    return chat
  }

  async getCompletion(
    context: ChatContext,
    newMessages: ChatMessage[],
    config: ChatConfig,
  ): Promise<any> {
    const storage = await this.__getStorage(context.projectId)
    if (!storage) throw new Error('Could not get storage for project')

    try {
      const chat: any = await storage?.getChat(context)
      if (!chat) throw new Error(`Couldn't load chat for the given context: ${JSON.stringify(context)}`)

      const systemPromptContent = await this._constructSystemPrompt(context)
      const systemPrompt: ChatMessage = { role: 'system', content: systemPromptContent }

      let messagesHistory: ChatMessage[] = [...(chat.messages || []), ...(newMessages || [])]
      if (messagesHistory.length > MESSAGES_TO_SEND) {
        messagesHistory.splice(0, messagesHistory.length - MESSAGES_TO_SEND)
      }
      // Build provider messages with attachments folded into content for tool discovery
      const providerMessages = this._withAttachmentsAsMentions(messagesHistory)
      let currentMessages: ChatMessage[] = [systemPrompt, ...providerMessages]

      const repoRoot = this.projectRoot
      const appSettings = this.settingsManager.getAppSettings()
      const webSearchApiKeys = appSettings?.webSearchApiKeys
      const dbConnectionString = appSettings?.database?.connectionString

      const { tools, callTool } = buildChatTools({
        repoRoot,
        projectId: context.projectId,
        webSearchApiKeys,
        dbConnectionString,
      })
      const model = config.model
      const completion = createCompletionClient(config, false)

      let rawResponses: string[] = []
      while (true) {
        const startedAt = new Date()
        const res = await completion({ model, messages: currentMessages, tools })
        const _durationMs = new Date().getTime() - startedAt.getTime()

        const agentResponse = parseAgentResponse(res.message.content) as any

        rawResponses.push(JSON.stringify(res.message))

        if (!agentResponse || !agentResponse.tool_calls || agentResponse.tool_calls.length === 0) {
          const newSettings = { ...(chat.settings || {}), ...config }
          return await storage?.saveChat(
            context,
            [...(chat.messages || []), ...(newMessages || []), res.message],
            [...(chat.rawResponses ?? []), rawResponses],
            newSettings,
          )
        }

        currentMessages.push(res.message)

        const toolOutputs: any[] = []
        for (const toolCall of agentResponse.tool_calls as ToolCall[]) {
          const toolName = toolCall.tool_name
          const args = normalizeTool(toolCall.arguments, toolName)

          const t0 = Date.now()
          const result = await callTool(toolName, args)
          const durationMs = Date.now() - t0
          toolOutputs.push({ name: toolName, result, durationMs })
        }
        const content = JSON.stringify(toolOutputs)
        const toolResultMsg: ChatMessage = { role: 'user', content }
        currentMessages.push(toolResultMsg)
      }
    } catch (error: any) {
      const details = [
        error?.message,
        error?.response?.data ? JSON.stringify(error.response.data) : null,
        error?.cause?.message || null,
      ]
        .filter(Boolean)
        .join('\n')
      console.error('Error in chat completion:', details)

      if (storage) {
        const chat: any = await storage.getChat(context)
        if (chat) {
          const errorMessage: ChatMessage = {
            role: 'assistant',
            content: `An error occurred while processing your request.`,
            error: {
              message: details,
            },
          }
          return await storage.saveChat(
            context,
            [...(chat.messages || []), ...(newMessages || []), errorMessage],
            chat.rawResponses ?? [],
            chat.settings,
          )
        }
      }

      throw new Error('Failed to get completion and save error state.')
    }
  }

  async listModels(_config?: ChatConfig): Promise<string[]> {
    try {
      return []
    } catch (error) {
      throw error
    }
  }
}
