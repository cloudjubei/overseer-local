import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLLMConfig } from '../../contexts/LLMConfigContext'
import { useNavigator } from '../../navigation/Navigator'
import { useChats, ChatState } from '../../contexts/ChatsContext'
import { factoryToolsService } from '../../services/factoryToolsService'
import { ChatInput, MessageList } from '.'
import { playSendSound, tryResumeAudioContext } from '../../assets/sounds'
import { Switch } from '../ui/Switch'
import type {
  ChatContext,
  ChatMessage,
  ChatContextArguments,
  CompletionSettings,
} from 'thefactory-tools'
import ContextInfoButton from '../ui/ContextInfoButton'
import ModelChip from '../agents/ModelChip'
import { IconSettings, IconChevron } from '../ui/Icons'
import { useProjectContext } from '../../contexts/ProjectContext'
import { useStories } from '../../contexts/StoriesContext'
import { useAgents } from '../../contexts/AgentsContext'

export type ChatSidebarProps = {
  context: ChatContext
  chatContextTitle: string
  // When provided, ChatSidebar shows a collapse button and calls this to request collapse
  isCollapsible?: boolean
  onCollapse?: () => void
  // Controls whether ChatSidebar renders a left border when collapsible; default true
  showLeftBorder?: boolean
}
type ToolToggle = { name: string; description: string; available: boolean; autoCall: boolean }

