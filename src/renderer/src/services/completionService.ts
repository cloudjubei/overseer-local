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
    onAbortControllerCreated?: (abortController: AbortController) => void,
  ) => Promise<void>

  sendCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    completionMessage: CompletionMessage,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
    onAbortControllerCreated?: (abortController: AbortController) => void,
  ): Promise<CompletionResponseTurns>

  resumeCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    toolsGranted: string[],
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
    onAbortControllerCreated?: (abortController: AbortController) => void,
  ): Promise<CompletionResponseTurns>
}

export const completionService: CompletionService = { ...window.completionService }
