import { LLMConfig } from 'thefactory-tools'
import { ServiceResult } from './serviceResult'
import { Chat, ChatMessage, ChatContext, ChatSettings } from '../../chat/ChatsManager'

export type { Chat, ChatMessage, ChatContext, ChatSettings }

export type ChatsService = {
  listModels: (config: LLMConfig) => Promise<string[]>
  subscribe: (callback: (chats: Chat[]) => void) => () => void
  listChats: (projectId: string) => Promise<Chat[]>
  createChat: (context: ChatContext) => Promise<Chat>
  getChat: (context: ChatContext) => Promise<Chat>
  deleteChat: (context: ChatContext) => Promise<ServiceResult>
  getCompletion: (
    context: ChatContext,
    newMessages: ChatMessage[],
    config: LLMConfig,
  ) => Promise<ServiceResult>
  getDefaultPrompt: (context: ChatContext) => Promise<string>
  savePrompt: (context: ChatContext, prompt: string) => Promise<ServiceResult>
}

export const chatsService: ChatsService = { ...window.chatsService }
