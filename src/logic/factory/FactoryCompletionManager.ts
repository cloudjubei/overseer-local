import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import { createCompletionTools, createCompletionWithToolsParams } from 'thefactory-tools'
import type {
  Chat,
  ChatContext,
  CompletionMessage,
  CompletionRequest,
  CompletionResponse,
  CompletionResponseTurns,
  CompletionSettings,
  CompletionToolMessage,
  LLMConfig,
  ToolCall,
  ToolResultType,
} from 'thefactory-tools'
import BaseManager from '../BaseManager'
import FactoryToolsManager from './FactoryToolsManager'
import ChatsManager from '../chat/ChatsManager'
import FactoryLLMCostsManager from './FactoryLLMCostsManager'
import { getChatContextKey } from 'thefactory-tools/utils'

export default class FactoryCompletionManager extends BaseManager {
  private chatsManager: ChatsManager
  private factoryToolsManager: FactoryToolsManager
  private factoryLLMCostsManager: FactoryLLMCostsManager

  private abortControllers: Record<string, AbortController> = {}

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    chatsManager: ChatsManager,
    factoryToolsManager: FactoryToolsManager,
    factoryLLMCostsManager: FactoryLLMCostsManager,
  ) {
    super(projectRoot, window)

    this.chatsManager = chatsManager
    this.factoryToolsManager = factoryToolsManager
    this.factoryLLMCostsManager = factoryLLMCostsManager
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.COMPLETION_SEND] = async ({
      chatContext,
      config,
      messages,
      systemPrompt,
    }) => this.sendCompletion(chatContext, config, messages, systemPrompt)

    handlers[IPC_HANDLER_KEYS.COMPLETION_TOOLS_SEND] = async ({
      projectId,
      chatContext,
      completionMessage,
      systemPrompt,
      settings,
      config,
    }) =>
      this.sendCompletionTools(
        projectId,
        chatContext,
        completionMessage,
        systemPrompt,
        settings,
        config,
      )

    handlers[IPC_HANDLER_KEYS.COMPLETION_TOOLS_RESUME] = async ({
      projectId,
      chatContext,
      toolsGranted,
      systemPrompt,
      settings,
      config,
    }) =>
      this.resumeCompletionTools(
        projectId,
        chatContext,
        toolsGranted,
        systemPrompt,
        settings,
        config,
      )

    handlers[IPC_HANDLER_KEYS.COMPLETION_TOOLS_RETRY] = async ({
      projectId,
      chatContext,
      systemPrompt,
      settings,
      config,
    }) => this.retryCompletionTools(projectId, chatContext, systemPrompt, settings, config)

    handlers[IPC_HANDLER_KEYS.COMPLETION_ABORT] = async ({ chatContext }) =>
      this.abortCompletion(chatContext)

    return handlers
  }

  private enrichConfigWithPricing(config: LLMConfig): LLMConfig {
    const llmCostsTools = this.factoryLLMCostsManager.getTools()
    if (!llmCostsTools) return config

    if (
      config.costInputPerMTokensUSD != null ||
      config.costOutputPerMTokensUSD != null ||
      config.costCacheReadInputPerMTokensUSD != null
    ) {
      return config
    }

    const price = llmCostsTools.getPrice(config.provider, config.model)
    if (!price) return config

    const costInputPerMTokensUSD = price.inputPerMTokensUSD
    const costOutputPerMTokensUSD = price.outputPerMTokensUSD
    const costCacheReadInputPerMTokensUSD = price.cacheReadInputPerMTokensUSD

    return {
      ...config,
      costInputPerMTokensUSD,
      costOutputPerMTokensUSD,
      costCacheReadInputPerMTokensUSD,
    }
  }

  private processChatMessagesForCompletion(messages: CompletionMessage[]): CompletionMessage[] {
    // Transform user messages with attachments into content that includes @path mentions.
    // Tool messages are already native (role='tool') and should be passed through.
    return (messages || []).map((m) => {
      if (m.role === 'user' && Array.isArray((m as any).files) && (m as any).files.length) {
        const files = ((m as any).files as string[]).filter(Boolean)
        const unique = Array.from(new Set(files))
        const attachText = unique.map((p) => `@${p}`).join('\n')
        const sep = m.content && attachText ? '\n\n' : ''
        return {
          ...m,
          content: `${m.content || ''}${sep}Attached files:\n${attachText}`,
        } as CompletionMessage
      }
      return { ...m }
    })
  }

  async sendCompletion(
    chatContext: ChatContext,
    config: LLMConfig,
    messages: CompletionMessage[],
    systemPrompt: string,
  ): Promise<CompletionResponse> {
    const completion = createCompletionTools()
    const llmConfig = this.enrichConfigWithPricing(config)
    const request: CompletionRequest = {
      chatContext,
      llmConfig,
      systemPrompt,
      messages,
    }
    return await completion.sendCompletion(request)
  }

  async sendCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    completionMessage: CompletionMessage,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
  ): Promise<CompletionResponseTurns> {
    // If there are tail tool calls awaiting confirmation and the user sends a new message,
    // treat those tool calls as 'not_allowed' (they were not resumed/confirmed). This should be
    // persisted in the saved chat history (not only mutated in renderer UI state).
    let existingChat = await this.chatsManager.getChat(chatContext)
    if (!existingChat) throw new Error('CHAT NOT FOUND')

    try {
      const msgs = existingChat.messages || []
      const updated = [...msgs]

      // Find trailing tool message run.
      let end = updated.length - 1
      while (end >= 0 && updated[end]?.role !== 'tool') end--
      if (end >= 0) {
        let start = end
        while (start >= 0 && updated[start]?.role === 'tool') {
          const tm = updated[start] as CompletionToolMessage
          if (tm?.toolResult?.type === 'require_confirmation') {
            start--
            continue
          }
          break
        }
        start = start + 1

        if (start <= end) {
          let changed = false
          for (let i = start; i <= end; i++) {
            const tm = updated[i] as CompletionToolMessage
            if (tm?.role === 'tool' && tm?.toolResult?.type === 'require_confirmation') {
              updated[i] = {
                ...tm,
                toolResult: {
                  ...(tm.toolResult || {}),
                  result: 'Execution denied by user - the effect was not applied.',
                  type: 'not_allowed',
                  durationMs: 0,
                },
              }
              changed = true
            }
          }

          if (changed) {
            existingChat = await this.chatsManager.saveChat({ ...existingChat, messages: updated })
          }
        }
      }
    } catch (_) {
      // Non-fatal: proceed without persisting ignored tool messages.
    }

    const chat = await this.chatsManager.addChatMessages(chatContext, [completionMessage])
    if (!chat) throw new Error('CHAT NOT FOUND')

    return await this.runCompletionTools(
      projectId,
      chatContext,
      chat,
      systemPrompt,
      settings,
      config,
      this.createAbortSignal(chatContext),
    )
  }

  async retryCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
  ): Promise<CompletionResponseTurns> {
    const newChat = await this.chatsManager.deleteLastMessage(chatContext)
    if (!newChat) throw new Error('CHAT NOT FOUND')

    return await this.runCompletionTools(
      projectId,
      chatContext,
      newChat,
      systemPrompt,
      settings,
      config,
      this.createAbortSignal(chatContext),
    )
  }

  async resumeCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    toolsGranted: string[],
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
  ): Promise<CompletionResponseTurns> {
    const chat = await this.chatsManager.getChat(chatContext)
    if (!chat) throw new Error('CHAT NOT FOUND')

    const completion = createCompletionTools()
    const llmConfig = this.enrichConfigWithPricing(config)

    const messages = this.processChatMessagesForCompletion(chat.messages)

    const request: CompletionRequest = {
      chatContext,
      llmConfig,
      systemPrompt,
      messages,
      abortSignal: this.createAbortSignal(chatContext),
    }

    const callTool = async (toolCall: ToolCall): Promise<any> => {
      const updatedArgs = { ...(toolCall.arguments || {}) }
      if (chatContext.storyId && !('storyId' in updatedArgs)) {
        updatedArgs.storyId = chatContext.storyId
      }
      if (chatContext.featureId && !('featureId' in updatedArgs)) {
        updatedArgs.featureId = chatContext.featureId
      }
      return await this.factoryToolsManager.executeTool(projectId, toolCall.name, updatedArgs)
    }

    const params = createCompletionWithToolsParams({
      chatsTools: this.chatsManager.tools,
      request,
      settings,
      callTool,
      llmCostsTools: this.factoryLLMCostsManager.getTools(),
    })

    const c = await completion.resumeCompletionTools({
      ...params,
      toolsGranted,
    })

    this.cleanupAbort(chatContext)
    return c
  }

  async runCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    chat: Chat,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
    abortSignal?: AbortSignal,
  ): Promise<CompletionResponseTurns> {
    let currentChat: Chat = chat
    const completion = createCompletionTools()
    const llmConfig = this.enrichConfigWithPricing(config)

    const messages = this.processChatMessagesForCompletion(currentChat.messages)

    const request: CompletionRequest = {
      chatContext,
      llmConfig,
      systemPrompt,
      messages,
      abortSignal,
    }

    const callTool = async (toolCall: ToolCall): Promise<any> => {
      const updatedArgs = { ...(toolCall.arguments || {}) }
      if (chatContext.storyId && !('storyId' in updatedArgs)) {
        updatedArgs.storyId = chatContext.storyId
      }
      if (chatContext.featureId && !('featureId' in updatedArgs)) {
        updatedArgs.featureId = chatContext.featureId
      }
      return await this.factoryToolsManager.executeTool(projectId, toolCall.name, updatedArgs)
    }

    const params = createCompletionWithToolsParams({
      chatsTools: this.chatsManager.tools,
      request,
      settings,
      callTool,
      llmCostsTools: this.factoryLLMCostsManager.getTools(),
    })

    const c = await completion.sendCompletionWithTools(params)

    this.cleanupAbort(chatContext)
    return c
  }

  async abortCompletion(chatContext: ChatContext): Promise<void> {
    const path = getChatContextKey(chatContext)
    const abortController = this.abortControllers[path]
    if (abortController) {
      abortController.abort()
      this.cleanupAbort(chatContext)
    }
  }

  private createAbortSignal(chatContext: ChatContext): AbortSignal {
    const abortController = new AbortController()
    const path = getChatContextKey(chatContext)
    this.abortControllers[path] = abortController
    return abortController.signal
  }

  private cleanupAbort(chatContext: ChatContext) {
    const path = getChatContextKey(chatContext)
    delete this.abortControllers[path]
  }
}