export default function ChatSidebar({
  context,
  chatContextTitle,
  isCollapsible,
  onCollapse,
  showLeftBorder,
}: ChatSidebarProps) {
  const {
    getChat,
    sendMessage,
    getSettings,
    resetSettings,
    updateCompletionSettings,
    getDefaultPrompt,
    getSettingsPrompt,
    updateSettingsPrompt,
    resetSettingsPrompt,
  } = useChats()
  const { getProjectById } = useProjectContext()
  const { storiesById, featuresById } = useStories()
  const { runsHistory } = useAgents()
  const { configs, activeConfig } = useLLMConfig()
  const { navigateView } = useNavigator()

  const [chat, setChat] = useState<ChatState | undefined>(undefined)
  const [selectedConfigId, setSelectedConfigId] = useState<string | undefined>(undefined)
  const [effectivePrompt, setEffectivePrompt] = useState<string>('')

  const currentSettings = useMemo(() => getSettings(context), [getSettings, context])
  const persistSettings = useCallback(
    async (patch: Partial<CompletionSettings>) => {
      await updateCompletionSettings(context, patch)
    },
    [context, updateCompletionSettings],
  )

  useEffect(() => {
    const loadChat = async () => {
      const c = await getChat(context)
      setChat(c)
    }
    loadChat()
  }, [context, getChat])

  const isThinking = chat?.isThinking || false

  const selectedConfig = useMemo(() => {
    if (selectedConfigId) {
      const byId = configs.find((c) => c.id === selectedConfigId)
      if (byId) return byId
    }
    return activeConfig || configs[0]
  }, [configs, activeConfig, selectedConfigId])

  const isConfigured = !!selectedConfig?.apiKey

  const [draftPrompt, setDraftPrompt] = useState<string>('')

  const handleSend = useCallback(
    async (message: string, attachments: string[]) => {
      if (!selectedConfig || !currentSettings) return
      tryResumeAudioContext()
      playSendSound()
      await sendMessage(context, message, currentSettings, selectedConfig, attachments)
    },
    [context, selectedConfig, currentSettings, sendMessage],
  )

  const handlePickConfig = useCallback(async (configId: string) => {
    setSelectedConfigId(configId)
  }, [])

  const [tools, setTools] = useState<ToolToggle[]>([])

  useEffect(() => {
    async function loadTools() {
      const availableTools = currentSettings?.completionSettings.availableTools
      const autoCallTools = currentSettings?.completionSettings.autoCallTools
      if (!availableTools || !autoCallTools || !context.projectId) {
        setTools([])
        return
      }
      try {
        const allTools = await factoryToolsService.listTools(context.projectId)

        const availableSet = new Set(availableTools)
        const autoSet = new Set(autoCallTools)

        const mapped: ToolToggle[] = allTools.map((t) => {
          const toolName = t.function.name
          return {
            name: toolName,
            description: t.function.description,
            available: availableSet.has(toolName),
            autoCall: autoSet.has(toolName),
          }
        })
        setTools(mapped)
      } catch (e) {
        setTools([])
      }
    }
    loadTools()
  }, [context.projectId])

  const toggleAvailable = useCallback(
    async (tool: ToolToggle) => {
      const availableTools = currentSettings?.completionSettings.availableTools
      const autoCallTools = currentSettings?.completionSettings.autoCallTools
      if (!availableTools || !autoCallTools) {
        return
      }
      const newTool = { ...tool, available: !tool.available }
      setTools((prev) => prev.map((t) => (t.name === tool.name ? newTool : t)))

      const availableSet = new Set(availableTools)
      const autoSet = new Set(autoCallTools)

      if (tool.available) {
        availableSet.delete(tool.name)
        autoSet.delete(tool.name)
        await persistSettings({
          availableTools: Array.from(availableSet),
          autoCallTools: Array.from(autoSet),
        })
      } else {
        availableSet.add(tool.name)
        await persistSettings({ availableTools: Array.from(availableSet) })
      }
    },
    [
      tools,
      persistSettings,
      currentSettings?.completionSettings.availableTools,
      currentSettings?.completionSettings.autoCallTools,
    ],
  )

  const toggleAutoCall = useCallback(
    async (tool: ToolToggle) => {
      if (!tool.available) return
      const autoCallTools = currentSettings?.completionSettings.autoCallTools
      if (!autoCallTools) {
        return
      }
      const newTool = { ...tool, autoCall: !tool.autoCall }
      setTools((prev) => prev.map((t) => (t.name === tool.name ? newTool : t)))

      const autoSet = new Set(autoCallTools)

      if (tool.autoCall) {
        autoSet.delete(tool.name)
      } else {
        autoSet.add(tool.name)
      }
      await persistSettings({ autoCallTools: Array.from(autoSet) })
    },
    [tools, persistSettings, currentSettings?.completionSettings.autoCallTools],
  )

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node
      if (!isSettingsOpen) return
      if (dropdownRef.current && dropdownRef.current.contains(t)) return
      if (settingsBtnRef.current && settingsBtnRef.current.contains(t)) return
      setIsSettingsOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (!isSettingsOpen) return
      if (e.key === 'Escape') setIsSettingsOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [isSettingsOpen])

  const contextArguments: ChatContextArguments = useMemo(() => {
    const args: ChatContextArguments = { ...context }
    if (context.projectId) {
      args.project = getProjectById(context.projectId)
    }
    if (context.storyId) {
      args.story = storiesById[context.storyId]
    }
    if (context.featureId) {
      args.feature = featuresById[context.featureId]
    }
    if (context.agentRunId) {
      args.run = runsHistory.find((r) => r.id === context.agentRunId)
    }
    return args
  }, [context, storiesById, featuresById, runsHistory, getProjectById])

  useEffect(() => {
    const update = async () => {
      try {
        const p = await getSettingsPrompt(contextArguments)
        setEffectivePrompt(p)
        setDraftPrompt(p)
      } catch {
        try {
          const def = await getDefaultPrompt(context)
          setEffectivePrompt(def)
          setDraftPrompt(def)
        } catch {
          setEffectivePrompt('')
          setDraftPrompt('')
        }
      }
    }
    update()
  }, [
    context,
    contextArguments,
    currentSettings?.systemPrompt,
    getSettingsPrompt,
    getDefaultPrompt,
  ])

  //TODO:
  useEffect(() => {
    const custom = currentSettings?.systemPrompt
    setDraftPrompt(custom ? custom : effectivePrompt)
  }, [effectivePrompt, currentSettings?.systemPrompt])

  // Build messages array with system prompt as the first message when present
  const messagesWithSystem: ChatMessage[] = useMemo(() => {
    const original = chat?.chat.messages || []
    if (original.length > 0 || !effectivePrompt) return original
    const systemMessage: ChatMessage = {
      completionMessage: {
        role: 'system',
        content: effectivePrompt,
        usage: { promptTokens: 0, completionTokens: 0 },
        askedAt: '',
        completedAt: '',
        durationMs: 0,
      },
    }
    return [systemMessage, ...original]
  }, [chat?.chat.messages, effectivePrompt])

  const shouldBorder = isCollapsible && (showLeftBorder ?? true)
  const sectionClass = [
    'flex-1 min-h-0 w-full h-full flex flex-col bg-[var(--surface-base)] overflow-hidden',
    shouldBorder ? 'border-l dark:border-neutral-800' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={sectionClass}>
      {/* Top header: constant size */}
      <header className="relative flex-shrink-0 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isCollapsible ? (
            <button
              type="button"
              onClick={onCollapse}
              className="btn-secondary btn-icon"
              aria-label={'Collapse chat sidebar'}
              title={'Collapse chat sidebar'}
            >
              <IconChevron className="w-4 h-4" style={{ transform: 'rotate(90deg)' }} />
            </button>
          ) : null}
          <ContextInfoButton context={context} label={chatContextTitle} />
        </div>
        <div className="flex items-center gap-2">
          <ModelChip
            editable
            selectedConfigId={selectedConfigId}
            onPickConfigId={handlePickConfig}
            className="border-blue-500"
          />

          <button
            ref={settingsBtnRef}
            onClick={() => setIsSettingsOpen((v) => !v)}
            className="btn-secondary btn-icon"
            aria-haspopup="menu"
            aria-expanded={isSettingsOpen}
            aria-label="Open Chat Settings"
            title="Chat settings"
          >
            <IconSettings className="h-[16px] w-[16px]" />
          </button>

          {isSettingsOpen && (
            <div
              ref={dropdownRef}
              className="absolute top-full right-3 left-3 mt-2 w-auto max-w-[520px] ml-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-xl z-50"
              role="menu"
              aria-label="Chat Settings"
            >
              <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  Chat Settings
                </div>
                <div className="text-xs text-[var(--text-secondary)]">Controls for this chat</div>
              </div>

              <div className="p-3 space-y-4 max-h-[70vh] overflow-auto">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-[var(--text-secondary)]">
                    System Prompt
                  </div>
                  <textarea
                    value={draftPrompt}
                    onChange={(e) => setDraftPrompt(e.target.value)}
                    className="w-full min-h-[100px] p-2 border border-[var(--border-subtle)] bg-[var(--surface-overlay)] rounded-md text-sm"
                    placeholder="Custom system prompt for this chat context..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      className="btn"
                      onClick={async () => {
                        await updateSettingsPrompt(context, draftPrompt)
                      }}
                    >
                      Save prompt
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={async () => {
                        await resetSettingsPrompt(context)
                      }}
                    >
                      Reset to defaults
                    </button>
                  </div>
                </div>

                {tools ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-[var(--text-secondary)]">Tools</div>
                    <div className="rounded-md border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
                      {tools.length === 0 ? (
                        <div className="text-xs text-[var(--text-secondary)] px-2 py-3">
                          No tools available for this context.
                        </div>
                      ) : (
                        tools.map((tool) => (
                          <div key={tool.name} className="px-2 py-2 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="text-sm text-[var(--text-primary)] truncate">
                                  {tool.name}
                                </div>
                                <div className="text-xs text-neutral-500 font-light truncate">
                                  {tool.description}
                                </div>
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex flex-col items-center space-y-px">
                                  <span className="text-[10px] text-[var(--text-secondary)]">
                                    Available
                                  </span>
                                  <Switch
                                    checked={tool.available}
                                    onCheckedChange={() => toggleAvailable(tool)}
                                    label=""
                                  />
                                </div>
                                <div className="flex flex-col items-center space-y-px">
                                  <span className="text-[10px] text-[var(--text-secondary)]">
                                    Auto-call
                                  </span>
                                  <Switch
                                    checked={tool.available ? tool.autoCall : false}
                                    onCheckedChange={() => toggleAutoCall(tool)}
                                    label=""
                                    disabled={!tool.available}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {!isConfigured && (
          <div
            className="flex-shrink-0 mx-4 mt-3 rounded-md border border-[var(--border-default)] p-2 text-[13px] flex items-center justify-between gap-2"
            style={{
              background: 'color-mix(in srgb, var(--accent-primary) 10%, var(--surface-raised))',
              color: 'var(--text-primary)',
            }}
            role="status"
          >
            <span>
              LLM not configured. Set your API key in Settings to enable sending messages.
            </span>
            <button className="btn" onClick={() => navigateView('Settings')}>
              Configure
            </button>
          </div>
        )}

        <MessageList chatId={chat?.key} messages={messagesWithSystem} isThinking={isThinking} />
      </div>

      <div className="flex-shrink-0 max-h-[40%] overflow-y-auto">
        <ChatInput onSend={handleSend} isThinking={isThinking} isConfigured={isConfigured} />
      </div>
    </section>
  )
}
