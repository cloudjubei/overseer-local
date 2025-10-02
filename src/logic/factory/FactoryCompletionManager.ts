import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import { createCompletionTools } from 'thefactory-tools'
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
} from 'thefactory-tools'
import { COMPLETION_TOOLS_PLACEHOLDER } from 'thefactory-tools/constants'
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

    handlers[IPC_HANDLER_KEYS.COMPLETION_SIMPLE] = async ({
      messages,
      systemPrompt,
      config,
      onAbortControllerCreated,
    }) => this.getCompletion(messages, systemPrompt, config, onAbortControllerCreated)

    handlers[IPC_HANDLER_KEYS.COMPLETION_TOOLS] = async ({
      projectId,
      chatContext,
      completionMessage,
      systemPrompt,
      settings,
      config,
      onAbortControllerCreated,
    }) =>
      this.getCompletionTools(
        projectId,
        chatContext,
        completionMessage,
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

  async getCompletion(
    messages: CompletionMessage[],
    systemPrompt: string,
    config: LLMConfig,
    onAbortControllerCreated?: (abortController: AbortController) => void,
  ): Promise<CompletionResponse> {
    const completion = createCompletionTools(config, false)

    const request: CompletionRequest = {
      systemPrompt,
      messages,
      // abortSignal: abortController.signal,
    }
    return await completion.sendCompletion(request)
  }

  async getCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    completionMessage: CompletionMessage,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
    onAbortControllerCreated?: (abortController: AbortController) => void,
  ): Promise<CompletionResponseTurns> {
    console.log('MANAGER getCompletionTools ', ' chatContext: ', chatContext)
    const now = new Date().toISOString()

    const chat = await this.chatsManager.addChatMessages(chatContext, [
      {
        completionMessage: {
          ...completionMessage,
          usage: { promptTokens: 0, completionTokens: 0 },
          askedAt: now,
          completedAt: now,
          durationMs: 0,
        },
      },
    ])
    if (!chat) throw new Error('CHAT NOT FOUND')

    const completion = createCompletionTools(config, false)

    const messages = this.processChatMessagesForCompletion(chat.messages)

    const request: CompletionRequest = {
      systemPrompt: systemPrompt + '\n\n' + COMPLETION_TOOLS_PLACEHOLDER,
      messages,
    }
    const callTool = async (toolName: string, args: any): Promise<string> => {
      const result = this.factoryToolsManager.executeTool(projectId, toolName, args)
      return JSON.stringify(result)
    }
    const responseReceivedCallback = async (
      turn: number,
      response: CompletionResponse,
      agentResponse?: AgentResponse,
    ): Promise<void> => {
      console.log('responseReceivedCallback turn: ', turn, ' response: ', response)
      let m: ChatMessage = {
        completionMessage: { ...response, content: agentResponse?.thoughts ?? response.content },
        toolCalls: agentResponse?.toolCalls,
        model: { model: config.model, provider: config.provider },
      }
      //TODO: this update should bubble up via subscriber
      await this.chatsManager.addChatMessages(chatContext, [m])
    }

    const turnFinishedCallback = async (
      turn: number,
      response: CompletionResponseWithTools,
    ): Promise<boolean> => {
      console.log('turnFinishedCallback turn: ', turn, ' response: ', response)
      if (response.toolResults.results.length > 0) {
        let m: ChatMessage = {
          completionMessage: {
            role: 'user',
            content: '',
            askedAt: response.toolResults.startedAt,
            completedAt: response.toolResults.completedAt,
            durationMs: response.toolResults.durationMs,
            usage: { promptTokens: 0, completionTokens: 0 },
          },
          toolResults: response.toolResults.results,
        }
        //TODO: this update should bubble up via subscriber
        await this.chatsManager.addChatMessages(chatContext, [m])
      }
      return (
        response.toolResults.resultType === 'require_confirmation' ||
        response.toolResults.resultType === 'no_tool_calls' ||
        response.toolResults.resultType === 'no_tool_calls_repeated' ||
        response.toolResults.resultType === 'no_response'
      )
    }

    //TODO: include abortController as callback here
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
          askedAt: now,
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
