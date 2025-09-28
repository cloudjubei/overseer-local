// import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// import { useLLMConfig } from '../../contexts/LLMConfigContext'
// import { useNavigator } from '../../navigation/Navigator'
// import { useChats } from '../../contexts/ChatsContext'
// import { factoryToolsService } from '../../services/factoryToolsService'
// import { ChatInput, MessageList } from '.'
// import { playSendSound, tryResumeAudioContext } from '../../assets/sounds'
// import { Switch } from '../ui/Switch'
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import { ChatContext } from 'thefactory-tools'

// Internal tool toggle type for UI
// type ToolToggle = { id: string; name: string; enabled: boolean }

export type ChatSidebarProps = {
  context: ChatContext
  chatContextTitle: string
}

// function parseProjectIdFromContext(context: ChatContext): string | undefined {
//   return context?.projectId
// }

//TODO: fix
export default function ChatSidebar({ context, chatContextTitle }: ChatSidebarProps) {
  // const { chats, chatsByProjectId, getChat, sendMessage, restartChat } = useChats()

  console.log('chat context:', context, ' title: ', chatContextTitle)
  // const { chat, isThinking } = getChat(context)

  // useEffect(() => {
  //   refreshChat(context)
  // }, [context, refreshChat])

  // const { configs, activeConfig, setActive } = useLLMConfig()
  // const { navigateView } = useNavigator()

  // const settings = chat?.settings

  // Determine selected model/config
  // const selectedModel: string | undefined = settings?.model
  // const selectedConfig = useMemo(() => {
  //   if (selectedModel) {
  //     const byModel = configs.find((c) => c.model === selectedModel)
  //     if (byModel) return byModel
  //   }
  //   if (activeConfig) return activeConfig
  //   return configs[0]
  // }, [configs, activeConfig, selectedModel])

  // const selectedConfigId = selectedConfig?.id
  // const isConfigured = !!selectedConfig?.apiKey

  // const handleSend = useCallback(
  //   async (message: string, attachments: string[]) => {
  //     if (!selectedConfig) return
  //     tryResumeAudioContext()
  //     playSendSound()
  //     await sendMessage(context, message, selectedConfig, attachments)
  //   },
  //   [context, selectedConfig, sendMessage],
  // )

  // const handleConfigChange = useCallback(
  //   async (configId: string) => {
  //     const cfg = configs.find((c) => c.id === configId)
  //     if (!cfg) return
  //     // Persist model choice into chat settings for this context and align global active
  //     // await saveChatSettings(context, { model: cfg.model })
  //     setActive(configId)
  //   },
  //   [context, configs, saveChatSettings, setActive],
  // )

  // // Tools management (allowedTools is an allowlist; undefined => all allowed)
  // const [tools, setTools] = useState<ToolToggle[] | undefined>(undefined)
  // const projectId = parseProjectIdFromContext(context)
  // useEffect(() => {
  //   let isMounted = true
  //   async function loadTools() {
  //     if (!projectId) return
  //     try {
  //       const list = await factoryToolsService.listTools(projectId)
  //       const allowed = settings?.allowedTools
  //       const mapped: ToolToggle[] = list.map((t: any) => ({
  //         id: t.name,
  //         name: t.name,
  //         enabled: !allowed ? true : allowed.includes(t.name),
  //       }))
  //       if (isMounted) setTools(mapped)
  //     } catch (e) {
  //       if (isMounted) setTools([])
  //     }
  //   }
  //   loadTools()
  //   return () => {
  //     isMounted = false
  //   }
  // }, [projectId, settings?.allowedTools])

  // const handleToolToggle = useCallback(
  //   async (toolId: string) => {
  //     const allowed = new Set(settings?.allowedTools || [])
  //     // If no explicit allowlist yet, initialize as all current enabled tools from UI
  //     if (!settings?.allowedTools && tools) {
  //       tools.forEach((t) => t.enabled && allowed.add(t.id))
  //     }
  //     if (allowed.has(toolId)) {
  //       allowed.delete(toolId)
  //     } else {
  //       allowed.add(toolId)
  //     }
  //     await saveChatSettings(context, { allowedTools: Array.from(allowed) })
  //   },
  //   [context, settings?.allowedTools, tools, saveChatSettings],
  // )

  // const handleAutoApproveChange = useCallback(
  //   async (checked: boolean) => {
  //     await saveChatSettings(context, { autoToolCall: checked })
  //   },
  //   [context, saveChatSettings],
  // )

  // // Settings dropdown UI state
  // const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  // const settingsBtnRef = useRef<HTMLButtonElement | null>(null)
  // const dropdownRef = useRef<HTMLDivElement | null>(null)

  // useEffect(() => {
  //   function onDocClick(e: MouseEvent) {
  //     const t = e.target as Node
  //     if (!isSettingsOpen) return
  //     if (dropdownRef.current && dropdownRef.current.contains(t)) return
  //     if (settingsBtnRef.current && settingsBtnRef.current.contains(t)) return
  //     setIsSettingsOpen(false)
  //   }
  //   function onKey(e: KeyboardEvent) {
  //     if (!isSettingsOpen) return
  //     if (e.key === 'Escape') setIsSettingsOpen(false)
  //   }
  //   document.addEventListener('mousedown', onDocClick)
  //   document.addEventListener('keydown', onKey)
  //   return () => {
  //     document.removeEventListener('mousedown', onDocClick)
  //     document.removeEventListener('keydown', onKey)
  //   }
  // }, [isSettingsOpen])

  return (
    <section className="flex-1 min-h-0 w-full h-full flex flex-col bg-[var(--surface-base)] overflow-hidden">
      {/* <header className="relative flex-shrink-0 px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] flex items-center justify-between gap-3"> */}
      {/* <div className="flex items-center gap-3 min-w-0">
          <h1 className="m-0 text-[var(--text-primary)] text-[18px] leading-tight font-semibold truncate">
            {chatContextTitle} {chat ? `(${new Date(chat.updateDate).toLocaleString()})` : ''}
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
                    checked={!!settings?.autoToolCall}
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

      <MessageList chatId={chat?.id} messages={chat?.messages || []} isThinking={isThinking} />

      <ChatInput onSend={handleSend} isThinking={isThinking} isConfigured={isConfigured} /> */}
    </section>
  )
}
