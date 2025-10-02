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
  CompletionToolResult,
  Chat,
} from 'thefactory-tools'
import BaseManager from '../BaseManager'
import FactoryToolsManager from './FactoryToolsManager'
import ChatsManager from '../chat/ChatsManager'

export default class FactoryCompletionManager extends BaseManager {
  private chatsManager: ChatsManager
  private factoryToolsManager: FactoryToolsManager

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

    handlers[IPC_HANDLER_KEYS.COMPLETION_SEND] = async ({
      messages,
      systemPrompt,
      config,
      onAbortControllerCreated,
    }) => this.sendCompletion(messages, systemPrompt, config, onAbortControllerCreated)

    handlers[IPC_HANDLER_KEYS.COMPLETION_TOOLS_SEND] = async ({
      projectId,
      chatContext,
      completionMessage,
      systemPrompt,
      settings,
      config,
      onAbortControllerCreated,
    }) =>
      this.sendCompletionTools(
        projectId,
        chatContext,
        completionMessage,
        systemPrompt,
        settings,
        config,
        onAbortControllerCreated,
      )

    handlers[IPC_HANDLER_KEYS.COMPLETION_TOOLS_RESUME] = async ({
      projectId,
      chatContext,
      toolsGranted,
      systemPrompt,
      settings,
      config,
      onAbortControllerCreated,
    }) =>
      this.resumeCompletionTools(
        projectId,
        chatContext,
        toolsGranted,
        systemPrompt,
        settings,
        config,
        onAbortControllerCreated,
      )

    return handlers
  }

  private processChatMessagesForCompletion(messages: ChatMessage[]): CompletionMessage[] {
    // Transform messages with attachments into content that includes @path mentions
    return (messages || []).map((c) => {
      const m = c.completionMessage

      if (c.toolResults?.length) {
        const toolResults = c.toolResults.map((r) => ({
          name: r.result.call.name,
          result: r.result.result,
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
    onAbortControllerCreated?: (abortController: AbortController) => void,
  ): Promise<CompletionResponse> {
    const completion = createCompletionTools(config)

    const request: CompletionRequest = {
      systemPrompt,
      messages,
      // abortSignal: abortController.signal,
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
    onAbortControllerCreated?: (abortController: AbortController) => void,
  ): Promise<CompletionResponseTurns> {
    const chat = await this.chatsManager.getChat(chatContext)
    if (!chat) throw new Error('CHAT NOT FOUND')
    if (chat.messages.length < 1) throw new Error("CHAT DOESN'T HAVE MESSAGES")
    const lastMessage = chat.messages[chat.messages.length - 1]
    if (!lastMessage.toolResults || lastMessage.toolResults.length < 1)
      throw new Error("CHAT DOESN'T HAVE A TOOL RESULT MESSAGE")

    const toolsCheck = new Set<string>(toolsGranted)
    const toolsRequiringConfirmation = lastMessage.toolResults.filter(
      (r) => r.result.type === 'require_confirmation',
    )
    if (toolsRequiringConfirmation.length < 1)
      throw new Error("CHAT DOESN'T HAVE A TOOL REQUIRING CONFIRMATION THAT HAD IT GRANTED")
    const toolsAllowed = toolsRequiringConfirmation.filter((r) => toolsCheck.has(r.result.result))

    const callTool = async (toolName: string, args: any): Promise<string> => {
      const result = await this.factoryToolsManager.executeTool(projectId, toolName, args)
      return JSON.stringify(result)
    }

    const agentResponse: AgentResponse = { toolCalls: toolsAllowed.map((t) => t.result.call) }
    const availableTools = toolsAllowed.map((t) => t.result.call.name)

    const toolResults = await callCompletionTools(
      agentResponse,
      availableTools,
      availableTools,
      settings.finishTurnOnErrors,
      callTool,
    ) //TODO: abort signal handle

    const mapToolResults: Record<string, CompletionToolResult> = {}
    for (let i = 0; i < toolResults.results.length; i++) {
      const r = toolResults.results[i]
      mapToolResults[toolsAllowed[i].result.result] = r
    }

    let newLastMessage = { ...lastMessage }
    newLastMessage.toolResults = lastMessage.toolResults.map((t) =>
      mapToolResults[t.result.result] ? mapToolResults[t.result.result] : t,
    )

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
      onAbortControllerCreated,
    )
  }

  async sendCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    completionMessage: CompletionMessage,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
    onAbortControllerCreated?: (abortController: AbortController) => void,
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
      onAbortControllerCreated,
    )
  }

  async runCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    chat: Chat,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
    onAbortControllerCreated?: (abortController: AbortController) => void,
  ) {
    const completion = createCompletionTools(config)

    const messages = this.processChatMessagesForCompletion(chat.messages)

    const request: CompletionRequest = {
      systemPrompt,
      messages,
    }
    const callTool = async (toolName: string, args: any): Promise<string> => {
      const result = await this.factoryToolsManager.executeTool(projectId, toolName, args)
      return JSON.stringify(result)
    }
    const responseReceivedCallback = async (
      turn: number,
      response: CompletionResponse,
      agentResponse?: AgentResponse,
    ): Promise<void> => {
      // console.log('responseReceivedCallback turn: ', turn, ' response: ', response)
      let m: ChatMessage = {
        completionMessage: { ...response, content: agentResponse?.message ?? response.content },
        toolCalls: agentResponse?.toolCalls,
        model: { model: config.model, provider: config.provider },
      }
      await this.chatsManager.addChatMessages(chatContext, [m])
    }

    const turnFinishedCallback = async (
      turn: number,
      response: CompletionResponseWithTools,
    ): Promise<boolean> => {
      // console.log(
      //   'turnFinishedCallback turn: ',
      //   turn,
      //   ' message: ',
      //   response.agentResponse?.message,
      // )
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
    }
    return c
  }
}
