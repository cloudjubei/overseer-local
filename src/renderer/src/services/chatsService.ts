import { Chat, ChatContext, ChatMessage, ChatSettings, LLMConfig } from 'thefactory-tools'

export type LLMProviderType = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'local' | 'custom'

export type ChatsService = {
  listModels: (config: LLMConfig) => Promise<string[]>

  subscribe: (callback: (chats: Chat[]) => void) => () => void
  listChats: (projectId?: string) => Promise<Chat[]>
  createChat: (context: ChatContext) => Promise<Chat>
  getChat: (context: ChatContext) => Promise<Chat>
  deleteChat: (context: ChatContext) => Promise<void>
  saveSettings: (context: ChatContext, settings: Partial<ChatSettings>) => Promise<ChatSettings>

  getCompletion: (
    context: ChatContext,
    newMessages: ChatMessage[],
    config: LLMConfig,
  ) => Promise<void>

  getDefaultPrompt: (context: ChatContext) => Promise<string>
}

export const chatsService: ChatsService = { ...window.chatsService }
