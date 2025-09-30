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

type ToolToggle = { name: string; description: string; enabled: boolean }

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
  const { getChat, sendMessage } = useChats()
  const [chat, setChat] = useState<ChatState | undefined>(undefined)

  useEffect(() => {
    const loadChat = async () => {
      const c = await getChat(context)
      setChat(c)
    }
    loadChat()
  }, [context, getChat])

  const isThinking = chat?.isThinking || false
  const settings = chat?.chat.settings

  const { configs, activeConfig } = useLLMConfig()
  const { navigateView } = useNavigator()

  const [selectedConfigId, setSelectedConfigId] = useState<string | undefined>(
    (settings as any)?.llmConfigId,
  )

  useEffect(() => {
    setSelectedConfigId((settings as any)?.llmConfigId)
  }, [settings])

  const selectedConfig = useMemo(() => {
    if (selectedConfigId) {
      const byId = configs.find((c) => c.id === selectedConfigId)
      if (byId) return byId
    }
    return activeConfig || configs[0]
  }, [configs, activeConfig, selectedConfigId])

  const isConfigured = !!selectedConfig?.apiKey

  const [availableTools, setAvailableTools] = useState(settings?.availableTools)
  const [autoCallTools, setAutoCallTools] = useState(settings?.autoCallTools)

  useEffect(() => {
    setAvailableTools(settings?.availableTools)
    setAutoCallTools(settings?.autoCallTools)
  }, [settings])

  const handleSend = useCallback(
    async (message: string, attachments: string[]) => {
      if (!selectedConfig) return
      tryResumeAudioContext()
      playSendSound()
      const configWithSettings = {
        ...selectedConfig,
        availableTools,
        autoCallTools,
      }
      await sendMessage(context, message, configWithSettings, attachments)
    },
    [context, selectedConfig, sendMessage, availableTools, autoCallTools],
  )

  const handlePickConfig = useCallback(
    async (configId: string) => {
      setSelectedConfigId(configId)
      try {
        await (window as any).chatsService.saveSettings(context, { llmConfigId: configId })
      } catch (e) {
        console.error('Failed to save chat model setting', e)
      }
    },
    [context],
  )

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
        const mapped: ToolToggle[] = list.map(
          (t) =>
            ({
              name: t.function.name,
              description: t.function.description,
              enabled: !allowed ? true : allowed.includes(t.function.name),
            }) as ToolToggle,
        )
        if (isMounted) setTools(mapped)
      } catch (e) {
        if (isMounted) setTools([])
      }
    }
    loadTools()
    return () => {
      isMounted = false
    }
  }, [projectId, availableTools])

  const handleToolToggle = useCallback(
    (toolId: string) => {
      const currentAllowed = availableTools || tools?.map((t) => t.name) || []
      const newAllowed = new Set(currentAllowed)

      if (newAllowed.has(toolId)) {
        newAllowed.delete(toolId)
      } else {
        newAllowed.add(toolId)
      }
      setAvailableTools(Array.from(newAllowed))
    },
    [availableTools, tools],
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
              className="absolute top-full right-3 left-3 mt-2 w-auto max-w-[360px] ml-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-xl z-50"
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
                            key={tool.name}
                            className="flex items-center justify-between px-2 py-2"
                          >
                            <div className="flex flex-col">
                              <span className="text-sm text-[var(--text-primary)] truncate pr-2">
                                {tool.name}
                              </span>
                              <span className="text-xs text-neutral-500 font-light">
                                {tool.description}
                              </span>
                            </div>
                            <Switch
                              checked={tool.enabled}
                              onCheckedChange={() => handleToolToggle(tool.name)}
                              label=""
                            />
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

      <MessageList
        chatId={chat?.key}
        messages={chat?.chat.messages || []}
        isThinking={isThinking}
      />

      <ChatInput onSend={handleSend} isThinking={isThinking} isConfigured={isConfigured} />
    </section>
  )
}
