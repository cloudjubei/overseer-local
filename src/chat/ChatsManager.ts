import type { BrowserWindow } from 'electron'
import path from 'path'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import ChatsStorage from './ChatsStorage'
import BaseManager from '../BaseManager'
import type ProjectsManager from '../projects/ProjectsManager'
import type StoriesManager from '../stories/StoriesManager'
import type FilesManager from '../files/FilesManager'
import type SettingsManager from '../settings/SettingsManager'
import {
  buildChatTools,
  createCompletionClient,
  parseAgentResponse,
  normalizeTool,
  ToolCall,
} from 'thefactory-tools'

const MESSAGES_TO_SEND = 10

type ChatConfig = any

export type LLMProviderType = 'openai' | 'anthropic' | 'gemini' | 'xai' | 'local' | 'custom'

export type ChatRole = 'user' | 'assistant' | 'system'
export type ChatMessage = {
  role: ChatRole
  content: string
  model?: string
  attachments?: string[]
  error?: {
    message: string
  }
}
export type Chat = {
  id: string
  messages: ChatMessage[]
  creationDate: string
  updateDate: string
}

export default class ChatsManager extends BaseManager {
  private storages: Record<string, ChatsStorage>

  private projectsManager: ProjectsManager
  private storiesManager: StoriesManager
  private filesManager: FilesManager
  private settingsManager: SettingsManager

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    projectsManager: ProjectsManager,
    storiesManager: StoriesManager,
    filesManager: FilesManager,
    settingsManager: SettingsManager,
  ) {
    super(projectRoot, window)
    this.storages = {}

    this.projectsManager = projectsManager
    this.storiesManager = storiesManager
    this.filesManager = filesManager
    this.settingsManager = settingsManager
  }

  private async __getStorage(projectId: string): Promise<ChatsStorage | undefined> {
    if (!this.storages[projectId]) {
      const projectRoot = await this.projectsManager.getProjectDir(projectId)
      if (!projectRoot) {
        return
      }
      const chatsDir = path.join(projectRoot, `${projectId}/chats`)
      const storage = new ChatsStorage(projectId, chatsDir, this.window)
      await storage.init()
      this.storages[projectId] = storage
    }
    return this.storages[projectId]
  }

  async init(): Promise<void> {
    await this.__getStorage('main')
    await super.init()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.CHATS_LIST_MODELS] = async ({ config }) =>
      await this.listModels(config)
    handlers[IPC_HANDLER_KEYS.CHATS_LIST] = async ({ projectId }) =>
      (await this.__getStorage(projectId))?.listChats()
    handlers[IPC_HANDLER_KEYS.CHATS_CREATE] = async ({ projectId }) =>
      (await this.__getStorage(projectId))?.createChat()
    handlers[IPC_HANDLER_KEYS.CHATS_GET] = async ({ projectId, id }) =>
      (await this.__getStorage(projectId))?.getChat(id)
    handlers[IPC_HANDLER_KEYS.CHATS_DELETE] = async ({ projectId, chatId }) =>
      (await this.__getStorage(projectId))?.deleteChat(chatId)
    handlers[IPC_HANDLER_KEYS.CHATS_COMPLETION] = async ({
      projectId,
      chatId,
      newMessages,
      config,
    }) => this.getCompletion(projectId, chatId, newMessages, config)

    return handlers
  }

  private _withAttachmentsAsMentions(messages: ChatMessage[]): ChatMessage[] {
    // Transform messages with attachments into content that includes @path mentions
    return (messages || []).map((m) => {
      try {
        if (m && Array.isArray(m.attachments) && m.attachments.length) {
          const unique = Array.from(new Set(m.attachments.filter(Boolean)))
          const attachText = unique.map((p) => `@${p}`).join('\n')
          const sep = m.content && attachText ? '\n\n' : ''
          return { ...m, content: `${m.content || ''}${sep}Attached files:\n${attachText}` }
        }
      } catch {}
      return m
    })
  }

  private async _constructSystemPrompt(projectId: string): Promise<string> {
    const project: any = await this.projectsManager.getProject(projectId as any)

    const parts = []

    if (project) {
      parts.push(`\n#CURRENT PROJECT: ${project.name}`)
      if (project.description) {
        parts.push(`##DESCRIPTION:\n${project.description}`)
      }
    }
    return getSystemPrompt({ additionalContext: parts.join('\n') })
  }

  async getCompletion(
    projectId: string,
    chatId: string,
    newMessages: ChatMessage[],
    config: ChatConfig,
  ): Promise<any> {
    const storage = await this.__getStorage(projectId)
    try {
      const chat: any = await storage?.getChat(chatId)
      if (!chat) throw new Error(`Couldn't load chat with chatId: ${chatId}`)

      const systemPromptContent = await this._constructSystemPrompt(projectId)
      const systemPrompt: ChatMessage = { role: 'system', content: systemPromptContent }

      let messagesHistory: ChatMessage[] = [...(chat.messages || []), ...(newMessages || [])]
      if (messagesHistory.length > MESSAGES_TO_SEND) {
        messagesHistory.splice(0, messagesHistory.length - MESSAGES_TO_SEND)
      }
      // Build provider messages with attachments folded into content for tool discovery
      const providerMessages = this._withAttachmentsAsMentions(messagesHistory)
      let currentMessages: ChatMessage[] = [systemPrompt, ...providerMessages]

      const repoRoot = this.projectRoot
      const appSettings = this.settingsManager.getAppSettings()
      const webSearchApiKeys = appSettings?.webSearchApiKeys
      const dbConnectionString = appSettings?.database?.connectionString

      const { tools, callTool } = buildChatTools({
        repoRoot,
        projectId,
        webSearchApiKeys,
        dbConnectionString,
      })
      const model = config.model
      const completion = createCompletionClient(config, false)

      let rawResponses: string[] = []
      while (true) {
        const startedAt = new Date()
        const res = await completion({ model, messages: currentMessages, tools })
        const _durationMs = new Date().getTime() - startedAt.getTime()

        const agentResponse = parseAgentResponse(res.message.content) as any

        rawResponses.push(JSON.stringify(res.message))

        if (!agentResponse || !agentResponse.tool_calls || agentResponse.tool_calls.length === 0) {
          return await storage?.saveChat(
            chatId,
            [...(chat.messages || []), ...(newMessages || []), res.message],
            [...(chat.rawResponses ?? []), rawResponses],
          )
        }

        currentMessages.push(res.message)

        const toolOutputs: any[] = []
        for (const toolCall of agentResponse.tool_calls as ToolCall[]) {
          const toolName = toolCall.tool_name
          const args = normalizeTool(toolCall.arguments, toolName)

          const t0 = Date.now()
          const result = await callTool(toolName, args)
          const durationMs = Date.now() - t0
          toolOutputs.push({ name: toolName, result, durationMs })
        }
        const content = JSON.stringify(toolOutputs)
        const toolResultMsg: ChatMessage = { role: 'user', content }
        currentMessages.push(toolResultMsg)
      }
    } catch (error: any) {
      const details = [
        error?.message,
        error?.response?.data ? JSON.stringify(error.response.data) : null,
        error?.cause?.message || null,
      ]
        .filter(Boolean)
        .join('\n')
      console.error('Error in chat completion:', details)

      if (storage) {
        const chat: any = await storage.getChat(chatId)
        if (chat) {
          const errorMessage: ChatMessage = {
            role: 'assistant',
            content: `An error occurred while processing your request.`,
            error: {
              message: details,
            },
          }
          return await storage.saveChat(
            chatId,
            [...(chat.messages || []), ...(newMessages || []), errorMessage],
            chat.rawResponses ?? [],
          )
        }
      }

      throw new Error('Failed to get completion and save error state.')
    }
  }

  async listModels(_config?: ChatConfig): Promise<string[]> {
    try {
      return []
    } catch (error) {
      throw error
    }
  }
}

