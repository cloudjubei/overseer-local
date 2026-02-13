import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import { callCompletionTools, createCompletionTools } from 'thefactory-tools'
import type {
  CompletionMessage,
  LLMConfig,
  CompletionRequest,
  CompletionResponse,
  AgentResponse,
  CompletionSettings,
  CompletionResponseWithTools,
  CompletionResponseTurns,
  ChatContext,
  ChatMessage,
  Chat,
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

  private safeToolContent(result: any): string {
    if (typeof result === 'string') return result
    try {
      return JSON.stringify(result)
    } catch {
      return String(result)
    }
  }

  private processChatMessagesForCompletion(messages: ChatMessage[]): CompletionMessage[] {
    // Canonical tool transcript support (new thefactory-tools):
    // - Assistant tool requests are represented on assistant messages via toolCalls.
    // - Tool outputs are represented as regular messages with role: 'tool'.
    //
    // Legacy support (current persisted chats in this app):
    // - Tool outputs are stored on ChatMessage.toolResults.
    //   We convert those into canonical role:'tool' messages at request-build time.

    const out: CompletionMessage[] = []

    const msgs = messages || []
    for (let msgIndex = 0; msgIndex < msgs.length; msgIndex++) {
      const c = msgs[msgIndex]
      const m: any = c?.completionMessage
      if (!m) continue

      // 1) Canonical persisted tool messages (role: 'tool')
      if (m.role === 'tool') {
        out.push({
          role: 'tool',
          toolCallId: String(m.toolCallId || ''),
          toolName: String(m.toolName || ''),
          content: typeof m.content === 'string' ? m.content : this.safeToolContent(m.content),
        } as any)
        continue
      }

      // 2) Legacy persisted tool results wrapper message
      if (c.toolResults?.length) {
        for (let toolIndex = 0; toolIndex < c.toolResults.length; toolIndex++) {
          const r = c.toolResults[toolIndex]
          const toolCallId = r.call?.id
            ? String(r.call.id)
            : `legacy:${msgIndex}:${toolIndex}`
          out.push({
            role: 'tool',
            toolCallId,
            toolName: String(r.call?.name || ''),
            content: this.safeToolContent(r.result),
          })
        }
        continue
      }

      // 3) Normal message; transform attachments into @path mentions
      if (Array.isArray(m.files) && m.files.length) {
        const unique = Array.from(new Set(m.files.filter(Boolean)))
        const attachText = unique.map((p) => `@${p}`).join('\n')
        const sep = m.content && attachText ? '\n\n' : ''

        const base: any = {
          role: m.role,
          content: `${m.content || ''}${sep}Attached files:\n${attachText}`,
        }
        if (m.role === 'assistant' && Array.isArray(m.toolCalls)) base.toolCalls = m.toolCalls
        out.push(base)
        continue
      }

      // Default pass-through (including assistant toolCalls)
      const base: any = { role: m.role, content: m.content }
      if (m.role === 'assistant' && Array.isArray(m.toolCalls)) base.toolCalls = m.toolCalls
      out.push(base)
    }

    return out
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
    if (chat.messages.length < 1) throw new Error("CHAT DOESN'T HAVE MESSAGES")
    const lastMessage = chat.messages[chat.messages.length - 1]
    if (!lastMessage.toolResults || lastMessage.toolResults.length < 1)
      throw new Error("CHAT DOESN'T HAVE A TOOL RESULT MESSAGE")

    const toolsCheck = new Set<string>(toolsGranted)
    const toolsRequiringConfirmation = lastMessage.toolResults.filter(
      (r) => r.type === 'require_confirmation',
    )
    if (toolsRequiringConfirmation.length < 1)
      throw new Error("CHAT DOESN'T HAVE A TOOL REQUIRING CONFIRMATION THAT HAD IT GRANTED")
    const toolsAllowed = toolsRequiringConfirmation.filter((r) => toolsCheck.has(r.result))

    const callTool = async (toolName: string, args: any): Promise<any> => {
      const updatedArgs = { ...args }
      if (chatContext.storyId && !('storyId' in updatedArgs))
        updatedArgs.storyId = chatContext.storyId
      if (chatContext.featureId && !('featureId' in updatedArgs))
        updatedArgs.featureId = chatContext.featureId
      return await this.factoryToolsManager.executeTool(projectId, toolName, updatedArgs)
    }

    const agentResponse: AgentResponse = { toolCalls: toolsAllowed.map((t) => t.call) }
    const availableTools = toolsAllowed.map((t) => t.call.name)

    const toolResults = await callCompletionTools(
      agentResponse,
      availableTools,
      availableTools,
      settings.finishTurnOnErrors,
      callTool,
      this.createAbortSignal(chatContext),
    )

    const mapToolResults: Record<string, ToolResult> = {}
    for (let i = 0; i < toolResults.results.length; i++) {
      mapToolResults[toolsAllowed[i].result] = toolResults.results[i]
    }

    let newLastMessage = { ...lastMessage }
    newLastMessage.toolResults = lastMessage.toolResults.map((t) => {
      if (t.type === 'require_confirmation') {
        // If this tool required confirmation and was selected, replace with actual result
        if (toolsCheck.has(t.result)) {
          return mapToolResults[t.result] ? mapToolResults[t.result] : t
        }
        // Not selected: mark as aborted while preserving call/metadata
        return { ...t, type: 'aborted' as any }
      }
      // For all other tool results, keep them as-is
      return t
    })

    const newMessages = [...chat.messages]
    newMessages[newMessages.length - 1] = newLastMessage
    const newChat = await this.chatsManager.saveChat({ ...chat, messages: newMessages })

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

  async sendCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    completionMessage: CompletionMessage,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
  ): Promise<CompletionResponseTurns> {
    const now = new Date().toISOString()

    const chat = await this.chatsManager.addChatMessages(chatContext, [
      {
        completionMessage: {
          ...completionMessage,
          usage: { promptTokens: 0, completionTokens: 0 },
          startedAt: now,
          completedAt: now,
          durationMs: 0,
        } as any,
      },
    ])
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
    // Centralized delete of the last relevant message using ChatsManager
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

  async runCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    chat: Chat,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
    abortSignal?: AbortSignal,
  ) {
    const completion = createCompletionTools(config)

    const messages = this.processChatMessagesForCompletion(chat.messages)

    const request: CompletionRequest = {
      systemPrompt,
      messages,
      abortSignal,
    }
    const callTool = async (toolName: string, args: any): Promise<string> => {
      const updatedArgs = { ...args }
      if (chatContext.storyId && !('storyId' in updatedArgs))
        updatedArgs.storyId = chatContext.storyId
      if (chatContext.featureId && !('featureId' in updatedArgs))
        updatedArgs.featureId = chatContext.featureId
      return await this.factoryToolsManager.executeTool(projectId, toolName, updatedArgs)
    }
    const promptPreparedCallback = async (systemPrompt: string) => {}
    const responseReceivedCallback = async (
      turn: number,
      response: CompletionResponse,
      agentResponse?: AgentResponse,
    ): Promise<void> => {
      const role: any = (response as any)?.role

      // New canonical: tool output messages can arrive in the normal message stream.
      if (role === 'tool') {
        const toolMsg: any = {
          completionMessage: {
            ...(response as any),
            role: 'tool',
            content: (response as any).content ?? '',
            toolCallId: String((response as any).toolCallId ?? ''),
            toolName: String((response as any).toolName ?? ''),
          },
          model: { model: config.model, provider: config.provider },
        }
        await this.chatsManager.addChatMessages(chatContext, [toolMsg])
        return
      }

      const assistantMsg: ChatMessage = {
        completionMessage: { ...response, content: agentResponse?.message ?? response.content },
        toolCalls: agentResponse?.toolCalls,
        model: { model: config.model, provider: config.provider },
      }
      await this.chatsManager.addChatMessages(chatContext, [assistantMsg])
    }

    const turnFinishedCallback = async (
      turn: number,
      response: CompletionResponseWithTools,
    ): Promise<boolean> => {
      // Keep writing legacy toolResults wrapper messages (dual support).
      if (response.toolResults.results.length > 0) {
        let m: ChatMessage = {
          completionMessage: {
            role: 'user',
            content: '',
            startedAt: response.toolResults.startedAt,
            completedAt: response.toolResults.completedAt,
            durationMs: response.toolResults.durationMs,
            usage: { promptTokens: 0, completionTokens: 0 },
          } as any,
          toolResults: response.toolResults.results,
        }
        await this.chatsManager.addChatMessages(chatContext, [m])
      }
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
      promptPreparedCallback,
      responseReceivedCallback,
      turnFinishedCallback,
    )
    if (c.resultType === 'errored') {
      const now = new Date().toISOString()
      const errorMessage: ChatMessage = {
        completionMessage: {
          role: 'assistant',
          content: 'Error',
          usage: { promptTokens: 0, completionTokens: 0 },
          startedAt: now,
          completedAt: now,
          durationMs: 0,
        } as any,
        error: c.error,
      }
      await this.chatsManager.addChatMessages(chatContext, [errorMessage])
    } else if (c.resultType === 'max_turns_reached') {
      const now = new Date().toISOString()
      const errorMessage: ChatMessage = {
        completionMessage: {
          role: 'system',
          content: 'Max Turns Reached',
          usage: { promptTokens: 0, completionTokens: 0 },
          startedAt: now,
          completedAt: now,
          durationMs: 0,
        } as any,
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
}
