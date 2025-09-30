import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import { createCompletionClient, createChatsTools } from 'thefactory-tools'
import type {
  ChatMessage,
  ChatsTools,
  Chat,
  ChatContext,
  ChatCreateInput,
  ChatEditInput,
  CompletionMessage,
  LLMConfig,
  ChatSettings,
  ChatsSettings,
  ChatContextArguments,
} from 'thefactory-tools'
import BaseManager from '../BaseManager'
import { getDefaultChatPrompt } from 'thefactory-tools/utils'

const MESSAGES_TO_SEND = 10

export default class ChatsManager extends BaseManager {
  private tools: ChatsTools
  private chatSettings: ChatsSettings | undefined

  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)

    this.tools = createChatsTools(this.projectRoot)
  }

  async init(): Promise<void> {
    this.chatSettings = await this.tools.init()
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
    handlers[IPC_HANDLER_KEYS.CHATS_GET] = async ({ chatContext }) => this.getChat(chatContext)
    handlers[IPC_HANDLER_KEYS.CHATS_UPDATE] = async ({ chatContext, patch }) =>
      this.updateChat(chatContext, patch)
    handlers[IPC_HANDLER_KEYS.CHATS_DELETE] = async ({ chatContext }) =>
      this.deleteChat(chatContext)

    handlers[IPC_HANDLER_KEYS.CHATS_GET_SETTINGS] = async () => this.getSettings()
    handlers[IPC_HANDLER_KEYS.CHATS_UPDATE_SETTINGS] = async ({ chatContext, patch }) =>
      this.updateSettings(chatContext, patch)
    handlers[IPC_HANDLER_KEYS.CHATS_RESET_SETTINGS] = async ({ chatContext }) =>
      this.resetSettings(chatContext)

    handlers[IPC_HANDLER_KEYS.CHATS_GET_DEFAULT_PROMPT] = async ({ chatContext }) =>
      this.getDefaultPrompt(chatContext)
    handlers[IPC_HANDLER_KEYS.CHATS_GET_SETTINGS_PROMPT] = async ({ contextArguments }) =>
      this.getSettingsPrompt(contextArguments)

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

  async listChats(projectId?: string): Promise<Chat[]> {
    return await this.tools.listChats(projectId)
  }
  async getChat(chatContext: ChatContext): Promise<Chat> {
    return await this.tools.getChat(chatContext)
  }
  async createChat(input: ChatCreateInput): Promise<Chat> {
    return await this.tools.createChat(input)
  }
  async updateChat(chatContext: ChatContext, patch: ChatEditInput): Promise<Chat | undefined> {
    return await this.tools.updateChat(chatContext, patch)
  }
  async deleteChat(chatContext: ChatContext): Promise<void> {
    return await this.tools.deleteChat(chatContext)
  }

  getSettings(): ChatsSettings {
    return this.chatSettings!
  }

  async updateSettings(
    chatContext: ChatContext,
    patch: Partial<ChatSettings>,
  ): Promise<ChatsSettings> {
    return this.tools.updateChatSettings(this.getSettings(), chatContext, patch)
  }
  async resetSettings(chatContext: ChatContext): Promise<ChatsSettings> {
    return this.tools.resetChatSettings(this.getSettings(), chatContext)
  }

  getDefaultPrompt(chatContext: ChatContext): string {
    return getDefaultChatPrompt(chatContext)
  }
  async getSettingsPrompt(contextArguments: ChatContextArguments): Promise<string> {
    return this.tools.getSettingsPrompt(contextArguments, this.getSettings())
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
