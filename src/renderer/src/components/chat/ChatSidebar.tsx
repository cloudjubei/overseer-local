import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLLMConfig } from '../../contexts/LLMConfigContext'
import { useNavigator } from '../../navigation/Navigator'
import { useChats, ChatState } from '../../contexts/ChatsContext'
import { ChatInput, MessageList } from '.'
import { playSendSound, tryResumeAudioContext } from '../../assets/sounds'
import { Switch } from '../ui/Switch'
import type { ChatContext, ChatMessage, ChatContextArguments, CompletionSettings } from 'thefactory-tools'
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
import { useNotifications } from '@renderer/hooks/useNotifications'

export type ChatSidebarProps = {
  context: ChatContext
  chatContextTitle: string
  isCollapsible?: boolean
  onCollapse?: () => void
  showLeftBorder?: boolean
}

type ToolToggle = { name: string; description: string; available: boolean; autoCall: boolean }

type SelectionPatch = { selectionStart?: number; selectionEnd?: number }

type SendMeta = { reason?: 'user' | 'suggested_action' }

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
    // drafts
    getDraft,
    setDraft,
    clearDraft,
  } = useChats()

  const { getProjectById } = useProjectContext()
  const { storiesById, featuresById } = useStories()
  const { runsHistory } = useAgents()
  const { activeChatConfig, isChatConfigured } = useLLMConfig()
  const { navigateView } = useNavigator()
  const { markReadByKey } = useChatUnread()
  const { projectId: activeProjectId } = useActiveProject()
  const { markNotificationsByMetadata } = useNotifications()

  const [chat, setChat] = useState<ChatState | undefined>(undefined)
  const [effectivePrompt, setEffectivePrompt] = useState<string>('')
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)

  const currentSettings = useMemo(() => getSettings(context), [getSettings, context])

  const chatKey = useMemo(() => getChatContextPath(context), [context])
  const draft = useMemo(() => getDraft(chatKey), [getDraft, chatKey])

  // --- Local input state ---
  const prevChatKeyRef = useRef<string | undefined>(undefined)
  const [localText, setLocalText] = useState<string>(draft.text)
  const [localAttachments, setLocalAttachments] = useState<string[]>(draft.attachments)

  // Selection is kept in refs to avoid re-rendering the whole sidebar while selecting/typing.
  const localSelectionStartRef = useRef<number | undefined>(draft.selectionStart)
  const localSelectionEndRef = useRef<number | undefined>(draft.selectionEnd)

  const draftPersistTimerRef = useRef<number | null>(null)
  const selectionPersistTimerRef = useRef<number | null>(null)

  const flushDraftPersist = useCallback(() => {
    if (draftPersistTimerRef.current) {
      window.clearTimeout(draftPersistTimerRef.current)
      draftPersistTimerRef.current = null
    }
    setDraft(chatKey, { text: localText, attachments: localAttachments })
  }, [chatKey, setDraft, localText, localAttachments])

  // When switching chats, reset local state from stored draft.
  useEffect(() => {
    // Only reset local UI when the chat context actually changes.
    // Incoming messages can cause the Chats provider to update and change function identities
    // (e.g. getDraft), which would otherwise risk clobbering in-progress typing.
    if (prevChatKeyRef.current === chatKey) return
    prevChatKeyRef.current = chatKey

    if (draftPersistTimerRef.current) {
      window.clearTimeout(draftPersistTimerRef.current)
      draftPersistTimerRef.current = null
    }
    if (selectionPersistTimerRef.current) {
      window.clearTimeout(selectionPersistTimerRef.current)
      selectionPersistTimerRef.current = null
    }

    setLocalText(draft.text)
    setLocalAttachments(draft.attachments)
    localSelectionStartRef.current = draft.selectionStart
    localSelectionEndRef.current = draft.selectionEnd
  }, [
    chatKey,
    draft.text,
    draft.attachments,
    draft.selectionStart,
    draft.selectionEnd,
  ])

  // If an external actor changes the stored draft for the current chatKey, sync it.
  // Keep this conservative to avoid fighting the user's typing.
  useEffect(() => {
    setLocalAttachments(draft.attachments)
  }, [draft.attachments])

  useEffect(() => {
    return () => {
      if (draftPersistTimerRef.current) window.clearTimeout(draftPersistTimerRef.current)
      if (selectionPersistTimerRef.current) window.clearTimeout(selectionPersistTimerRef.current)
    }
  }, [])

  const schedulePersistDraftText = useCallback(
    (text: string) => {
      if (draftPersistTimerRef.current) window.clearTimeout(draftPersistTimerRef.current)
      draftPersistTimerRef.current = window.setTimeout(() => {
        draftPersistTimerRef.current = null
        setDraft(chatKey, { text })
      }, 150)
    },
    [chatKey, setDraft],
  )

  const schedulePersistSelection = useCallback(
    (sel: SelectionPatch) => {
      if (selectionPersistTimerRef.current) window.clearTimeout(selectionPersistTimerRef.current)
      selectionPersistTimerRef.current = window.setTimeout(() => {
        selectionPersistTimerRef.current = null
        setDraft(chatKey, sel)
      }, 250)
    },
    [chatKey, setDraft],
  )

  // Force focus restoration on context change (incrementing nonce allows ChatInput to re-run focus effect)
  const [focusNonce, setFocusNonce] = useState(0)
  useEffect(() => {
    setFocusNonce((x) => x + 1)
  }, [chatKey])

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
        console.warn('Chat load failed (possibly deleted)', e)
      }
    }
    void loadChat()
  }, [context, getChat])

  // Track whether the user is at the bottom to decide read state
  const atBottomRef = useRef<boolean>(false)
  const [atBottom, setAtBottom] = useState<boolean>(false)
  useEffect(() => {
    atBottomRef.current = atBottom
  }, [atBottom])

  const computeLatestIso = useCallback((): string | undefined => {
    const msgs = chat?.chat.messages || []
    const lastMsg = msgs.length ? msgs[msgs.length - 1] : undefined
    const lastMsgIso = (() => {
      if (!lastMsg) return undefined
      const cm = (lastMsg as any)?.completionMessage
      return (cm?.completedAt as string) || (cm?.startedAt as string) || undefined
    })()
    const updatedAt = chat?.chat.updatedAt
    if (updatedAt && lastMsgIso) return updatedAt.localeCompare(lastMsgIso) >= 0 ? updatedAt : lastMsgIso
    return updatedAt || lastMsgIso
  }, [chat?.chat.messages, chat?.chat.updatedAt])

  const markLatestAsRead = useCallback(() => {
    const key = chat?.key
    if (!key) return
    const iso = computeLatestIso() || new Date().toISOString()
    markReadByKey(key, iso)
  }, [chat?.key, computeLatestIso, markReadByKey])

  const clearChatNotifications = useCallback(() => {
    const key = chat?.key
    if (!key) return
    const projectId = chat.chat.context.projectId ?? activeProjectId
    void markNotificationsByMetadata({ chatKey: key }, { category: 'chat_messages', projectId })
  }, [chat?.key, chat?.chat?.context?.projectId, activeProjectId, markNotificationsByMetadata])

  const handleAtBottomChange = useCallback(
    (isBottom: boolean) => {
      setAtBottom(isBottom)
      if (isBottom) {
        markLatestAsRead()
        clearChatNotifications()
      }
    },
    [markLatestAsRead, clearChatNotifications],
  )

  const handleReadLatest = useCallback(
    (iso?: string) => {
      const key = chat?.key
      if (!key) return

      const freshest = (() => {
        const computed = computeLatestIso()
        if (computed && iso) return computed.localeCompare(iso) >= 0 ? computed : iso
        return computed || iso || new Date().toISOString()
      })()

      markReadByKey(key, freshest)
      clearChatNotifications()
    },
    [chat?.key, computeLatestIso, markReadByKey, clearChatNotifications],
  )

  const isThinking = chat?.isThinking || false

  const [draftPrompt, setDraftPrompt] = useState<string>('')
  const [scrollSignal, setScrollSignal] = useState<number>(0)

  const handleSend = useCallback(
    async (message: string, attachments: string[], meta?: SendMeta) => {
      if (!isChatConfigured || !activeChatConfig || !currentSettings) return

      // Flush pending draft persistence so we don't keep stale drafts around.
      flushDraftPersist()

      tryResumeAudioContext()
      playSendSound()

      // Only user-originated sends should force-scroll the message list.
      if (meta?.reason !== 'suggested_action') {
        setScrollSignal((s) => s + 1)
      }

      await sendMessage(context, message, effectivePrompt, currentSettings, activeChatConfig, attachments)

      // Only clear drafts + local UI for real user sends.
      if (meta?.reason === 'user' || meta?.reason === undefined) {
        clearDraft(chatKey)
        setLocalText('')
        setLocalAttachments([])
        localSelectionStartRef.current = undefined
        localSelectionEndRef.current = undefined
      }
    },
    [
      isChatConfigured,
      activeChatConfig,
      currentSettings,
      flushDraftPersist,
      sendMessage,
      context,
      effectivePrompt,
      clearDraft,
      chatKey,
    ],
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
      if (!availableTools || !autoCallTools) return

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
      persistSettings,
      currentSettings?.completionSettings.availableTools,
      currentSettings?.completionSettings.autoCallTools,
    ],
  )

  const toggleAutoCall = useCallback(
    async (tool: ToolToggle) => {
      if (!tool.available) return
      const autoCallTools = currentSettings?.completionSettings.autoCallTools
      if (!autoCallTools) return

      const newTool = { ...tool, autoCall: !tool.autoCall }
      setTools((prev) => prev.map((t) => (t.name === tool.name ? newTool : t)))

      const autoSet = new Set(autoCallTools)
      if (tool.autoCall) autoSet.delete(tool.name)
      else autoSet.add(tool.name)

      await persistSettings({ autoCallTools: Array.from(autoSet) })
    },
    [persistSettings, currentSettings?.completionSettings.autoCallTools],
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
    if (context.projectId) args.project = getProjectById(context.projectId)
    if (context.storyId) args.story = storiesById[context.storyId]
    if (context.featureId) args.feature = featuresById[context.featureId]
    if (context.agentRunId) args.run = runsHistory.find((r) => r.id === context.agentRunId)
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
    void update()
  }, [context, contextArguments, currentSettings?.systemPrompt, getSettingsPrompt, getDefaultPrompt])

  useEffect(() => {
    const custom = currentSettings?.systemPrompt
    if (custom) setDraftPrompt(custom)
  }, [currentSettings?.systemPrompt])

  const prevPromptRef = useRef<string>('')
  const cachedEmptyMsgsRef = useRef<ChatMessage[]>([])

  const messagesWithSystem: ChatMessage[] = useMemo(() => {
    const original = chat?.chat.messages || []
    if (original.length > 0) return original
    if (!effectivePrompt) return original

    if (effectivePrompt !== prevPromptRef.current || cachedEmptyMsgsRef.current.length === 0) {
      prevPromptRef.current = effectivePrompt
      cachedEmptyMsgsRef.current = [
        {
          completionMessage: {
            role: 'system',
            content: effectivePrompt,
            usage: { promptTokens: 0, completionTokens: 0 },
            startedAt: '',
            completedAt: '',
            durationMs: 0,
          },
        },
      ]
    }
    return cachedEmptyMsgsRef.current
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

  const suggestedActions = useMemo(() => {
    if (isThinking) return undefined
    const msgs = chat?.chat.messages || []
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].completionMessage?.role === 'assistant') return msgs[i].suggestedActions
    }
    return undefined
  }, [chat?.chat.messages, isThinking])

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
      const general = { type: 'PROJECT', projectId } as ChatContext
      try {
        localStorage.setItem('chat-last-selected-context', JSON.stringify(general))
      } catch {}
      const generalPath = getChatContextPath(general).replace(/\.json$/, '')
      const targetHash = `#chat/${generalPath}`
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash
      } else {
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      }
      setIsSettingsOpen(false)
      isDeletingRef.current = false
    }
  }, [context, activeProjectId, deleteChat])

  const handleDeleteLastMessage = useCallback(() => {
    deleteLastMessage(context)
  }, [deleteLastMessage, context])

  const onRetry = useMemo(() => {
    if (!(isChatConfigured && activeChatConfig && currentSettings)) return undefined
    return () => retryCompletion(context, effectivePrompt, currentSettings, activeChatConfig)
  }, [isChatConfigured, activeChatConfig, currentSettings, retryCompletion, context, effectivePrompt])

  const handleInputChange = useCallback(
    (text: string) => {
      setLocalText(text)
      schedulePersistDraftText(text)
    },
    [schedulePersistDraftText],
  )

  const handleAttachmentsChange = useCallback(
    (next: string[]) => {
      setLocalAttachments(next)
      setDraft(chatKey, { attachments: next })
    },
    [chatKey, setDraft],
  )

  const handleSelectionChange = useCallback(
    (sel: SelectionPatch) => {
      localSelectionStartRef.current = sel.selectionStart
      localSelectionEndRef.current = sel.selectionEnd
      schedulePersistSelection(sel)
    },
    [schedulePersistSelection],
  )

  return (
    <section className={sectionClass}>
      <header className='relative flex-shrink-0 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2 min-w-0'>
          {isCollapsible ? (
            <button
              type='button'
              onClick={onCollapse}
              className='btn-secondary btn-icon'
              aria-label={'Collapse chat sidebar'}
              title={'Collapse chat sidebar'}
            >
              <IconChevron className='w-4 h-4' style={{ transform: 'rotate(90deg)' }} />
            </button>
          ) : null}
          <ContextInfoButton context={context} label={chatContextTitle} />
          <button
            onClick={() => setIsPromptModalOpen(true)}
            className='btn-secondary btn-icon'
            aria-label='View System Prompt'
            title='View System Prompt'
          >
            <IconScroll className='w-4 h-4' />
          </button>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            className='btn-secondary w-[34px]'
            variant='danger'
            aria-label='Refresh chat'
            title='Refresh chat'
            onClick={() => restartChat(context)}
          >
            <IconRefreshChat className='w-4 h-4' />
          </Button>
          <ModelChip editable className='border-blue-500' mode='chat' />

          <button
            ref={settingsBtnRef}
            onClick={() => setIsSettingsOpen((v) => !v)}
            className='btn-secondary btn-icon'
            aria-haspopup='menu'
            aria-expanded={isSettingsOpen}
            aria-label='Open Chat Settings'
            title='Chat settings'
          >
            <IconSettings className='w-4 h-4' />
          </button>

          {isSettingsOpen && (
            <div
              ref={dropdownRef}
              className='absolute top-full right-3 left-3 mt-2 w-auto max-w-[520px] ml-auto rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-xl z-50'
              role='menu'
              aria-label='Chat Settings'
            >
              <div className='px-3 py-2 border-b border-[var(--border-subtle)]'>
                <div className='text-sm font-semibold text-[var(--text-primary)]'>Chat Settings</div>
                <div className='text-xs text-[var(--text-secondary)]'>Controls for this chat</div>
              </div>

              <div className='p-3 space-y-4 max-h-[70vh] overflow-auto'>
                <div className='space-y-2'>
                  <div className='text-xs font-medium text-[var(--text-secondary)]'>System Prompt</div>
                  <textarea
                    value={draftPrompt}
                    onChange={(e) => setDraftPrompt(e.target.value)}
                    className='w-full min-h-[100px] p-2 border border-[var(--border-subtle)] bg-[var(--surface-overlay)] rounded-md text-sm'
                    placeholder='Custom system prompt for this chat context...'
                  />
                  <div className='flex items-center gap-2'>
                    <button
                      className='btn'
                      onClick={async () => {
                        await updateSettingsPrompt(context, draftPrompt)
                      }}
                    >
                      Save prompt
                    </button>
                    <button
                      className='btn-secondary'
                      onClick={async () => {
                        await resetSettingsPrompt(context)
                      }}
                    >
                      Reset to defaults
                    </button>
                  </div>
                </div>

                {completion ? (
                  <div className='space-y-3'>
                    <div className='space-y-1'>
                      <div className='flex items-center justify-between'>
                        <label className='text-xs font-medium text-[var(--text-secondary)]' htmlFor='maxTurns'>
                          Max turns per run:
                          <span className='pl-4 text-[14px] text-[var(--text-secondary)]'>
                            {completion.maxTurns ?? ''}
                          </span>
                        </label>
                      </div>
                      <input
                        id='maxTurns'
                        type='range'
                        min={1}
                        max={100}
                        step={1}
                        value={completion.maxTurns ?? 1}
                        onChange={(e) => persistSettings({ maxTurns: Number(e.target.value) })}
                        className='w-full'
                      />
                      <div className='flex justify-between text-[10px] text-[var(--text-tertiary)]'>
                        <span>1</span>
                        <span>100</span>
                      </div>
                    </div>

                    <div className='space-y-1'>
                      <div className='flex items-center justify-between'>
                        <label
                          className='text-xs font-medium text-[var(--text-secondary)]'
                          htmlFor='numberMessagesToSend'
                        >
                          Number of messages to send:
                          <span className='pl-4 text-[14px] text-[var(--text-secondary)]'>
                            {completion.numberMessagesToSend ?? ''}
                          </span>
                        </label>
                      </div>
                      <input
                        id='numberMessagesToSend'
                        type='range'
                        min={3}
                        max={50}
                        step={1}
                        value={completion.numberMessagesToSend ?? 3}
                        onChange={(e) => persistSettings({ numberMessagesToSend: Number(e.target.value) })}
                        className='w-full'
                      />
                      <div className='flex justify-between text-[10px] text-[var(--text-tertiary)]'>
                        <span>3</span>
                        <span>20</span>
                      </div>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div className='flex flex-col'>
                        <span className='text-xs font-medium text-[var(--text-secondary)]'>Finish turn on errors</span>
                        <span className='text-[10px] text-[var(--text-tertiary)]'>
                          When enabled, the agent ends the current turn if a tool call errors
                        </span>
                      </div>
                      <Switch
                        checked={!!completion.finishTurnOnErrors}
                        onCheckedChange={(checked) => persistSettings({ finishTurnOnErrors: !!checked })}
                      />
                    </div>
                  </div>
                ) : null}

                {tools ? (
                  <div className='space-y-2'>
                    <div className='text-xs font-medium text-[var(--text-secondary)]'>Tools</div>
                    <div className='rounded-md border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]'>
                      {tools.length === 0 ? (
                        <div className='text-xs text-[var(--text-secondary)] px-2 py-3'>
                          No tools available for this context.
                        </div>
                      ) : (
                        tools.map((tool) => (
                          <div key={tool.name} className='px-2 py-2 space-y-1'>
                            <div className='flex items-center justify-between gap-2'>
                              <div className='flex-1 min-w-0 pr-2'>
                                <div className='text-sm text-[var(--text-primary)] truncate'>{tool.name}</div>
                                <div className='text-xs text-neutral-500 font-light truncate'>
                                  {tool.description}
                                </div>
                              </div>
                              <div className='flex flex-col items-center gap-1'>
                                <div className='flex flex-col items-center space-y-px'>
                                  <span className='text-[10px] text-[var(--text-secondary)]'>Available</span>
                                  <Switch checked={tool.available} onCheckedChange={() => toggleAvailable(tool)} />
                                </div>
                                <div className='flex flex-col items-center space-y-px'>
                                  <span className='text-[10px] text-[var(--text-secondary)]'>Auto-call</span>
                                  <Switch
                                    checked={tool.available ? tool.autoCall : false}
                                    onCheckedChange={() => toggleAutoCall(tool)}
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

                <div className='pt-2 border-t border-[var(--border-subtle)]'>
                  <Button variant='danger' onClick={handleDeleteChat}>
                    Delete this chat
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className='flex-1 min-h-0 flex flex-col overflow-hidden'>
        {!isChatConfigured && (
          <div
            className='flex-shrink-0 mx-4 mt-3 rounded-md border border-[var(--border-default)] p-2 text-[13px] flex items-center justify-between gap-2'
            style={{
              background: 'color-mix(in srgb, var(--accent-primary) 10%, var(--surface-raised))',
              color: 'var(--text-primary)',
            }}
            role='status'
          >
            <span>LLM not configured. Set your API key in Settings to enable sending messages.</span>
            <button className='btn' onClick={() => navigateView('Settings')}>
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
          onDeleteLastMessage={handleDeleteLastMessage}
          onAtBottomChange={handleAtBottomChange}
          onReadLatest={handleReadLatest}
          scrollToBottomSignal={scrollSignal}
          onRetry={onRetry}
        />
      </div>

      <div className='flex-shrink-0'>
        <ChatInput
          value={localText}
          attachments={localAttachments}
          clearOnSend={true}
          clearOnSuggestedAction={false}
          onChange={handleInputChange}
          onChangeAttachments={handleAttachmentsChange}
          selectionStart={localSelectionStartRef.current}
          selectionEnd={localSelectionEndRef.current}
          onSelectionChange={handleSelectionChange}
          restoreKey={chatKey}
          autoFocus={focusNonce > 0}
          onSend={handleSend}
          onAbort={handleAbort}
          isThinking={isThinking}
          suggestedActions={suggestedActions}
          isConfigured={isChatConfigured}
        />
      </div>

      <Modal isOpen={isPromptModalOpen} onClose={() => setIsPromptModalOpen(false)} title='System Prompt'>
        <div className='p-4 bg-[var(--surface-base)] text-sm text-[var(--text-secondary)] max-h-[70vh] overflow-auto'>
          <pre className='whitespace-pre-wrap font-sans'>{effectivePrompt}</pre>
        </div>
      </Modal>
    </section>
  )
}
