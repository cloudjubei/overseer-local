import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import { createCompletionTools } from 'thefactory-tools'
import type {
  AgentResponse,
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
  ToolCallWithResult,
  ToolResultType,
} from 'thefactory-tools'
import BaseManager from '../BaseManager'
import FactoryToolsManager from './FactoryToolsManager'
import ChatsManager from '../chat/ChatsManager'
import FactoryLLMPricingManager from './FactoryLLMPricingManager'
import { getChatContextPath } from 'thefactory-tools/utils'

export default class FactoryCompletionManager extends BaseManager {
  private chatsManager: ChatsManager
  private factoryToolsManager: FactoryToolsManager
  private factoryLLMPricingManager: FactoryLLMPricingManager

  private abortControllers: Record<string, AbortController> = {}

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    chatsManager: ChatsManager,
    factoryToolsManager: FactoryToolsManager,
    factoryLLMPricingManager: FactoryLLMPricingManager,
  ) {
    super(projectRoot, window)

    this.chatsManager = chatsManager
    this.factoryToolsManager = factoryToolsManager
    this.factoryLLMPricingManager = factoryLLMPricingManager
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.COMPLETION_SEND] = async ({ messages, systemPrompt, config }) =>
      this.sendCompletion(messages, systemPrompt, config)

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
    const pricing = this.factoryLLMPricingManager.getManager()
    if (!pricing) return config

    if (
      config.costInputPerMTokensUSD != null ||
      config.costOutputPerMTokensUSD != null ||
      config.costCacheReadInputPerMTokensUSD != null ||
      config.costCacheWriteInputPerMTokensUSD != null
    ) {
      return config
    }

    const price = pricing.getPrice(config.provider, config.model)
    if (!price) return config

    const costInputPerMTokensUSD = price.inputPerMTokensUSD
    const costOutputPerMTokensUSD = price.outputPerMTokensUSD
    const costCacheReadInputPerMTokensUSD = price.cacheReadInputPerMTokensUSD
    const costCacheWriteInputPerMTokensUSD = price.cacheWriteInputPerMTokensUSD

    return {
      ...config,
      costInputPerMTokensUSD,
      costOutputPerMTokensUSD,
      costCacheReadInputPerMTokensUSD,
      costCacheWriteInputPerMTokensUSD,
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
    messages: CompletionMessage[],
    systemPrompt: string,
    config: LLMConfig,
  ): Promise<CompletionResponse> {
    const completion = createCompletionTools(this.enrichConfigWithPricing(config))

    const request: CompletionRequest = {
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
    // treat those tool calls as 'ignored' (they were not resumed/confirmed). This should be
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
                toolResult: { ...(tm.toolResult || {}), type: 'ignored', durationMs: 0 },
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
    let chat = await this.chatsManager.getChat(chatContext)
    if (!chat) throw new Error('CHAT NOT FOUND')

    const msgs = chat.messages || []
    if (msgs.length < 1) throw new Error("CHAT DOESN'T HAVE MESSAGES")

    // Resume any tail tool messages that are not finished yet.
    let end = msgs.length - 1
    while (end >= 0 && msgs[end]?.role !== 'tool') end--
    if (end < 0) throw new Error("CHAT DOESN'T HAVE TOOL MESSAGES")

    let start = end
    while (start >= 0 && msgs[start]?.role === 'tool') {
      const tm = msgs[start] as CompletionToolMessage
      if (this.isResumableToolResultType(tm.toolResult.type)) {
        start--
        continue
      }
      break
    }
    start = start + 1
    if (start > end) throw new Error("CHAT DOESN'T HAVE RESUMABLE TOOL MESSAGES")

    const tailToolMessages = msgs.slice(start, end + 1) as CompletionToolMessage[]
    const granted = new Set<string>((toolsGranted || []).map(String))

    const markToolMessageRunning = async (toolCallId: string) => {
      const updatedMessages = [...(chat.messages || [])]
      const idx = updatedMessages.findIndex(
        (m) => m.role === 'tool' && (m as CompletionToolMessage).toolCall.toolCallId === toolCallId,
      )
      if (idx < 0) return

      const nowIso = new Date().toISOString()
      const existing = updatedMessages[idx] as CompletionToolMessage
      updatedMessages[idx] = {
        ...existing,
        toolResult: { ...existing.toolResult, type: 'running', durationMs: 0 },
        startedAt: existing.startedAt || nowIso,
        completedAt: nowIso,
        durationMs: 0,
      }

      const newChat = await this.chatsManager.saveChat({ ...chat, messages: updatedMessages })
      chat = newChat
    }

    const callTool = async (toolCall: ToolCall): Promise<any> => {
      if (toolCall.toolCallId) await markToolMessageRunning(toolCall.toolCallId)

      const updatedArgs = { ...(toolCall.arguments || {}) }
      if (chatContext.storyId && !('storyId' in updatedArgs)) {
        updatedArgs.storyId = chatContext.storyId
      }
      if (chatContext.featureId && !('featureId' in updatedArgs)) {
        updatedArgs.featureId = chatContext.featureId
      }
      return await this.factoryToolsManager.executeTool(projectId, toolCall.name, updatedArgs)
    }

    const updatedMessages = [...msgs]

    for (let i = 0; i < tailToolMessages.length; i++) {
      const tm = tailToolMessages[i]
      const toolCallId = tm.toolCall.toolCallId
      const toolName = tm.toolCall.name

      const requiresConfirmation = !settings.autoCallTools.includes(toolName)
      const isGranted = granted.has(toolCallId)

      if (requiresConfirmation && !isGranted) {
        // Still waiting on user confirmation.
        updatedMessages[start + i] = {
          ...tm,
          toolResult: { ...tm.toolResult, type: 'require_confirmation', durationMs: 0 },
        }
        continue
      }

      // If it's auto-call OR confirmed, execute.
      const toolStartedAt = Date.now()
      try {
        const res = await callTool(tm.toolCall)
        const durationMs = Date.now() - toolStartedAt
        updatedMessages[start + i] = {
          ...tm,
          content: typeof res === 'string' ? res : JSON.stringify(res),
          toolResult: { result: res, type: 'success', durationMs },
          completedAt: new Date().toISOString(),
          durationMs,
        }
      } catch (e: any) {
        const durationMs = Date.now() - toolStartedAt
        const err = `Error: ${e?.message || String(e)}`
        updatedMessages[start + i] = {
          ...tm,
          content: err,
          toolResult: { result: err, type: 'errored', durationMs },
          completedAt: new Date().toISOString(),
          durationMs,
        }
      }
    }

    const newChat = await this.chatsManager.saveChat({ ...chat, messages: updatedMessages })

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
    const completion = createCompletionTools(this.enrichConfigWithPricing(config))

    const messages = this.processChatMessagesForCompletion(currentChat.messages)

    const request: CompletionRequest = {
      systemPrompt,
      messages,
      abortSignal,
    }

    const markToolMessageRunning = async (toolCallId: string) => {
      const newMessages = [...(currentChat.messages || [])]
      const idx = newMessages.findIndex(
        (m) => m.role === 'tool' && (m as CompletionToolMessage).toolCall.toolCallId === toolCallId,
      )
      if (idx < 0) return

      const nowIso = new Date().toISOString()
      const existing = newMessages[idx] as CompletionToolMessage
      newMessages[idx] = {
        ...existing,
        toolResult: { ...existing.toolResult, type: 'running', durationMs: 0 },
        startedAt: existing.startedAt || nowIso,
        completedAt: nowIso,
        durationMs: 0,
      }

      currentChat = await this.chatsManager.saveChat({ ...currentChat, messages: newMessages })
    }

    const callTool = async (toolCall: ToolCall): Promise<any> => {
      if (toolCall.toolCallId) await markToolMessageRunning(toolCall.toolCallId)

      const updatedArgs = { ...(toolCall.arguments || {}) }
      if (chatContext.storyId && !('storyId' in updatedArgs)) {
        updatedArgs.storyId = chatContext.storyId
      }
      if (chatContext.featureId && !('featureId' in updatedArgs)) {
        updatedArgs.featureId = chatContext.featureId
      }
      return await this.factoryToolsManager.executeTool(projectId, toolCall.name, updatedArgs)
    }

    const promptPreparedCallback = async (_systemPrompt: string) => {}

    const responseReceivedCallback = async (
      _turn: number,
      response: CompletionResponse,
      agentResponse?: AgentResponse,
    ): Promise<void> => {
      const assistant = response.assistantMessage
      const newMessages: CompletionMessage[] = [assistant]

      const now = new Date().toISOString()
      for (const t of response.toolCalls) {
        const toolMessage: CompletionToolMessage = {
          role: 'tool',
          content: '',
          toolCall: {
            toolCallId: t.toolCallId,
            name: t.name,
            arguments: t.arguments,
          },
          toolResult: {
            result: undefined,
            type: this.toolInitialResultType(settings, t.name),
            durationMs: 0,
          },
          startedAt: now,
          completedAt: now,
          durationMs: 0,
        }
        newMessages.push(toolMessage)
      }

      const chatAfterAppend = await this.chatsManager.addChatMessages(chatContext, newMessages)
      if (chatAfterAppend) {
        currentChat = chatAfterAppend
      }
    }

    const toolCalledCallback = async (toolResult: ToolCallWithResult) => {
      const newMessages = [...currentChat.messages]
      const m = newMessages.find(
        (m) =>
          m.role === 'tool' &&
          (m as CompletionToolMessage).toolCall.toolCallId === toolResult.toolCallId,
      ) as CompletionToolMessage | undefined
      if (m) {
        const nowIso = new Date().toISOString()
        m.toolResult = {
          result: toolResult.result,
          type: toolResult.type,
          durationMs: toolResult.durationMs,
        }

        if (toolResult.result !== undefined) {
          m.content =
            typeof toolResult.result === 'string'
              ? toolResult.result
              : JSON.stringify(toolResult.result)
        }
        m.completedAt = nowIso
        m.durationMs = toolResult.durationMs
      }
      currentChat = await this.chatsManager.saveChat({ ...currentChat, messages: newMessages })
    }

    const turnFinishedCallback = async (_turn: number, response: any): Promise<boolean> => {
      return (
        response.toolResults.resultType === 'require_confirmation' ||
        response.toolResults.resultType === 'no_tool_calls' ||
        response.toolResults.resultType === 'no_tool_calls_repeated' ||
        response.toolResults.resultType === 'no_response'
      )
    }

    const c = await completion.sendCompletionWithTools(
      request,
      settings,
      callTool,
      toolCalledCallback,
      promptPreparedCallback,
      responseReceivedCallback,
      turnFinishedCallback,
    )

    if (c.resultType === 'errored') {
      const now = new Date().toISOString()
      const errorMessage: CompletionMessage = {
        role: 'system',
        content: 'Error',
        error: String(c.error || 'Unknown error'),
        startedAt: now,
        completedAt: now,
        durationMs: 0,
      }
      await this.chatsManager.addChatMessages(chatContext, [errorMessage])
    } else if (c.resultType === 'max_turns_reached') {
      const now = new Date().toISOString()
      const errorMessage: CompletionMessage = {
        role: 'system',
        content: 'Max Turns Reached',
        startedAt: now,
        completedAt: now,
        durationMs: 0,
      }
      await this.chatsManager.addChatMessages(chatContext, [errorMessage])
    }

    this.cleanupAbort(chatContext)
    return c
  }

  async abortCompletion(chatContext: ChatContext): Promise<void> {
    const path = getChatContextPath(chatContext)
    const abortController = this.abortControllers[path]
    if (abortController) {
      abortController.abort()
      this.cleanupAbort(chatContext)
    }
  }

  private createAbortSignal(chatContext: ChatContext): AbortSignal {
    const abortController = new AbortController()
    const path = getChatContextPath(chatContext)
    this.abortControllers[path] = abortController
    return abortController.signal
  }

  private cleanupAbort(chatContext: ChatContext) {
    const path = getChatContextPath(chatContext)
    delete this.abortControllers[path]
  }
  private isResumableToolResultType(t: ToolResultType): boolean {
    return t === 'require_confirmation' || t === 'pending' || t === 'running' || t === 'ignored'
  }

  private toolInitialResultType(settings: CompletionSettings, toolName: string): ToolResultType {
    return settings.autoCallTools.includes(toolName) ? 'pending' : 'require_confirmation'
  }
}
