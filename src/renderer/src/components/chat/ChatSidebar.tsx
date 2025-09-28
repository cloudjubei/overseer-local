import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLLMConfig } from '../../contexts/LLMConfigContext'
import { useNavigator } from '../../navigation/Navigator'
import { useChats, getChatContextPath } from '../../contexts/ChatsContext'
import { factoryToolsService } from '../../services/factoryToolsService'
import { ChatInput, MessageList } from '.'
import { playSendSound, tryResumeAudioContext } from '../../assets/sounds'
import { Switch } from '../ui/Switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import type { Chat, ChatContext } from 'thefactory-tools'

// Internal tool toggle type for UI
type ToolToggle = { id: string; name: string; enabled: boolean }

export type ChatSidebarProps = {
  context: ChatContext
  chatContextTitle: string
}

function parseProjectIdFromContext(context: ChatContext): string | undefined {
  if (context && 'projectId' in context) {
    return context.projectId
  }
  return undefined
}

export default function ChatSidebar({ context, chatContextTitle }: ChatSidebarProps) {
  const { chats, getChat, sendMessage } = useChats()

  const chatKey = useMemo(() => getChatContextPath(context), [context])
  const chatState = chats[chatKey]

  useEffect(() => {
    getChat(context)
  }, [context, getChat])

  const chat: Chat | undefined = chatState?.chat
  const isThinking = chatState?.isThinking || false
  const settings = chat?.settings

  const { configs, activeConfig, setActive } = useLLMConfig()
  const { navigateView } = useNavigator()

  // Determine selected model/config
  const selectedModel: string | undefined = settings?.model
  const selectedConfig = useMemo(() => {
    if (selectedModel) {
      const byModel = configs.find((c) => c.model === selectedModel)
      if (byModel) return byModel
    }
    if (activeConfig) return activeConfig
    return configs[0]
  }, [configs, activeConfig, selectedModel])

  const selectedConfigId = selectedConfig?.id
  const isConfigured = !!selectedConfig?.apiKey

  const [allowedTools, setAllowedTools] = useState(settings?.allowedTools)
  const [autoToolCall, setAutoToolCall] = useState(!!settings?.autoToolCall)

  useEffect(() => {
    setAllowedTools(settings?.allowedTools)
    setAutoToolCall(!!settings?.autoToolCall)
  }, [settings])

  const handleSend = useCallback(
    async (message: string, attachments: string[]) => {
      if (!selectedConfig) return
      tryResumeAudioContext()
      playSendSound()
      const configWithSettings = {
        ...selectedConfig,
        allowedTools,
        autoToolCall,
      }
      await sendMessage(context, message, configWithSettings, attachments)
    },
    [context, selectedConfig, sendMessage, allowedTools, autoToolCall],
  )

  const handleConfigChange = useCallback(
    (configId: string) => {
      const cfg = configs.find((c) => c.id === configId)
      if (!cfg) return
      setActive(configId)
    },
    [configs, setActive],
  )

  // Tools management (allowedTools is an allowlist; undefined => all allowed)
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
        const allowed = allowedTools
        const mapped: ToolToggle[] = list.map((t: any) => ({
          id: t.name,
          name: t.name,
          enabled: !allowed ? true : allowed.includes(t.name),
        }))
        if (isMounted) setTools(mapped)
      } catch (e) {
        if (isMounted) setTools([])
      }
    }
    loadTools()
    return () => {
      isMounted = false
    }
  }, [projectId, allowedTools])

  const handleToolToggle = useCallback(
    (toolId: string) => {
      const currentAllowed = allowedTools || tools?.map((t) => t.id) || []
      const newAllowed = new Set(currentAllowed)

      if (newAllowed.has(toolId)) {
        newAllowed.delete(toolId)
      } else {
        newAllowed.add(toolId)
      }
      setAllowedTools(Array.from(newAllowed))
    },
    [allowedTools, tools],
  )

  const handleAutoApproveChange = useCallback((checked: boolean) => {
    setAutoToolCall(checked)
  }, [])

  // Settings dropdown UI state
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

  return (
    <section className="flex-1 min-h-0 w-full h-full flex flex-col bg-[var(--surface-base)] overflow-hidden">
      <header className="relative flex-shrink-0 px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="m-0 text-[var(--text-primary)] text-[18px] leading-tight font-semibold truncate">
            {chatContextTitle}{' '}
            {chat ? `(${new Date(chat.updatedAt).toLocaleString()})` : ''}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedConfigId || ''} onValueChange={handleConfigChange}>
            <SelectTrigger className="ui-select w-[220px]">
              <SelectValue placeholder="Select Model" />
            </SelectTrigger>
            <SelectContent>
              {configs.map((cfg) => (
                <SelectItem key={cfg.id} value={cfg.id!}>
                  {cfg.name} ({cfg.model})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            ref={settingsBtnRef}
            onClick={() => setIsSettingsOpen((v) => !v)}
            className="btn-secondary"
            aria-haspopup="menu"
            aria-expanded={isSettingsOpen}
            aria-label="Open Chat Settings"
          >
            Settings
          </button>

          {isSettingsOpen && (
            <div
              ref={dropdownRef}
              className="absolute top-full right-4 mt-2 w-[360px] rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-xl z-50"
              role="menu"
              aria-label="Chat Settings"
            >
              <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  Chat Settings
                </div>
                <div className="text-xs text-[var(--text-secondary)]">Controls for this chat</div>
              </div>

              <div className="p-3 space-y-4 max-h-[60vh] overflow-auto">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-[var(--text-secondary)]">Model</div>
                  <Select value={selectedConfigId || ''} onValueChange={handleConfigChange}>
                    <SelectTrigger className="ui-select w-full">
                      <SelectValue placeholder="Select Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {configs.map((cfg) => (
                        <SelectItem key={cfg.id} value={cfg.id!}>
                          {cfg.name} ({cfg.model})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                          <div
                            key={tool.id}
                            className="flex items-center justify-between px-2 py-2"
                          >
                            <div className="text-sm text-[var(--text-primary)] truncate pr-2">
                              {tool.name}
                            </div>
                            <Switch
                              checked={tool.enabled}
                              onCheckedChange={() => handleToolToggle(tool.id)}
                              label=""
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-[var(--text-primary)]">
                      Auto-approve tool calls
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      When enabled, the agent can invoke tools without asking for confirmation.
                    </div>
                  </div>
                  <Switch
                    checked={autoToolCall}
                    onCheckedChange={handleAutoApproveChange}
                    label="Auto-approve"
                  />
                </div>
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

      <MessageList
        chatId={chatKey}
        messages={chat?.messages || []}
        isThinking={isThinking}
      />

      <ChatInput onSend={handleSend} isThinking={isThinking} isConfigured={isConfigured} />
    </section>
  )
}
