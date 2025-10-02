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
    onAbortControllerCreated?: (abortController: AbortController) => void,
  ) => Promise<void>

  getCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    completionMessage: CompletionMessage,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
    onAbortControllerCreated?: (abortController: AbortController) => void,
  ): Promise<CompletionResponseTurns>
}

export const completionService: CompletionService = { ...window.completionService }
