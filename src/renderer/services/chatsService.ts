import { LLMConfig } from 'thefactory-tools'
import { Chat, ChatMessage, ChatContext, ChatSettings } from '../../chat/ChatsManager'

export type { Chat, ChatMessage, ChatContext, ChatSettings }

export type ChatsService = {
  listModels: (config: LLMConfig) => Promise<string[]>
  subscribe: (callback: (chats: Chat[]) => void) => () => void
  listChats: (projectId: string) => Promise<Chat[]>
  createChat: (context: ChatContext) => Promise<Chat>
  getChat: (context: ChatContext) => Promise<Chat>
  deleteChat: (context: ChatContext) => Promise<void>
  getCompletion: (
    context: ChatContext,
    newMessages: ChatMessage[],
    config: LLMConfig,
  ) => Promise<void>
  getDefaultPrompt: (context: ChatContext) => Promise<string>
  savePrompt: (context: ChatContext, prompt: string) => Promise<void>
  saveSettings: (context: ChatContext, settings: Partial<ChatSettings>) => Promise<ChatSettings>
}

export const chatsService: ChatsService = { ...window.chatsService }
