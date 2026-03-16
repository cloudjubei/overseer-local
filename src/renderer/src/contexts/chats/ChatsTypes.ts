import type {
  Chat,
  ChatContext,
  ChatContextArguments,
  ChatsSettings,
  ChatSettings,
  CompletionSettings,
  CompletionMessage,
} from 'thefactory-tools'

export type ChatState = {
  key: string
  chat: Chat
  isLoading: boolean
  isThinking: boolean
}

export type ChatDraft = {
  text: string
  attachments: string[]
  selectionStart?: number
  selectionEnd?: number
}

export type ChatsContextValue = {
  chats: Record<string, ChatState>
  chatsByProjectId: Record<string, ChatState[]>

  getDraft: (chatKey: string) => ChatDraft
  setDraft: (chatKey: string, patch: Partial<ChatDraft>) => void
  clearDraft: (chatKey: string) => void

  sendMessage: (
    context: ChatContext,
    message: string,
    prompt: string,
    settings: ChatSettings,
    config: any,
    files?: string[],
  ) => Promise<void>
  resumeTools: (
    context: ChatContext,
    toolsGranted: string[],
    prompt: string,
    settings: ChatSettings,
    config: any,
  ) => Promise<void>
  retryCompletion: (
    context: ChatContext,
    prompt: string,
    settings: ChatSettings,
    config: any,
  ) => Promise<void>

  abortMessage: (context: ChatContext) => Promise<void>

  getChatIfExists: (context: ChatContext) => Promise<ChatState | undefined>
  getChat: (context: ChatContext) => Promise<ChatState>
  restartChat: (context: ChatContext) => Promise<ChatState>
  deleteChat: (context: ChatContext) => Promise<void>
  deleteLastMessage: (context: ChatContext) => Promise<void>

  // Settings APIs
  allChatSettings: ChatsSettings | undefined
  getSettings: (context: ChatContext) => ChatSettings | undefined
  resetSettings: (context: ChatContext) => Promise<ChatSettings | undefined>

  updateCompletionSettings: (
    context: ChatContext,
    patch: Partial<CompletionSettings>,
  ) => Promise<ChatSettings | undefined>

  getDefaultPrompt: (chatContext: ChatContext) => Promise<string>
  getSettingsPrompt: (contextArguments: ChatContextArguments) => Promise<string>
  updateSettingsPrompt: (context: ChatContext, prompt: string) => Promise<string | undefined>
  resetSettingsPrompt: (context: ChatContext) => Promise<string | undefined>

  // For actions module
  _types?: {
    CompletionMessage: CompletionMessage
  }
}
