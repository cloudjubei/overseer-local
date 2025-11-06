import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLLMConfig } from '../../contexts/LLMConfigContext'
import { useNavigator } from '../../navigation/Navigator'
import { useChats, ChatState } from '../../contexts/ChatsContext'
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
import { IconSettings, IconChevron, IconScroll, IconRefreshChat } from '../ui/icons/Icons'
import { useProjectContext } from '../../contexts/ProjectContext'
import { useStories } from '../../contexts/StoriesContext'
import { useAgents } from '../../contexts/AgentsContext'
import { ToolSchemas, ALL_CHAT_AGENT_TOOLS } from 'thefactory-tools/constants'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { useChatUnread } from '@renderer/hooks/useChatUnread'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { getChatContextPath } from 'thefactory-tools/utils'

export type ChatSidebarProps = {
  context: ChatContext
  chatContextTitle: string
  isCollapsible?: boolean
  onCollapse?: () => void
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
    restartChat,
    sendMessage,
    resumeTools,
    retryCompletion,
    abortMessage,
    getSettings,
    resetSettings,
    updateCompletionSettings,
    getDefaultPrompt,
    getSettingsPrompt,
    updateSettingsPrompt,
    resetSettingsPrompt,
    deleteLastMessage,
    deleteChat,
  } = useChats()
  const { getProjectById } = useProjectContext()
  const { storiesById, featuresById } = useStories()
  const { runsHistory } = useAgents()
  const { activeChatConfig, isChatConfigured } = useLLMConfig()
  const { navigateView } = useNavigator()
  const { markReadByKey } = useChatUnread()
  const { projectId: activeProjectId } = useActiveProject()

  const [chat, setChat] = useState<ChatState | undefined>(undefined)
  const [effectivePrompt, setEffectivePrompt] = useState<string>('')
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)

  const currentSettings = useMemo(() => getSettings(context), [getSettings, context])

  // Ensure we do not clobber unrelated completion settings fields when updating a single field.
  const persistSettings = useCallback(
    async (patch: Partial<CompletionSettings>) => {
      const prev = currentSettings?.completionSettings || {}
      const merged: Partial<CompletionSettings> = { ...prev, ...patch }
      await updateCompletionSettings(context, merged)
    },
    [context, updateCompletionSettings, currentSettings?.completionSettings],
  )

  const isDeletingRef = useRef(false)

  useEffect(() => {
    const loadChat = async () => {
      if (isDeletingRef.current) return
      try {
        const c = await getChat(context)
        setChat(c)
      } catch (e) {
        // If chat does not exist, avoid recreating; simply no-op
        console.warn('Chat load failed (possibly deleted)', e)
      }
    }
    loadChat()
  }, [context, getChat])

  // Track whether the user is at the bottom to decide read state
  const atBottomRef = useRef<boolean>(true)
  const [atBottom, setAtBottom] = useState<boolean>(true)
  useEffect(() => {
    atBottomRef.current = atBottom
  }, [atBottom])

  // Helper: compute the freshest known ISO timestamp for the chat for read receipts
  const computeLatestIso = useCallback((): string | undefined => {
    const msgs = chat?.chat.messages || []
    const lastMsg = msgs.length ? msgs[msgs.length - 1] : undefined
    const lastMsgIso = (() => {
      if (!lastMsg) return undefined
      const cm = (lastMsg as any)?.completionMessage
      return (cm?.completedAt as string) || (cm?.startedAt as string) || undefined
    })()
    const updatedAt = chat?.chat.updatedAt
    if (updatedAt && lastMsgIso)
      return updatedAt.localeCompare(lastMsgIso) >= 0 ? updatedAt : lastMsgIso
    return updatedAt || lastMsgIso
  }, [chat?.chat.messages, chat?.chat.updatedAt])

  const markLatestAsRead = useCallback(() => {
    const key = chat?.key
    if (!key) return
    const iso = computeLatestIso() || new Date().toISOString()
    markReadByKey(key, iso)
  }, [chat?.key, computeLatestIso, markReadByKey])

  // Ensure that after the chat loads or updates, if the user is at bottom, we mark the latest as read.
  // This covers the case where MessageList triggers read before the chat is loaded, and on new incoming messages
  // while the user is already scrolled to the bottom.
  useEffect(() => {
    if (!chat?.key) return
    if (!atBottomRef.current) return
    // Use a microtask to avoid clobbering during initial render
    Promise.resolve().then(() => markLatestAsRead())
  }, [chat?.key, chat?.chat?.updatedAt, chat?.chat?.messages?.length, markLatestAsRead])

  // When the user scrolls to bottom, mark as read
  const handleAtBottomChange = useCallback(
    (isBottom: boolean) => {
      setAtBottom(isBottom)
      if (isBottom) {
        markLatestAsRead()
      }
    },
    [markLatestAsRead],
  )

  // When we detect the latest has been viewed (e.g., new message arrives while at bottom)
  const handleReadLatest = useCallback(
    (iso?: string) => {
      const key = chat?.key
      if (!key) return
      // Prefer the freshest between provided iso, chat.updatedAt, and last message
      const freshest = (() => {
        const computed = computeLatestIso()
        if (computed && iso) return computed.localeCompare(iso) >= 0 ? computed : iso
        return computed || iso || new Date().toISOString()
      })()
      markReadByKey(key, freshest)
    },
    [chat?.key, computeLatestIso, markReadByKey],
  )

  const isThinking = chat?.isThinking || false

  const [draftPrompt, setDraftPrompt] = useState<string>('')
  // Scroll control: bump this to ask MessageList to force-scroll to bottom
  const [scrollSignal, setScrollSignal] = useState<number>(0)

  const handleSend = useCallback(
    async (message: string, attachments: string[]) => {
      if (!isChatConfigured || !activeChatConfig || !currentSettings) return
      tryResumeAudioContext()
      playSendSound()
      // When the user posts a message, force the MessageList to scroll to the very bottom
      setScrollSignal((s) => s + 1)
      await sendMessage(
        context,
        message,
        effectivePrompt,
        currentSettings,
        activeChatConfig,
        attachments,
      )
    },
    [context, effectivePrompt, activeChatConfig, currentSettings, sendMessage],
  )

  const handleAbort = useCallback(() => {
    abortMessage(context)
  }, [abortMessage, context])

  const [tools, setTools] = useState<ToolToggle[]>([])

  useEffect(() => {
    const availableTools = currentSettings?.completionSettings.availableTools
    const autoCallTools = currentSettings?.completionSettings.autoCallTools
    if (!availableTools || !autoCallTools || !context.projectId) {
      setTools([])
      return
    }
    const allTools = Object.keys(ToolSchemas)

    const availableSet = new Set(availableTools)
    const autoSet = new Set(autoCallTools)
    const allAllowedSet = new Set(ALL_CHAT_AGENT_TOOLS)

    const mapped: ToolToggle[] = allTools
      .filter((t) => allAllowedSet.has(t))
      .map((t) => {
        const schema = ToolSchemas[t]
        const toolName = schema.name
        return {
          name: toolName,
          description: schema.description,
          available: availableSet.has(toolName),
          autoCall: autoSet.has(toolName),
        }
      })
    setTools(mapped)
  }, [context.projectId, currentSettings])

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
      const p = await getSettingsPrompt(contextArguments)
      setEffectivePrompt(p)
      if (currentSettings?.systemPrompt) {
        setDraftPrompt(currentSettings?.systemPrompt)
      } else {
        const def = await getDefaultPrompt(context)
        setDraftPrompt(def)
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

  useEffect(() => {
    const custom = currentSettings?.systemPrompt
    if (custom) {
      setDraftPrompt(custom)
    }
  }, [currentSettings?.systemPrompt])

  const messagesWithSystem: ChatMessage[] = useMemo(() => {
    const original = chat?.chat.messages || []
    if (original.length > 0 || !effectivePrompt) return original
    const systemMessage: ChatMessage = {
      completionMessage: {
        role: 'system',
        content: effectivePrompt,
        usage: { promptTokens: 0, completionTokens: 0 },
        startedAt: '',
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

  const completion = currentSettings?.completionSettings

  const handleResumeTools = useCallback(
    async (toolIds: string[]) => {
      if (!isChatConfigured || !activeChatConfig || !currentSettings) return
      await resumeTools(context, toolIds, effectivePrompt, currentSettings, activeChatConfig)
    },
    [isChatConfigured, activeChatConfig, currentSettings, resumeTools, context, effectivePrompt],
  )

  const handleDeleteChat = useCallback(async () => {
    const projectId = context.projectId || activeProjectId
    if (!projectId) return

    if (context.type === 'PROJECT') {
      window.alert('The General chat cannot be deleted.')
      return
    }

    const confirmed = window.confirm('Delete this chat? This action cannot be undone.')
    if (!confirmed) return

    isDeletingRef.current = true
    try {
      await deleteChat(context)
    } catch (e) {
      console.error('Failed to delete chat', e)
    } finally {
      // Navigate to General chat for this project without leaving Chat view
      const general = { type: 'PROJECT', projectId } as ChatContext
      try {
        localStorage.setItem('chat-last-selected-context', JSON.stringify(general))
      } catch {}
      const generalPath = getChatContextPath(general).replace(/\.json$/, '')
      const targetHash = `#chat/${generalPath}`
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash
      } else {
        // If already on the same hash, manually dispatch to trigger selection
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      }
      setIsSettingsOpen(false)
      isDeletingRef.current = false
    }
  }, [context, activeProjectId, deleteChat])

  return (
    <section className={sectionClass}>
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
          <button
            onClick={() => setIsPromptModalOpen(true)}
            className="btn-secondary btn-icon"
            aria-label="View System Prompt"
            title="View System Prompt"
          >
            <IconScroll className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="btn-secondary w-[34px]"
            variant="danger"
            aria-label="Refresh chat"
            title="Refresh chat"
            onClick={() => restartChat(context)}
          >
            <IconRefreshChat className="w-4 h-4" />
          </Button>
          <ModelChip editable className="border-blue-500" mode="chat" />

          <button
            ref={settingsBtnRef}
            onClick={() => setIsSettingsOpen((v) => !v)}
            className="btn-secondary btn-icon"
            aria-haspopup="menu"
            aria-expanded={isSettingsOpen}
            aria-label="Open Chat Settings"
            title="Chat settings"
          >
            <IconSettings className="w-4 h-4" />
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

                {completion ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label
                          className="text-xs font-medium text-[var(--text-secondary)]"
                          htmlFor="maxTurns"
                        >
                          Max turns per run:
                          <span className="pl-4 text-[14px] text-[var(--text-secondary)]">
                            {completion.maxTurns ?? ''}
                          </span>
                        </label>
                      </div>
                      <input
                        id="maxTurns"
                        type="range"
                        min={1}
                        max={100}
                        step={1}
                        value={completion.maxTurns ?? 1}
                        onChange={(e) => persistSettings({ maxTurns: Number(e.target.value) })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
                        <span>1</span>
                        <span>100</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label
                          className="text-xs font-medium text-[var(--text-secondary)]"
                          htmlFor="numberMessagesToSend"
                        >
                          Number of messages to send:
                          <span className="pl-4 text-[14px] text-[var(--text-secondary)]">
                            {completion.numberMessagesToSend ?? ''}
                          </span>
                        </label>
                      </div>
                      <input
                        id="numberMessagesToSend"
                        type="range"
                        min={3}
                        max={50}
                        step={1}
                        value={completion.numberMessagesToSend ?? 3}
                        onChange={(e) =>
                          persistSettings({ numberMessagesToSend: Number(e.target.value) })
                        }
                        className="w-full"
                      />
                      <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
                        <span>3</span>
                        <span>20</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          Finish turn on errors
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          When enabled, the agent ends the current turn if a tool call errors
                        </span>
                      </div>
                      <Switch
                        checked={!!completion.finishTurnOnErrors}
                        onCheckedChange={(checked) =>
                          persistSettings({ finishTurnOnErrors: !!checked })
                        }
                      />
                    </div>
                  </div>
                ) : null}

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

                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  <Button variant="danger" onClick={handleDeleteChat}>
                    Delete this chat
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {!isChatConfigured && (
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

        <MessageList
          chatId={chat?.key}
          messages={messagesWithSystem}
          isThinking={isThinking}
          onResumeTools={handleResumeTools}
          numberMessagesToSend={completion?.numberMessagesToSend}
          onDeleteLastMessage={() => deleteLastMessage(context)}
          onAtBottomChange={handleAtBottomChange}
          onReadLatest={handleReadLatest}
          scrollToBottomSignal={scrollSignal}
          onRetry={
            isChatConfigured && activeChatConfig && currentSettings
              ? () => retryCompletion(context, effectivePrompt, currentSettings, activeChatConfig)
              : undefined
          }
        />
      </div>

      <div className="flex-shrink-0 max-h-[40%] overflow-y-auto">
        <ChatInput
          onSend={handleSend}
          onAbort={handleAbort}
          isThinking={isThinking}
          isConfigured={isChatConfigured}
        />
      </div>
      <Modal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        title="System Prompt"
      >
        <div className="p-4 bg-[var(--surface-base)] text-sm text-[var(--text-secondary)] max-h-[70vh] overflow-auto">
          <pre className="whitespace-pre-wrap font-sans">{effectivePrompt}</pre>
        </div>
      </Modal>
    </section>
  )
}
