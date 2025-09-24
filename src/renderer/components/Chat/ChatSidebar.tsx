import React, { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select'
import { Switch } from '../ui/Switch'
import { Modal } from '../ui/Modal'
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
  onAutoApproveChange
}: ChatSidebarProps) {
    const [isToolModalOpen, setIsToolModalOpen] = useState(false)

    const handleSend = async (message: string, attachments: string[]) => {
        if (!activeConfig) return
        tryResumeAudioContext()
        playSendSound()
        await onSend(message, attachments)
    }

  return (
    <section className="flex-1 min-h-0 w-full h-full flex flex-col bg-[var(--surface-base)] overflow-hidden">
      <header className="flex-shrink-0 px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="m-0 text-[var(--text-primary)] text-[18px] leading-tight font-semibold truncate">
            {chatContextTitle}{' '}
            {currentChat ? `(${new Date(currentChat.updateDate).toLocaleString()})` : ''}
          </h1>
        </div>
        <div className="flex items-center gap-2">
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

          {tools && onToolToggle && (
              <button className="btn-secondary" onClick={() => setIsToolModalOpen(true)}>Tools</button>
          )}

          {onAutoApproveChange && (
            <Switch
              checked={!!autoApprove}
              onCheckedChange={onAutoApproveChange}
              label="Auto-approve"
            />
          )}

          <button
            onClick={onConfigure}
            className="btn-secondary"
            aria-label="Open Settings"
          >
            Settings
          </button>
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
      
      {tools && onToolToggle && (
        <Modal isOpen={isToolModalOpen} onClose={() => setIsToolModalOpen(false)} title="Tools">
          <div className="flex flex-col gap-4">
            {tools.map((tool) => (
              <Switch
                key={tool.id}
                checked={tool.enabled}
                onCheckedChange={() => onToolToggle(tool.id)}
                label={tool.name}
              />
            ))}
          </div>
        </Modal>
      )}
    </section>
  )
}
