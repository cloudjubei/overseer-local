import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLLMConfig } from '../../contexts/LLMConfigContext'
import { useNavigator } from '../../navigation/Navigator'
import { useChats, ChatState } from '../../contexts/ChatsContext'
import { factoryToolsService } from '../../services/factoryToolsService'
import { ChatInput, MessageList } from '.'
import { playSendSound, tryResumeAudioContext } from '../../assets/sounds'
import { Switch } from '../ui/Switch'
import type { ChatContext } from 'thefactory-tools'
import ContextInfoButton from '../ui/ContextInfoButton'
import ModelChip from '../agents/ModelChip'
import { IconSettings, IconChevron } from '../ui/Icons'

export type ChatSidebarProps = {
  context: ChatContext
  chatContextTitle: string
  // When provided, ChatSidebar shows a collapse button and calls this to request collapse
  isCollapsible?: boolean
  onCollapse?: () => void
}

function parseProjectIdFromContext(context: ChatContext): string | undefined {
  if (context && 'projectId' in context) {
    return context.projectId
  }
  return undefined
}

export default function ChatSidebar({ context, chatContextTitle, isCollapsible, onCollapse }: ChatSidebarProps) {
  const { getChat, sendMessage, getSettingsForContext, updateSettingsForContext, resetSettingsForContext, getSettingsPrompt, getDefaultPrompt } = useChats()
  const [chat, setChat] = useState<ChatState | undefined>(undefined)

  useEffect(() => {
    const loadChat = async () => {
      const c = await getChat(context)
      setChat(c)
    }
    loadChat()
  }, [context, getChat])

  const isThinking = chat?.isThinking || false

  const { configs, activeConfig } = useLLMConfig()
  const { navigateView } = useNavigator()

  const [selectedConfigId, setSelectedConfigId] = useState<string | undefined>(undefined)
  const selectedConfig = useMemo(() => {
    if (selectedConfigId) {
      const byId = configs.find((c) => c.id === selectedConfigId)
      if (byId) return byId
    }
    return activeConfig || configs[0]
  }, [configs, activeConfig, selectedConfigId])

  const isConfigured = !!selectedConfig?.apiKey

  // Settings state
  const currentSettings = useMemo(() => getSettingsForContext(context), [getSettingsForContext, context])
  const [availableTools, setAvailableTools] = useState<string[] | undefined>(currentSettings?.availableTools)
  const [autoCallTools, setAutoCallTools] = useState<string[] | undefined>(currentSettings?.autoCallTools)

  // Local editable prompt state that reflects either custom or effective default for this context
  const [draftPrompt, setDraftPrompt] = useState<string>('')

  // Keep local settings in sync when context changes or global settings update
  useEffect(() => {
    setAvailableTools(currentSettings?.availableTools)
    setAutoCallTools(currentSettings?.autoCallTools)
  }, [currentSettings])

  const persistSettings = useCallback(async (patch: Partial<{ availableTools: string[]; autoCallTools: string[]; systemPrompt: string }>) => {
    await updateSettingsForContext(context, patch as any)
  }, [context, updateSettingsForContext])

  const handleSend = useCallback(
    async (message: string, attachments: string[]) => {
      if (!selectedConfig) return
      tryResumeAudioContext()
      playSendSound()
      await sendMessage(context, message, selectedConfig, attachments)
    },
    [context, selectedConfig, sendMessage],
  )

  const handlePickConfig = useCallback(
    async (configId: string) => {
      setSelectedConfigId(configId)
      // Model selection is not persisted per-chat in ChatSettings; user controls active model via LLM settings
    },
    [],
  )

  type ToolToggle = { name: string; description: string; available: boolean; autoCall: boolean }
  const [tools, setTools] = useState<ToolToggle[] | undefined>(undefined)
  const projectId = parseProjectIdFromContext(context)
  useEffect(() => {
    let isMounted = true
    async function loadTools() {
      if (!projectId) {
        if (isMounted) setTools([])
        return
      }
      try {
        const list = await factoryToolsService.listTools(projectId)
        const allowed = availableTools
        const auto = autoCallTools
        const mapped: ToolToggle[] = list.map((t) => {
          const toolName = t.function.name
          const isAvail = !allowed ? true : allowed.includes(toolName)
          const isAuto = isAvail && !!auto && auto.includes(toolName)
          return {
            name: toolName,
            description: t.function.description,
            available: isAvail,
            autoCall: isAuto,
          }
        })
        if (isMounted) setTools(mapped)
      } catch (e) {
        if (isMounted) setTools([])
      }
    }
    loadTools()
    return () => {
      isMounted = false
    }
  }, [projectId, availableTools, autoCallTools])

  const toggleAvailable = useCallback(
    async (toolName: string) => {
      const currentAllowed = availableTools || tools?.map((t) => t.name) || []
      const allowedSet = new Set(currentAllowed)
      const willDisable = allowedSet.has(toolName)
      if (willDisable) allowedSet.delete(toolName)
      else allowedSet.add(toolName)
      const nextAvailable = Array.from(allowedSet)
      setAvailableTools(nextAvailable)

      if (willDisable) {
        const currentAuto = autoCallTools || []
        const nextAuto = currentAuto.filter((n) => n !== toolName)
        setAutoCallTools(nextAuto)
        await persistSettings({ availableTools: nextAvailable, autoCallTools: nextAuto })
      } else {
        await persistSettings({ availableTools: nextAvailable })
      }
    },
    [availableTools, autoCallTools, tools, persistSettings],
  )

  const toggleAutoCall = useCallback(
    async (toolName: string) => {
      const current = autoCallTools || []
      const set = new Set(current)
      if (set.has(toolName)) set.delete(toolName)
      else set.add(toolName)
      const next = Array.from(set)
      setAutoCallTools(next)
      await persistSettings({ autoCallTools: next })
    },
    [autoCallTools, persistSettings],
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

  // Effective prompt display (before any messages) and to seed settings textarea
  const [effectivePrompt, setEffectivePrompt] = useState<string>('')
  useEffect(() => {
    let cancelled = false
    const refreshPrompt = async () => {
      try {
        const prompt = await getSettingsPrompt(context)
        if (!cancelled) setEffectivePrompt(prompt)
      } catch {
        try {
          const def = await getDefaultPrompt(context)
          if (!cancelled) setEffectivePrompt(def)
        } catch {
          if (!cancelled) setEffectivePrompt('')
        }
      }
    }
    refreshPrompt()
    return () => {
      cancelled = true
    }
  }, [context, getSettingsPrompt, getDefaultPrompt])

  // Seed draft prompt whenever effective or settings change
  useEffect(() => {
    const custom = currentSettings?.systemPrompt
    setDraftPrompt(custom && custom.length > 0 ? custom : effectivePrompt)
  }, [effectivePrompt, currentSettings])

  return (
    <section className="flex-1 min-h-0 w-full h-full flex flex-col bg-[var(--surface-base)] overflow-hidden">
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
                  <div className="text-xs font-medium text-[var(--text-secondary)]">System Prompt</div>
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
                        await persistSettings({ systemPrompt: draftPrompt })
                      }}
                    >
                      Save prompt
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={async () => {
                        await resetSettingsForContext(context)
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
                                <div className="text-sm text-[var(--text-primary)] truncate">{tool.name}</div>
                                <div className="text-xs text-neutral-500 font-light truncate">
                                  {tool.description}
                                </div>
                              </div>
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex flex-col items-center space-y-px">
                                  <span className="text-[10px] text-[var(--text-secondary)]">Available</span>
                                  <Switch
                                    checked={tool.available}
                                    onCheckedChange={() => toggleAvailable(tool.name)}
                                    label=""
                                  />
                                </div>
                                <div className="flex flex-col items-center space-y-px">
                                  <span className="text-[10px] text-[var(--text-secondary)]">Auto-call</span>
                                  <Switch
                                    checked={tool.available ? tool.autoCall : false}
                                    onCheckedChange={() => toggleAutoCall(tool.name)}
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

      {!isConfigured && (
        <div
          className="flex-shrink-0 mx-4 mt-3 rounded-md border border-[var(--border-default)] p-2 text-[13px] flex items-center justify-between gap-2"
          style={{
            background: 'color-mix(in srgb, var(--accent-primary) 10%, var(--surface-raised))',
            color: 'var(--text-primary)',
          }}
          role="status"
        >
          <span>LLM not configured. Set your API key in Settings to enable sending messages.</span>
          <button className="btn" onClick={() => navigateView('Settings')}>
            Configure
          </button>
        </div>
      )}

      {/* Effective prompt display before any messages are sent */}
      {(!chat?.chat.messages || chat.chat.messages.length === 0) && effectivePrompt && (
        <div className="mx-4 my-3 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 text-[13px] text-[var(--text-secondary)]">
          <div className="text-[12px] uppercase font-semibold tracking-wide mb-1 text-[var(--text-muted)]">
            Prompt
          </div>
          <pre className="whitespace-pre-wrap break-words text-[var(--text-primary)]">{effectivePrompt}</pre>
        </div>
      )}

      <MessageList
        chatId={chat?.key}
        messages={chat?.chat.messages || []}
        isThinking={isThinking}
      />

      <ChatInput onSend={handleSend} isThinking={isThinking} isConfigured={isConfigured} />
    </section>
  )
}
