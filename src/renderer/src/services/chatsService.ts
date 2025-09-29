import {
  Chat,
  ChatContext,
  ChatCreateInput,
  ChatEditInput,
  ChatMessage,
  ChatSettings,
  ChatUpdate,
  LLMConfig,
} from 'thefactory-tools'

export type LLMProviderType = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'local' | 'custom'

export type ChatsService = {
  // listModels: (config: LLMConfig) => Promise<string[]>

  subscribe: (callback: (chatUpdate: ChatUpdate) => void) => () => void
  listChats: (projectId?: string) => Promise<Chat[]>
  createChat: (input: ChatCreateInput) => Promise<Chat>
  getChat: (context: ChatContext) => Promise<Chat>
  updateChat: (context: ChatContext, input: ChatEditInput) => Promise<Chat | undefined>
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
