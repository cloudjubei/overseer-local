import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLLMConfig } from '../../contexts/LLMConfigContext'
import { useNavigator } from '../../navigation/Navigator'
// import { useChats, type ChatState } from '../../contexts/ChatsContext'
import { useChats } from '../../contexts/chats/ChatsContext'
import { type ChatState } from '../../contexts/chats/ChatsTypes'
import { ChatInput, MessageList } from '.'
import { playSendSound, tryResumeAudioContext } from '../../assets/sounds'
import type {
  ChatContext,
  CompletionMessage,
  ChatContextArguments,
  CompletionSettings,
} from 'thefactory-tools'
import ContextInfoButton from '../ui/ContextInfoButton'
import ModelChip from '../agents/ModelChip'
import { IconSettings, IconChevron, IconScroll, IconRefreshChat, IconCode } from '../ui/icons/Icons'
import { IconCalculator } from '../ui/icons/IconCalculator'
import { useProjectContext } from '../../contexts/ProjectContext'
import { useStories } from '../../contexts/StoriesContext'
import { ToolSchemas, ALL_CHAT_AGENT_TOOLS } from 'thefactory-tools/constants'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { useChatUnread } from '@renderer/hooks/useChatUnread'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { getChatContextKey } from 'thefactory-tools/utils'
import { useNotifications } from '@renderer/hooks/useNotifications'
import UsageModal from './UsageModal'
import ChatSettingsDropdown, { type ToolToggle } from './ChatSettingsDropdown'
import { useChatDraft } from './hooks/useChatDraft'
import ChatDynamicContextModal from './ChatDynamicContextModal'
import { useToast } from '../ui/Toast'

export type ChatSidebarProps = {
  context: ChatContext
  chatContextTitle: string
  isCollapsible?: boolean
  onCollapse?: () => void
  showLeftBorder?: boolean
}

type SendMeta = { reason?: 'user' | 'suggested_action' }

function formatUSD(n?: number) {
  if (n == null || Number.isNaN(n)) return '—'
  return `$${n.toFixed(4)}`
}

