import type {
  ChatContext,
  CompletionMessage,
  CompletionResponseTurns,
  CompletionSettings,
  LLMConfig,
} from 'thefactory-tools'

export type CompletionService = {
  getCompletion: (
    messages: CompletionMessage[],
    systemPrompt: string,
    config: LLMConfig,
    abortSignal?: AbortSignal,
  ) => Promise<void>

  getCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    completionMessage: CompletionMessage,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
    abortSignal?: AbortSignal,
  ): Promise<CompletionResponseTurns>
}

export const completionService: CompletionService = { ...window.completionService }
