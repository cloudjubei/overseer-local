import type {
  Chat,
  ChatContext,
  ChatContextArguments,
  ChatCreateInput,
  ChatEditInput,
  ChatsSettings,
  ChatUpdate,
  CompletionSettings,
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

  getChatSettings: () => Promise<ChatsSettings>
  resetChatSettings: (chatContext: ChatContext) => Promise<ChatsSettings>
  updateChatCompletionSettings: (
    chatContext: ChatContext,
    patch: Partial<CompletionSettings>,
  ) => Promise<ChatsSettings>

  getDefaultPrompt: (chatContext: ChatContext) => Promise<string>
  getSettingsPrompt: (contextArguments: ChatContextArguments) => Promise<string>
  updateSettingsPrompt: (chatContext: ChatContext, prompt: string) => Promise<ChatsSettings>
  resetSettingsPrompt: (chatContext: ChatContext) => Promise<ChatsSettings>
}

export const chatsService: ChatsService = { ...window.chatsService }
