import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import { createAgentRunnerTools } from 'thefactory-tools'
import type {
  AgentRunnerStartRunOptions,
  AgentRunnerTools,
  AgentRunParams,
  AgentRunType,
  ChatContext,
  ChatContextAgentRun,
  ChatContextAgentRunFeature,
  CompletionArgs,
  CompletionMessage,
  CompletionResponse,
  CompletionResponseTurns,
  CompletionSettings,
  CompletionToolsArgs,
  GithubCredentials,
  LLMConfig,
  ToolCall,
  WebSearchApiKeys,
} from 'thefactory-tools'
import BaseManager from '../BaseManager'
import FactoryToolsManager from './FactoryToolsManager'
import ChatsManager from '../chat/ChatsManager'
import FactoryLLMCostsManager from './FactoryLLMCostsManager'
import ProjectsManager from '../projects/ProjectsManager'
import { getChatContextKey } from 'thefactory-tools/utils'

export default class FactoryCompletionManager extends BaseManager {
  private chatsManager: ChatsManager
  private factoryToolsManager: FactoryToolsManager
  private factoryLLMCostsManager: FactoryLLMCostsManager
  private projectsManager: ProjectsManager

  private agentRunnerTools: AgentRunnerTools
  private abortControllers: Record<string, AbortController> = {}

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    chatsManager: ChatsManager,
    factoryToolsManager: FactoryToolsManager,
    factoryLLMCostsManager: FactoryLLMCostsManager,
    projectsManager: ProjectsManager,
  ) {
    super(projectRoot, window)

    this.chatsManager = chatsManager
    this.factoryToolsManager = factoryToolsManager
    this.factoryLLMCostsManager = factoryLLMCostsManager
    this.projectsManager = projectsManager

    this.agentRunnerTools = createAgentRunnerTools()
  }

  getHandlers(): Record<string, (args: any) => any> {
    const handlers: Record<string, (args: any) => any> = {}

    handlers[IPC_HANDLER_KEYS.COMPLETION_ABORT] = ({ chatContext }) =>
      this.abortCompletion(chatContext)

    return handlers
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

    handlers[IPC_HANDLER_KEYS.COMPLETION_START_AGENT_RUN] = async ({
      params,
      settings,
      isolated,
    }) => this.startAgentRun(params, settings, isolated)

    return handlers
  }

  async sendCompletion(
    chatContext: ChatContext,
    llmConfig: LLMConfig,
    messages: CompletionMessage[],
    systemPrompt: string,
  ): Promise<CompletionResponse> {
    await this.chatsManager.addChatMessages(chatContext, messages)

    const args = this.getCompletionArgs(chatContext, systemPrompt, llmConfig)

    try {
      return await this.agentRunnerTools.sendCompletion(args)
    } finally {
      this.cleanupAbort(chatContext)
    }
  }

  async sendCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    message: CompletionMessage,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
  ): Promise<CompletionResponseTurns> {
    const args = this.getCompletionToolsArgs(projectId, chatContext, systemPrompt, settings, config)

    try {
      return await this.agentRunnerTools.sendCompletionTools({ ...args, message })
    } finally {
      this.cleanupAbort(chatContext)
    }
  }

  async retryCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
  ): Promise<CompletionResponseTurns> {
    const args = this.getCompletionToolsArgs(projectId, chatContext, systemPrompt, settings, config)

    try {
      return await this.agentRunnerTools.retryCompletionTools(args)
    } finally {
      this.cleanupAbort(chatContext)
    }
  }

  async resumeCompletionTools(
    projectId: string,
    chatContext: ChatContext,
    toolsGranted: string[],
    systemPrompt: string,
    settings: CompletionSettings,
    config: LLMConfig,
  ): Promise<CompletionResponseTurns> {
    const args = this.getCompletionToolsArgs(projectId, chatContext, systemPrompt, settings, config)

    try {
      return await this.agentRunnerTools.resumeCompletionTools({ ...args, toolsGranted })
    } finally {
      this.cleanupAbort(chatContext)
    }
  }
  async startAgentRun(
    params: AgentRunParams,
    settings: CompletionSettings,
    isolated: boolean,
  ): Promise<void> {
    const chatsTools = this.chatsManager.getTools()
    const llmCostsTools = this.factoryLLMCostsManager.getTools()
    const abortSignal = this.createAbortSignal(params.chatContext)
    const opts: AgentRunnerStartRunOptions = {
      params,
      chatsTools,
      llmCostsTools,
      abortSignal,
      isolated,
    }

    try {
      await this.agentRunnerTools.startAgentRun(opts)
    } finally {
      this.cleanupAbort(params.chatContext)
    }
  }

  abortCompletion(chatContext: ChatContext) {
    const path = getChatContextKey(chatContext)
    const abortController = this.abortControllers[path]
    if (abortController) {
      abortController.abort()
      this.cleanupAbort(chatContext)
    }
  }

  private createAbortSignal(chatContext: ChatContext): AbortSignal {
    this.abortCompletion(chatContext)

    const abortController = new AbortController()
    const path = getChatContextKey(chatContext)
    this.abortControllers[path] = abortController
    return abortController.signal
  }

  private cleanupAbort(chatContext: ChatContext) {
    const path = getChatContextKey(chatContext)
    delete this.abortControllers[path]
  }

  private getCompletionArgs(
    chatContext: ChatContext,
    systemPrompt: string,
    llmConfig: LLMConfig,
  ): CompletionArgs {
    const chatsTools = this.chatsManager.getTools()
    const llmCostsTools = this.factoryLLMCostsManager.getTools()
    const projectTools = this.projectsManager.getTools()
    const abortSignal = this.createAbortSignal(chatContext)

    return {
      chatsTools,
      chatContext,
      llmConfig,
      systemPrompt,
      llmCostsTools,
      projectTools,
      abortSignal,
    }
  }

  private getCompletionToolsArgs(
    projectId: string,
    chatContext: ChatContext,
    systemPrompt: string,
    settings: CompletionSettings,
    llmConfig: LLMConfig,
  ): CompletionToolsArgs {
    const completionArgs = this.getCompletionArgs(chatContext, systemPrompt, llmConfig)

    const callTool = async (toolCall: ToolCall): Promise<any> => {
      return await this.factoryToolsManager.executeTool(
        projectId,
        toolCall.name,
        toolCall.arguments,
      )
    }
    return {
      ...completionArgs,
      settings,
      callTool,
    }
  }
}
