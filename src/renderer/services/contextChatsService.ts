import { ServiceResult } from './serviceResult'

export type ContextChatScope = 'tests' | 'agents'
export type ContextChatIdentifier = {
  projectId: string
  storyId?: string
  featureId?: string
  scope?: ContextChatScope
}

export type ContextChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
  model?: string
  attachments?: string[]
  error?: { message: string }
}

export type ContextChatSettings = {
  modelConfigId?: string | null
  toolToggles?: Record<string, boolean>
  autoApprove?: boolean
}

export type ContextChatData = {
  context: ContextChatIdentifier
  messages: ContextChatMessage[]
  settings?: ContextChatSettings
  createdAt: string
  updatedAt: string
}

export type ContextChatsService = {
  getContextChat: (
    context: ContextChatIdentifier,
    createIfMissing?: boolean,
  ) => Promise<ContextChatData>
  saveContextChat: (
    context: ContextChatIdentifier,
    patch: Partial<Pick<ContextChatData, 'messages' | 'settings'>>,
  ) => Promise<ServiceResult>
  deleteContextChat: (context: ContextChatIdentifier) => Promise<ServiceResult>
}

export const contextChatsService: ContextChatsService = { ...window.contextChatsService } as any
