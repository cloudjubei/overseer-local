import React, { useEffect, useRef, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select'
import { Switch } from '../ui/Switch'
import { ChatInput, MessageList } from '.'
import { playSendSound, tryResumeAudioContext } from '../../../../assets/sounds'

// TODO: Move these types to a shared location
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  // other properties can exist
  [key: string]: any
}

export interface Chat {
  id: string
  messages: Message[]
  updateDate: string | Date
  // other properties can exist
  [key: string]: any
}

export interface LLMConfig {
  id?: string
  name: string
  model: string
  // other properties can exist
  [key: string]: any
}

export interface Tool {
  id: string
  name: string
  enabled: boolean
}

interface ChatSidebarProps {
  chatContextTitle: string
  currentChat?: Chat
  isThinking: boolean
  isConfigured: boolean
  onSend: (message: string, attachments: string[]) => Promise<void>
  configs: LLMConfig[]
  activeConfigId?: string
  onConfigChange: (configId: string) => void
  onConfigure: () => void
  activeConfig: LLMConfig | null
  tools?: Tool[]
  onToolToggle?: (toolId: string) => void
  autoApprove?: boolean
  onAutoApproveChange?: (checked: boolean) => void
}

export default function ChatSidebar({
  chatContextTitle,
  currentChat,
  isThinking,
  isConfigured,
  onSend,
  configs,
  activeConfigId,
  onConfigChange,
  onConfigure,
  activeConfig,
  tools,
  onToolToggle,
  autoApprove,
  onAutoApproveChange,
}: ChatSidebarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const handleSend = async (message: string, attachments: string[]) => {
    if (!activeConfig) return
    tryResumeAudioContext()
    playSendSound()
    await onSend(message, attachments)
  }

  // Close settings dropdown on outside click or Escape
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
      if (e.key === 'Escape') {
        setIsSettingsOpen(false)
      }
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
            {currentChat ? `(${new Date(currentChat.updateDate).toLocaleString()})` : ''}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick model selector (kept for convenience) */}
          <Select value={activeConfigId || ''} onValueChange={onConfigChange}>
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

          {/* Unified settings dropdown opener */}
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

          {/* Settings dropdown */}
          {isSettingsOpen && (
            <div
              ref={dropdownRef}
              className="absolute top-full right-4 mt-2 w-[340px] rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] shadow-xl z-50"
              role="menu"
              aria-label="Chat Settings"
            >
              <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Chat Settings</div>
                <div className="text-xs text-[var(--text-secondary)]">Controls for this chat</div>
              </div>

              <div className="p-3 space-y-4 max-h-[60vh] overflow-auto">
                {/* Model selector inside dropdown */}
                <div className="space-y-1">
                  <div className="text-xs font-medium text-[var(--text-secondary)]">Model</div>
                  <Select value={activeConfigId || ''} onValueChange={(v) => onConfigChange(v)}>
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

                {/* Tools toggles */}
                {tools && onToolToggle ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-[var(--text-secondary)]">Tools</div>
                    <div className="rounded-md border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
                      {tools.length === 0 ? (
                        <div className="text-xs text-[var(--text-secondary)] px-2 py-3">
                          No tools available for this context.
                        </div>
                      ) : (
                        tools.map((tool) => (
                          <div key={tool.id} className="flex items-center justify-between px-2 py-2">
                            <div className="text-sm text-[var(--text-primary)] truncate pr-2">{tool.name}</div>
                            <Switch
                              checked={tool.enabled}
                              onCheckedChange={() => onToolToggle(tool.id)}
                              label=""
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Auto-approve toggle */}
                {onAutoApproveChange ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-[var(--text-primary)]">Auto-approve tool calls</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        When enabled, the agent can invoke tools without asking for confirmation.
                      </div>
                    </div>
                    <Switch
                      checked={!!autoApprove}
                      onCheckedChange={onAutoApproveChange}
                      label="Auto-approve"
                    />
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
          <span>
            LLM not configured. Set your API key in Settings to enable sending messages.
          </span>
          <button className="btn" onClick={onConfigure}>
            Configure
          </button>
        </div>
      )}

      <MessageList
        chatId={currentChat?.id}
        messages={currentChat?.messages || []}
        isThinking={isThinking}
      />

      <ChatInput onSend={handleSend} isThinking={isThinking} isConfigured={isConfigured} />
    </section>
  )
}
