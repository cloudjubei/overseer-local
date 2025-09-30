import type {
  Chat,
  ChatContext,
  ChatContextArguments,
  ChatCreateInput,
  ChatEditInput,
  ChatMessage,
  ChatSettings,
  ChatsSettings,
  ChatUpdate,
  LLMConfig,
} from 'thefactory-tools'

export type LLMProviderType = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'local' | 'custom'

export type ChatsService = {
  // listModels: (config: LLMConfig) => Promise<string[]>
  getCompletion: (
    context: ChatContext,
    newMessages: ChatMessage[],
    config: LLMConfig,
  ) => Promise<void>

  subscribe: (callback: (chatUpdate: ChatUpdate) => void) => () => void
  listChats: (projectId?: string) => Promise<Chat[]>
  createChat: (input: ChatCreateInput) => Promise<Chat>
  getChat: (context: ChatContext) => Promise<Chat>
  updateChat: (context: ChatContext, input: ChatEditInput) => Promise<Chat | undefined>
  deleteChat: (context: ChatContext) => Promise<void>

  getChatSettings: () => Promise<ChatsSettings>
  updateChatSettings: (
    chatContext: ChatContext,
    patch: Partial<ChatSettings>,
  ) => Promise<ChatsSettings>
  resetChatSettings: (chatContext: ChatContext) => Promise<ChatsSettings>

  getSettingsPrompt: (contextArguments: ChatContextArguments) => Promise<string>
  getDefaultPrompt: (chatContext: ChatContext) => Promise<string>
}

export const chatsService: ChatsService = { ...window.chatsService }
