import { LLMConfig } from 'thefactory-tools'
import { ServiceResult } from './serviceResult'

export type LLMProviderType = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'local' | 'custom'

export type ChatRole = 'user' | 'assistant' | 'system'
export type ChatMessage = {
  role: ChatRole
  content: string
  model?: string
  attachments?: string[]
}
export type Chat = { id: string; messages: ChatMessage[]; creationDate: string; updateDate: string }

export type ChatsService = {
  listModels: (config: LLMConfig) => Promise<string[]>
  subscribe: (callback: (chats: Chat[]) => void) => () => void
  listChats: (projectId: string) => Promise<Chat[]>
  createChat: (projectId: string) => Promise<Chat>
  getChat: (projectId: string, chatId: string) => Promise<Chat>
  deleteChat: (projectId: string, chatId: string) => Promise<ServiceResult>
  getCompletion: (
    projectId: string,
    chatId: string,
    newMessages: ChatMessage[],
    config: LLMConfig,
  ) => Promise<ServiceResult>
}

export const chatsService: ChatsService = { ...window.chatsService }