export default function ChatSidebar({
  context,
  chatContextTitle,
  isCollapsible,
  onCollapse,
  showLeftBorder,
}: ChatSidebarProps) {
  const {
    getChatIfExists,
    restartChat,
    sendMessage,
    resumeTools,
    retryCompletion,
    abortMessage,
    getSettings,
    updateCompletionSettings,
    getDefaultPrompt,
    getSettingsPrompt,
    updateSettingsPrompt,
    resetSettingsPrompt,
    deleteLastMessage,
    deleteChat,
  } = useChats()

  const { toast } = useToast()

  const { getProjectById } = useProjectContext()
  const { storiesById, featuresById } = useStories()
  // const { runsHistory } = useAgents()
  const { activeChatConfig, isChatConfigured } = useLLMConfig()
  const { navigateView } = useNavigator()
  const { markReadByKey } = useChatUnread()
  const { projectId: activeProjectId } = useActiveProject()
  const { markNotificationsByMetadata } = useNotifications()

  const [chat, setChat] = useState<ChatState | undefined>(undefined)
  const [effectivePrompt, setEffectivePrompt] = useState<string>('')
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false)
  const [isCostsModalOpen, setIsCostsModalOpen] = useState(false)
  const [isDynamicContextOpen, setIsDynamicContextOpen] = useState(false)

  const currentSettings = useMemo(() => getSettings(context), [getSettings, context])

  const chatKey = useMemo(() => getChatContextKey(context), [context])

  const {
    text: localText,
    setText: setLocalText,
    attachments: localAttachments,
    setAttachments: setLocalAttachments,
    selectionStart,
    selectionEnd,
    setSelection,
    flushPersist,
    clear,
    focusNonce,
  } = useChatDraft(chatKey)

  const persistSettings = useCallback(
    async (patch: Partial<CompletionSettings>) => {
      const prev = currentSettings?.completionSettings || ({} as any)
      const merged: Partial<CompletionSettings> = { ...prev, ...patch }
      await updateCompletionSettings(context, merged)
    },
    [context, updateCompletionSettings, currentSettings?.completionSettings],
  )

  const isDeletingRef = useRef(false)

  useEffect(() => {
    // New context mounted/selected; allow loading again.
    isDeletingRef.current = false
    const loadChat = async () => {
      if (isDeletingRef.current) return
      const c = await getChatIfExists(context)
      setChat(c)
    }
    void loadChat()
  }, [context, getChatIfExists])

  const computeLatestIso = useCallback((): string | undefined => {
    const msgs = chat?.chat.messages || []
    const lastMsg = msgs.length ? msgs[msgs.length - 1] : undefined
    const lastMsgIso = (() => {
      if (!lastMsg) return undefined
      return (lastMsg as any)?.completedAt || (lastMsg as any)?.startedAt || undefined
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

  const clearChatNotifications = useCallback(() => {
    const key = chat?.key
    if (!key) return
    const projectId = chat.chat.context.projectId ?? activeProjectId
    void markNotificationsByMetadata({ chatKey: key }, { category: 'chat_messages', projectId })
  }, [chat?.key, chat?.chat?.context?.projectId, activeProjectId, markNotificationsByMetadata])

  const handleAtBottomChange = useCallback(
    (isBottom: boolean) => {
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

      flushPersist()

      // Optimistically clear the persisted draft before the async gap.
      // If send fails, we restore (below).
      const shouldManageDraft = meta?.reason === 'user' || meta?.reason === undefined
      if (shouldManageDraft) {
        clear()
      }

      tryResumeAudioContext()
      playSendSound()

      if (meta?.reason !== 'suggested_action') {
        setScrollSignal((s) => s + 1)
      }

      try {
        await sendMessage(
          context,
          message,
          effectivePrompt,
          currentSettings,
          activeChatConfig,
          attachments,
        )
      } catch (e) {
        if (shouldManageDraft) {
          setLocalText(message)
          setLocalAttachments(attachments)
        }

        toast({
          variant: 'error',
          title: 'Message failed to send',
          description: 'Please check your connection / configuration and try again.',
        })

        throw e
      }
    },
    [
      isChatConfigured,
      activeChatConfig,
      currentSettings,
      flushPersist,
      clear,
      sendMessage,
      context,
      effectivePrompt,
      toast,
      setLocalText,
      setLocalAttachments,
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

  const contextArguments: ChatContextArguments = useMemo(() => {
    const args: ChatContextArguments = { ...context }
    if (context.projectId) args.project = getProjectById(context.projectId)
    if (context.storyId) args.story = storiesById[context.storyId]
    if (context.featureId) args.feature = featuresById[context.featureId]
    // if (context.agentRunId) args.run = runsHistory.find((r) => r.id === context.agentRunId)
    return args
  }, [context, storiesById, featuresById, getProjectById])

  useEffect(() => {
    const update = async () => {
      const p = await getSettingsPrompt(contextArguments)
      setEffectivePrompt(p)
      if (currentSettings?.systemPrompt) {
        setDraftPrompt(currentSettings.systemPrompt)
      } else {
        const def = await getDefaultPrompt(context)
        setDraftPrompt(def)
      }
    }
    void update()
  }, [
    context,
    contextArguments,
    currentSettings?.systemPrompt,
    getSettingsPrompt,
    getDefaultPrompt,
  ])

  useEffect(() => {
    const custom = currentSettings?.systemPrompt
    if (custom) setDraftPrompt(custom)
  }, [currentSettings?.systemPrompt])

  const prevPromptRef = useRef<string>('')
  const cachedEmptyMsgsRef = useRef<CompletionMessage[]>([])

  const messagesWithSystem: CompletionMessage[] = useMemo(() => {
    const original = chat?.chat.messages || []
    if (original.length > 0) return original
    if (!effectivePrompt) return original

    if (effectivePrompt !== prevPromptRef.current || cachedEmptyMsgsRef.current.length === 0) {
      prevPromptRef.current = effectivePrompt
      cachedEmptyMsgsRef.current = [
        {
          role: 'system',
          content: effectivePrompt,
          startedAt: '',
          completedAt: '',
          durationMs: 0,
        } as any,
      ]
    }
    return cachedEmptyMsgsRef.current
  }, [chat?.chat.messages, effectivePrompt])

  const totalCostUSD = useMemo(() => {
    const msgs = chat?.chat.messages || []
    return (msgs as any[])
      .filter((m) => m?.role === 'assistant')
      .reduce((sum, m) => sum + (typeof m?.usage?.cost === 'number' ? m.usage.cost : 0), 0)
  }, [chat?.chat.messages])

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
      if ((msgs[i] as any)?.role === 'assistant') return (msgs[i] as any).suggestedActions
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
      const generalPath = getChatContextKey(general)
      const targetHash = `#chats${generalPath}`
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash
      } else {
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      }
      setIsSettingsOpen(false)
    }
  }, [context, activeProjectId, deleteChat])

  const handleDeleteLastMessage = useCallback(() => {
    deleteLastMessage(context)
  }, [deleteLastMessage, context])

  const onRetry = useMemo(() => {
    if (!(isChatConfigured && activeChatConfig && currentSettings)) return undefined
    return () => retryCompletion(context, effectivePrompt, currentSettings, activeChatConfig)
  }, [
    isChatConfigured,
    activeChatConfig,
    currentSettings,
    retryCompletion,
    context,
    effectivePrompt,
  ])

  const handleInputChange = useCallback(
    (text: string) => {
      setLocalText(text)
    },
    [setLocalText],
  )

  const handleAttachmentsChange = useCallback(
    (next: string[]) => {
      setLocalAttachments(next)
    },
    [setLocalAttachments],
  )

  return (
    <section className={sectionClass}>
      <header className="relative flex-shrink-0 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isCollapsible ? (
            <button
              type="button"
              onClick={onCollapse}
              className="btn-secondary btn-icon"
              aria-label="Collapse chat sidebar"
              title="Collapse chat sidebar"
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

          <button
            onClick={() => setIsCostsModalOpen(true)}
            className="btn-secondary btn-icon"
            aria-label="View usage costs"
            title={totalCostUSD > 0 ? `Total cost: ${formatUSD(totalCostUSD)}` : 'Usage costs'}
          >
            <IconCalculator className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsDynamicContextOpen(true)}
            className="btn-secondary btn-icon"
            aria-label="View dynamic context"
            title="Dynamic context"
          >
            <IconCode className="w-4 h-4" />
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

          <ChatSettingsDropdown
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            context={context}
            completion={completion}
            draftPrompt={draftPrompt}
            setDraftPrompt={setDraftPrompt}
            onSavePrompt={async () => {
              await updateSettingsPrompt(context, draftPrompt)
            }}
            onResetPrompt={async () => {
              await resetSettingsPrompt(context)
            }}
            tools={tools}
            toggleAvailable={toggleAvailable}
            toggleAutoCall={toggleAutoCall}
            persistSettings={persistSettings}
            onDeleteChat={handleDeleteChat}
            settingsBtnRef={settingsBtnRef}
          />
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
          onDeleteLastMessage={handleDeleteLastMessage}
          onAtBottomChange={handleAtBottomChange}
          onReadLatest={handleReadLatest}
          scrollToBottomSignal={scrollSignal}
          onRetry={onRetry}
        />
      </div>

      <div className="flex-shrink-0">
        <ChatInput
          value={localText}
          attachments={localAttachments}
          clearOnSend={true}
          clearOnSuggestedAction={false}
          onChange={handleInputChange}
          onChangeAttachments={handleAttachmentsChange}
          selectionStart={selectionStart}
          selectionEnd={selectionEnd}
          onSelectionChange={setSelection}
          restoreKey={chatKey}
          autoFocus={focusNonce > 0}
          onSend={handleSend}
          onAbort={handleAbort}
          isThinking={isThinking}
          suggestedActions={suggestedActions}
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

      <UsageModal
        isOpen={isCostsModalOpen}
        onClose={() => setIsCostsModalOpen(false)}
        messages={chat?.chat.messages || []}
        chatKey={chatKey}
      />

      <ChatDynamicContextModal
        isOpen={isDynamicContextOpen}
        onClose={() => setIsDynamicContextOpen(false)}
        dynamicContext={chat?.chat.dynamicContext}
      />
    </section>
  )
}
