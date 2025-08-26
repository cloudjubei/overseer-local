import React, { useState, useEffect, useRef } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select'
import { useChats } from '../hooks/useChats'
import { useDocsIndex } from '../hooks/useDocsIndex'
import { useDocsAutocomplete } from '../hooks/useDocsAutocomplete'
import { useLLMConfig } from '../hooks/useLLMConfig'
import { useNavigator } from '../navigation/Navigator'
import type { ChatMessage } from '../types'

export default function ChatView() {
  const {
    chatHistories,
    currentChatId,
    setCurrentChatId,
    messages,
    createChat,
    deleteChat,
    sendMessage,
    uploadDocument,
  } = useChats()

  const { docsList } = useDocsIndex()
  const { configs, activeConfigId, activeConfig, isConfigured, setActive } = useLLMConfig()
  const { navigateView } = useNavigator()

  const [input, setInput] = useState<string>('')
  const messageListRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    isOpen: isAutocompleteOpen,
    matches: matchingDocs,
    position: autocompletePosition,
    onSelect: onAutocompleteSelect,
  } = useDocsAutocomplete({ docsList, input, setInput, textareaRef, mirrorRef })

  useEffect(() => {
    messageListRef.current?.scrollTo(0, messageListRef.current.scrollHeight)
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !activeConfig) return
    if (!currentChatId) {
      await createChat()
    }
    sendMessage(input, activeConfig)
    setInput('')
    textareaRef.current?.focus()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      uploadDocument(file.name, content)
    }
    reader.readAsText(file)
  }

  const handleTextareaKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  interface EnhancedMessage extends ChatMessage {
    showModel?: boolean
  }

  const enhancedMessages: EnhancedMessage[] = messages.map((msg, index) => {
    let showModel = false
    if (msg.role === 'assistant' && msg.model) {
      const prevAssistant = [...messages.slice(0, index)].reverse().find((m) => m.role === 'assistant')
      showModel = !prevAssistant || prevAssistant.model !== msg.model
    }
    return { ...msg, showModel }
  })

  const canSend = Boolean(input.trim() && activeConfig && isConfigured)

  return (
    <div className="flex min-h-0 w-full">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-raised)] flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-subtle)]">
          <h2 className="m-0 text-[13px] font-semibold text-[var(--text-secondary)] tracking-wide">Chats</h2>
          <button className="btn" onClick={createChat} aria-label="Create new chat">
            New
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2" role="list" aria-label="Chat list">
          {chatHistories.map((id) => {
            const isActive = currentChatId === id
            return (
              <div
                key={id}
                role="listitem"
                className={[
                  'group flex items-center justify-between gap-2 cursor-pointer select-none px-2 py-1.5 rounded-md',
                  'text-[var(--text-primary)]',
                  isActive
                    ? 'border border-[var(--border-default)] bg-[var(--surface-overlay)]'
                    : 'hover:bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)]',
                ].join(' ')}
                onClick={() => setCurrentChatId(id)}
                aria-current={isActive ? 'true' : undefined}
              >
                <span className="truncate">Chat {id}</span>
                <button
                  className="opacity-60 group-hover:opacity-100 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteChat(id)
                  }}
                  aria-label={`Delete Chat ${id}`}
                  title="Delete chat"
                >
                  Delete
                </button>
              </div>
            )
          })}
        </div>
      </aside>

      {/* Main content */}
      <section className="flex-1 min-w-0 min-h-0 flex flex-col bg-[var(--surface-base)]">
        {/* Hidden mirror for caret positioning (docs autocomplete) */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="absolute top-[-9999px] left-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none"
        />

        <header className="shrink-0 px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] flex items-center justify-between gap-3">
          <h1 className="m-0 text-[var(--text-primary)] text-[18px] leading-tight font-semibold">
            Project Chat {currentChatId ? `(ID: ${currentChatId})` : ''}
          </h1>
          <div className="flex items-center gap-2">
            <Select value={activeConfigId || ''} onValueChange={setActive}>
              <SelectTrigger className="ui-select w-[220px]">
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                {configs.map((cfg) => (
                  <SelectItem key={cfg.id} value={cfg.id}>
                    {cfg.name} ({cfg.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => navigateView('Settings')}
              className="btn-secondary"
              aria-label="Open Settings"
            >
              Settings
            </button>
          </div>
        </header>

        {!isConfigured && (
          <div
            className="mx-4 mt-3 rounded-md border border-[var(--border-default)] p-2 text-[13px]"
            style={{
              background: 'color-mix(in srgb, var(--accent-primary) 10%, var(--surface-raised))',
              color: 'var(--text-primary)',
            }}
            role="status"
          >
            LLM not configured. Set your API key in Settings to enable sending messages.
          </div>
        )}

        {/* Messages */}
        <div ref={messageListRef} className="flex-1 min-h-0 overflow-auto p-4" aria-live="polite">
          {enhancedMessages.length === 0 ? (
            <div className="mt-10 mx-auto max-w-[720px] text-center text-[var(--text-secondary)]">
              <div className="text-[18px] font-medium">Start chatting about the project</div>
              <div className="text-[13px] mt-1">Tip: Use Cmd/Ctrl+Enter to send • Shift+Enter for newline</div>
            </div>
          ) : (
            <div className="mx-auto max-w-[920px] space-y-2">
              {enhancedMessages.map((msg, index) => {
                const isUser = msg.role === 'user'
                const isSystem = msg.role === 'system'

                return (
                  <div
                    key={index}
                    className={['flex', isUser ? 'justify-end' : 'justify-start'].join(' ')}
                  >
                    <div className="max-w-[72%]">
                      {!isUser && msg.showModel && msg.model && (
                        <div className="text-[11px] text-[var(--text-muted)] mb-1">{msg.model}</div>
                      )}
                      <div
                        className={[
                          'px-3 py-2 rounded-2xl shadow',
                          isSystem
                            ? 'bg-transparent text-[var(--text-muted)] italic px-0 py-1 shadow-none'
                            : isUser
                            ? 'bg-[var(--accent-primary)] text-[var(--text-inverted)] rounded-br-md'
                            : 'bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-md',
                        ].join(' ')}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <div className="p-3">
            <div className="relative flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                className="flex-1 resize-none rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                placeholder={isConfigured ? 'Type your message…' : 'Configure your LLM in Settings to start chatting'}
                rows={3}
                aria-label="Message input"
                disabled={!isConfigured}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary"
                aria-label="Attach a document"
                type="button"
              >
                Attach
              </button>
              <input
                type="file"
                accept=".md,.txt"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />

              <button onClick={handleSend} className="btn" disabled={!canSend} aria-label="Send message">
                Send
              </button>

              {isAutocompleteOpen && autocompletePosition && (
                <div
                  className="absolute z-50 min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)]"
                  style={{ left: `${autocompletePosition.left}px`, top: `${autocompletePosition.top}px` }}
                  role="listbox"
                  aria-label="Docs suggestions"
                >
                  {matchingDocs.map((path, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 cursor-pointer hover:bg-[color-mix(in_srgb,var(--accent-primary)_8%,transparent)] text-[var(--text-primary)]"
                      role="option"
                      onClick={() => onAutocompleteSelect(path)}
                    >
                      {path}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="text-[12px] text-[var(--text-muted)] mt-2">Cmd/Ctrl+Enter to send • Shift+Enter for newline</div>
          </div>
        </div>
      </section>
    </div>
  )
}
