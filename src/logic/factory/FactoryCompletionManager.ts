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

  private processChatMessagesForCompletion(messages: ChatMessage[]): CompletionMessage[] {
    // Transform messages with attachments into content that includes @path mentions
    return (messages || []).map((c) => {
      const m = c.completionMessage

      if (c.toolResults?.length) {
        const toolResults = c.toolResults.map((r) => ({
          name: r.call.name,
          result: r.result,
        }))
        return {
          role: 'user',
          content: JSON.stringify(toolResults),
        }
      }
      if (Array.isArray(m.files) && m.files.length) {
        const unique = Array.from(new Set(m.files.filter(Boolean)))
        const attachText = unique.map((p) => `@${p}`).join('\n')
        const sep = m.content && attachText ? '\n\n' : ''
        return {
          role: m.role,
          content: `${m.content || ''}${sep}Attached files:\n${attachText}`,
        }
      }
      return { role: m.role, content: m.content }
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
        },
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
      let m: ChatMessage = {
        completionMessage: { ...response, content: agentResponse?.message ?? response.content },
        toolCalls: agentResponse?.toolCalls,
        suggestedActions: agentResponse?.suggestedActions,
        model: { model: config.model, provider: config.provider },
      }
      await this.chatsManager.addChatMessages(chatContext, [m])
    }

    const turnFinishedCallback = async (
      turn: number,
      response: CompletionResponseWithTools,
    ): Promise<boolean> => {
      if (response.toolResults.results.length > 0) {
        let m: ChatMessage = {
          completionMessage: {
            role: 'user',
            content: '',
            startedAt: response.toolResults.startedAt,
            completedAt: response.toolResults.completedAt,
            durationMs: response.toolResults.durationMs,
            usage: { promptTokens: 0, completionTokens: 0 },
          },
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
        },
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
        },
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
