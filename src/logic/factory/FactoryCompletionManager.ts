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
  ToolResult,
} from 'thefactory-tools'
import BaseManager from '../BaseManager'
import FactoryToolsManager from './FactoryToolsManager'
import ChatsManager from '../chat/ChatsManager'
import { getChatContextPath } from 'thefactory-tools/utils'

export default class FactoryCompletionManager extends BaseManager {
  private chatsManager: ChatsManager
  private factoryToolsManager: FactoryToolsManager

  private abortControllers: Record<string, AbortController> = {}

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    chatsManager: ChatsManager,
    factoryToolsManager: FactoryToolsManager,
  ) {
    super(projectRoot, window)

    this.chatsManager = chatsManager
    this.factoryToolsManager = factoryToolsManager
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
    const completion = createCompletionTools(config)

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
    const now = new Date().toISOString()

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
    const msgs = chat.messages || []
    if (msgs.length < 1) throw new Error("CHAT DOESN'T HAVE MESSAGES")

    let end = msgs.length - 1
    while (end >= 0 && msgs[end]?.role !== 'tool') end--
    if (end < 0) throw new Error("CHAT DOESN'T HAVE TOOL MESSAGES")

    let start = end
    while (
      start >= 0 &&
      msgs[start]?.role === 'tool' &&
      (msgs[start] as any).toolResult?.type === 'require_confirmation'
    ) {
      start--
    }
    start = start + 1
    if (start > end) throw new Error("CHAT DOESN'T HAVE A TOOL REQUIRING CONFIRMATION")

    const pending = msgs.slice(start, end + 1) as CompletionToolMessage[]
    const granted = new Set<string>((toolsGranted || []).map(String))

    const callTool = async (toolName: string, args: any): Promise<any> => {
      const updatedArgs = { ...(args || {}) }
      if (chatContext.storyId && !('storyId' in updatedArgs))
        updatedArgs.storyId = chatContext.storyId
      if (chatContext.featureId && !('featureId' in updatedArgs))
        updatedArgs.featureId = chatContext.featureId
      return await this.factoryToolsManager.executeTool(projectId, toolName, updatedArgs)
    }

    const updatedMessages = [...msgs]

    for (let i = 0; i < pending.length; i++) {
      const tm = pending[i]
      const toolCallId = tm.toolCall.toolCallId

      if (!toolCallId || !granted.has(toolCallId)) {
        updatedMessages[start + i] = {
          ...tm,
          toolResult: { ...tm.toolResult, type: 'aborted', durationMs: 0 },
        }
        continue
      }

      const toolStartedAt = Date.now()
      try {
        const res = await callTool(tm.toolCall.name, tm.toolCall.arguments)
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
    const completion = createCompletionTools(config)

    const messages = this.processChatMessagesForCompletion(chat.messages)

    const request: CompletionRequest = {
      systemPrompt,
      messages,
      abortSignal,
    }

    const callTool = async (toolCall: any): Promise<any> => {
      const updatedArgs = { ...(toolCall?.arguments || {}) }
      if (chatContext.storyId && !('storyId' in updatedArgs))
        updatedArgs.storyId = chatContext.storyId
      if (chatContext.featureId && !('featureId' in updatedArgs))
        updatedArgs.featureId = chatContext.featureId
      return await this.factoryToolsManager.executeTool(projectId, toolCall.name, updatedArgs)
    }

    const promptPreparedCallback = async (_systemPrompt: string) => {}

    const responseReceivedCallback = async (
      _turn: number,
      response: CompletionResponse,
      agentResponse?: AgentResponse,
    ): Promise<void> => {
      const assistant = response.assistantMessage
      const m: CompletionMessage = {
        ...assistant,
        suggestedActions: assistant.suggestedActions ?? agentResponse?.suggestedActions,
      }
      await this.chatsManager.addChatMessages(chatContext, [m])
    }

    const toolCalledCallback = async (toolCallWithResult: ToolCallWithResult): Promise<void> => {
      const now = new Date().toISOString()

      const result = toolCallWithResult.result
      const content = typeof result === 'string' ? result : JSON.stringify(result)

      const toolMessage: CompletionToolMessage = {
        role: 'tool',
        content,
        toolCall: {
          toolCallId: toolCallWithResult.toolCallId,
          name: toolCallWithResult.name,
          arguments: toolCallWithResult.arguments,
        },
        toolResult: {
          result,
          type: toolCallWithResult.type,
          durationMs: toolCallWithResult.durationMs,
        },
        startedAt: now,
        completedAt: now,
        durationMs: toolCallWithResult.durationMs,
      }
      await this.chatsManager.addChatMessages(chatContext, [toolMessage])
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
      } as any
      await this.chatsManager.addChatMessages(chatContext, [errorMessage])
    } else if (c.resultType === 'max_turns_reached') {
      const now = new Date().toISOString()
      const errorMessage: CompletionMessage = {
        role: 'system',
        content: 'Max Turns Reached',
        startedAt: now,
        completedAt: now,
        durationMs: 0,
      } as any
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
}