export const getSystemPrompt = ({ additionalContext = '' }: { additionalContext?: string }) => {
  return [
    coreInstruction,
    toolUsageInstructions,
    interactionRules,
    outputStyle,
    datesPrompt,
    additionalContext.trim(),
  ].join('\n\n')
}

const coreInstruction = `######################## OVERSEER AI - SYSTEM PROMPT  ########################
---------------------------------------------------------------------------
ROLE & VOICE
You are a research assistant for the Overseer, a software platform built for people to make various projects.
Your job is to aid the Overseer's users in making their project(s) great.
Use all the processing capabilities and reasoning powers to understand the user's problem and help them solve it.

Try to:
- Where possible, link to the source or cite its name and date.

Avoid:
- Low-quality SEO spam or promotional content with no originality.
- Unverified social media speculation or clickbait headlines.
- AI-generated content with no clear source attribution.

Tone & Style:
Maintain a neutral, analytical tone. Don’t editorialize.
---------------------------------------------------------------------------`

const toolUsageInstructions = `---------------------------------------------------------------------------
TOOL USAGE GUIDELINES
1.  **Analyze Request** – identify the user’s primary goal.
2.  **Use your tools any time you need to access your knowledge** - only reply directly if you can confidently answer or need more info from the user
3.  **Calling Tools** - you only have access to the listed tools, do not assume you have access to any other tools.
4.  **No Suitable Tool** – answer directly or request more information.
5.  **Clarify Before Running** – ask follow‑ups if key info missing (e.g., some name). Never run a tool without enough information unless you've already asked for clarification at least once. But ALWAYS try to be smart and use the available tools if they make sense.
6. If user mentions @path, use 'read_file'.  If user mentions #reference, use 'get_story_reference'.
---------------------------------------------------------------------------`
// 6. There are 3 very important tools to use, listed in priority order:
//   * \'company-attribute-search\' for finding information inside generated attributes related to a given company. IMPORTANT - if you use content from these in the output, make sure to include the full citations;
//   * \'document-search\' for finding information inside internal documents related to a given company;
//   * \'web-search\' for searching the web on any occasion;
// 7. Whenever looking for information ALWAYS consult the previous point (point 6) - for the order in which to use the tools.

