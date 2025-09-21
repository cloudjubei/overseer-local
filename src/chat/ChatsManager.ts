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

const MESSAGES_TO_SEND = 10

type ChatConfig = any

export type LLMProviderType = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'local' | 'custom'

export type ChatRole = 'user' | 'assistant' | 'system'
export type ChatMessage = {
  role: ChatRole
  content: string
  model?: string
  attachments?: string[]
}
export type Chat = { id: string; messages: ChatMessage[]; creationDate: string; updateDate: string }

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
      const chatsDir = path.join(projectRoot, `${projectId}/chats`)
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
    handlers[IPC_HANDLER_KEYS.CHATS_CREATE] = async ({ projectId }) =>
      (await this.__getStorage(projectId))?.createChat()
    handlers[IPC_HANDLER_KEYS.CHATS_GET] = async ({ projectId, id }) =>
      (await this.__getStorage(projectId))?.getChat(id)
    handlers[IPC_HANDLER_KEYS.CHATS_DELETE] = async ({ projectId, chatId }) =>
      (await this.__getStorage(projectId))?.deleteChat(chatId)
    handlers[IPC_HANDLER_KEYS.CHATS_COMPLETION] = async ({
      projectId,
      chatId,
      newMessages,
      config,
    }) => this.getCompletion(projectId, chatId, newMessages, config)

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

  private async _constructSystemPrompt(projectId: string): Promise<string> {
    const project: any = await this.projectsManager.getProject(projectId as any)

    const parts = [
      'You are a helpful project assistant. Discuss stories, files, and related topics. Use tools to query project info. If user mentions @path, use read_file.  If user mentions #reference, use get_story_reference. You can create new files using write_file (use .md if it is a markdown note).',
    ]

    if (project) {
      parts.push(`\n#CURRENT PROJECT: ${project.name}`)
      if (project.description) {
        parts.push(`##DESCRIPTION:\n${project.description}`)
      }
    }

    return parts.join('\n')
  }

  async getCompletion(
    projectId: string,
    chatId: string,
    newMessages: ChatMessage[],
    config: ChatConfig,
  ): Promise<any> {
    try {
      const storage = await this.__getStorage(projectId)
      const chat: any = await storage?.getChat(chatId)
      if (!chat) throw new Error(`Couldn't load chat with chatId: ${chatId}`)

      const systemPromptContent = await this._constructSystemPrompt(projectId)
      const systemPrompt: ChatMessage = { role: 'system', content: systemPromptContent }

      let messagesHistory: ChatMessage[] = [...(chat.messages || []), ...(newMessages || [])]
      if (messagesHistory.length > MESSAGES_TO_SEND) {
        messagesHistory.splice(0, messagesHistory.length - MESSAGES_TO_SEND)
      }
      // Build provider messages with attachments folded into content for tool discovery
      const providerMessages = this._withAttachmentsAsMentions(messagesHistory)
      let currentMessages: ChatMessage[] = [systemPrompt, ...providerMessages]

      const repoRoot = this.projectRoot
      const appSettings: any = this.settingsManager.getAppSettings()
      const webSearchApiKeys = appSettings?.webSearchApiKeys
      const dbConnectionString = appSettings?.database?.connectionString

      const { tools, callTool } = buildChatTools({
        repoRoot,
        projectId,
        webSearchApiKeys,
        dbConnectionString,
      })
      const model = (config as any).model
      const completion = createCompletionClient(config as any)

      let rawResponses: string[] = []
      while (true) {
        const startedAt = new Date()
        const res: any = await completion({ model, messages: currentMessages, tools })
        const _durationMs = new Date().getTime() - startedAt.getTime()

        const agentResponse = parseAgentResponse(res.message.content) as any

        rawResponses.push(JSON.stringify(res.message))

        if (!agentResponse || !agentResponse.tool_calls || agentResponse.tool_calls.length === 0) {
          return await storage?.saveChat(
            chatId,
            [...(chat.messages || []), ...(newMessages || []), res.message],
            [...(chat.rawResponses ?? []), rawResponses],
          )
        }

        currentMessages.push(res.message)

        const toolOutputs: any[] = []
        for (const toolCall of agentResponse.tool_calls as ToolCall[]) {
          const toolName = toolCall.tool_name
          const args = normalizeTool(toolCall.arguments, toolName)

          const result = await callTool(toolName, args)
          toolOutputs.push({ name: toolName, result })
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
