import type {
  ChatContext,
  CompletionMessage,
  CompletionResponseTurns,
  CompletionSettings,
  LLMConfig,
} from 'thefactory-tools'

export type CompletionService = {
  sendCompletion: (
    messages: CompletionMessage[],
    systemPrompt: string,
    config: LLMConfig,
  ) => Promise<void>

  sendCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    completionMessage: CompletionMessage,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
  ): Promise<CompletionResponseTurns>

  resumeCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    toolsGranted: string[],
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
  ): Promise<CompletionResponseTurns>

  abortCompletion(chatContext: ChatContext): Promise<void>
}

export const completionService: CompletionService = { ...window.completionService }