const interactionRules = ''
// const interactionRulesCompanyBase = `---------------------------------------------------------------------------
// INTERACTION RULES
// 1. Never assume anything about a company or data depending on it - if ambiguous—ask.
// 2. Attribute, company, document facts → verify with tools; no hallucination.
// 3. Give concise reasoning & cite sources when possible.
// 4. Caution on risky or code‑violating actions; propose correct method.
// 5. Stay neutral when asked to compare; list objective pros/cons.
// 6. Stop when question fully answered—no filler.
// ---------------------------------------------------------------------------`

const outputStyle = `---------------------------------------------------------------------------
OUTPUT STYLE
• Use Github Flavored Markdown (GFM) for formatting.
• Make the text readable, easy to understand, well-structured, and easy to follow.
• Use numbered or dashed bullets.
• Always specify units (cm, kg, km/h).
• Always specify currencies (EUR, USD, CAD).
• One step or idea per line for procedures.
• Your users use the metric system and speak British English - make sure all text and grammar is fitting that audience. This goes especially for units used or spelling of words (like gray vs grey).
---------------------------------------------------------------------------`

export const datesPrompt = `---------------------------------------------------------------------------
  ### DATES ###
  Today is ${new Date()}.
  Whenever you provide information ALWAYS make sure it's the most up to date.
  ALWAYS favor more recent information (e.g. from web) over older information (e.g. from internal documents).
---------------------------------------------------------------------------`
