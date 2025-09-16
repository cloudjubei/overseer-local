import { LLMConfig } from 'thefactory-tools'
import { ServiceResult } from './serviceResult'
import { Chat, ChatMessage } from '../../chat/ChatsManager'

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
