import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import { createChatsTools } from 'thefactory-tools'
import type {
  ChatsTools,
  Chat,
  ChatContext,
  ChatCreateInput,
  ChatEditInput,
  ChatsSettings,
  ChatContextArguments,
  ChatMessage,
  CompletionSettings,
} from 'thefactory-tools'
import BaseManager from '../BaseManager'
import { getDefaultChatPrompt } from 'thefactory-tools/utils'

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

    handlers[IPC_HANDLER_KEYS.CHATS_LIST] = async ({ projectId }) => this.listChats(projectId)
    handlers[IPC_HANDLER_KEYS.CHATS_CREATE] = async ({ input }) => this.createChat(input)
    handlers[IPC_HANDLER_KEYS.CHATS_GET] = async ({ chatContext }) => this.getChat(chatContext)
    handlers[IPC_HANDLER_KEYS.CHATS_UPDATE] = async ({ chatContext, patch }) =>
      this.updateChat(chatContext, patch)
    handlers[IPC_HANDLER_KEYS.CHATS_DELETE] = async ({ chatContext }) =>
      this.deleteChat(chatContext)
    handlers[IPC_HANDLER_KEYS.CHATS_DELETE_LAST_MESSAGE] = async ({ chatContext }) =>
      this.deleteLastMessage(chatContext)

    handlers[IPC_HANDLER_KEYS.CHATS_GET_SETTINGS] = async () => this.getSettings()
    handlers[IPC_HANDLER_KEYS.CHATS_RESET_SETTINGS] = async ({ chatContext }) =>
      this.resetSettings(chatContext)

    handlers[IPC_HANDLER_KEYS.CHATS_UPDATE_COMPLETION_SETTINGS] = async ({ chatContext, patch }) =>
      this.updateCompletionSettings(chatContext, patch)

    handlers[IPC_HANDLER_KEYS.CHATS_GET_DEFAULT_PROMPT] = async ({ chatContext }) =>
      this.getDefaultPrompt(chatContext)
    handlers[IPC_HANDLER_KEYS.CHATS_GET_SETTINGS_PROMPT] = async ({ contextArguments }) =>
      this.getSettingsPrompt(contextArguments)
    handlers[IPC_HANDLER_KEYS.CHATS_UPDATE_SETTINGS_PROMPT] = async ({ chatContext, prompt }) =>
      this.updateSettingsPrompt(chatContext, prompt)
    handlers[IPC_HANDLER_KEYS.CHATS_RESET_SETTINGS_PROMPT] = async ({ chatContext }) =>
      this.resetSettingsPrompt(chatContext)

    return handlers
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
  async saveChat(chat: Chat): Promise<Chat> {
    return await this.tools.saveChat(chat)
  }
  async deleteChat(chatContext: ChatContext): Promise<void> {
    return await this.tools.deleteChat(chatContext)
  }
  async addChatMessages(
    chatContext: ChatContext,
    messages: ChatMessage[],
  ): Promise<Chat | undefined> {
    return await this.tools.addChatMessages(chatContext, messages)
  }

  async deleteLastMessage(chatContext: ChatContext): Promise<Chat | undefined> {
    const chat = await this.getChat(chatContext)
    const msgs = chat.messages || []
    if (msgs.length === 0) return chat

    let trimCount = 1
    const last = msgs[msgs.length - 1]
    const lastHasToolResults = Array.isArray((last as any)?.toolResults) && (last as any).toolResults.length > 0
    if (lastHasToolResults && msgs.length >= 2) {
      const prev = msgs[msgs.length - 2]
      if (prev?.completionMessage?.role === 'assistant') {
        trimCount = 2
      }
    }
    const trimmed = msgs.slice(0, msgs.length - trimCount)
    const newChat: Chat = { ...chat, messages: trimmed }
    return await this.saveChat(newChat)
  }

  getSettings(): ChatsSettings {
    return this.chatSettings!
  }
  async resetSettings(chatContext: ChatContext): Promise<ChatsSettings> {
    const s = await this.tools.resetChatSettings(this.getSettings(), chatContext)
    this.chatSettings = s
    return s
  }

  async updateCompletionSettings(
    chatContext: ChatContext,
    patch: Partial<CompletionSettings>,
  ): Promise<ChatsSettings> {
    const s = await this.tools.updateCompletionSettings(this.getSettings(), chatContext, patch)
    this.chatSettings = s
    return s
  }

  getDefaultPrompt(chatContext: ChatContext): string {
    return getDefaultChatPrompt(chatContext)
  }
  async getSettingsPrompt(contextArguments: ChatContextArguments): Promise<string> {
    return this.tools.getSettingsPrompt(contextArguments, this.getSettings())
  }
  async updateSettingsPrompt(chatContext: ChatContext, prompt: string): Promise<ChatsSettings> {
    const s = await this.tools.updateSettingsPrompt(this.getSettings(), chatContext, prompt)
    this.chatSettings = s
    return s
  }
  async resetSettingsPrompt(chatContext: ChatContext): Promise<ChatsSettings> {
    const s = await this.tools.resetSettingsPrompt(this.getSettings(), chatContext)
    this.chatSettings = s
    return s
  }
}
