import React, { useState, useEffect, useRef } from 'react'
import './chat.css'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select'
import { useChats } from '../hooks/useChats'
import { useDocsIndex } from '../hooks/useDocsIndex'
import { useDocsAutocomplete } from '../hooks/useDocsAutocomplete'
import { useLLMConfig } from '../hooks/useLLMConfig'
import { useNavigator } from '../navigation/Navigator'
import type { ChatMessage } from '../types'

const ChatView = () => {
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
    // Scroll to bottom on new messages
    messageListRef.current?.scrollTo(0, messageListRef.current.scrollHeight)
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !activeConfig) return
    if (!currentChatId) {
      await createChat()
    }
    sendMessage(input, activeConfig)
    setInput('')
    // restore focus for fast consecutive messages
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
    // Cmd/Ctrl+Enter sends; Shift+Enter inserts newline (default)
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
    <div className="chat-view flex min-h-0 w-full">
      {/* Sidebar */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar__header">
          <h2 className="chat-sidebar__title">Chats</h2>
          <button className="btn" onClick={createChat} aria-label="Create new chat">
            New
          </button>
        </div>
        <div className="chat-list" role="list" aria-label="Chat list">
          {chatHistories.map((id) => (
            <div
              key={id}
              role="listitem"
              className={`chat-item ${currentChatId === id ? 'chat-item--active' : ''}`}
              onClick={() => setCurrentChatId(id)}
              aria-current={currentChatId === id ? 'true' : undefined}
            >
              <span className="chat-item__label">Chat {id}</span>
              <div className="chat-item__actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="chat-item__delete"
                  onClick={() => deleteChat(id)}
                  aria-label={`Delete Chat ${id}`}
                  title="Delete chat"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <section className="chat-main flex-1 min-w-0 min-h-0">
        {/* Hidden mirror div for caret positioning (docs autocomplete) */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="absolute top-[-9999px] left-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none"
        />

        <header className="chat-header">
          <h1 className="chat-header__title">
            Project Chat {currentChatId ? `(ID: ${currentChatId})` : ''}
          </h1>
          <div className="chat-header__actions">
            <Select value={activeConfigId || ''} onValueChange={setActive}>
              <SelectTrigger className="ui-select w-220">
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
          <div className="chat-banner" role="status">
            LLM not configured. Set your API key in Settings to enable sending messages.
          </div>
        )}

        {/* Messages */}
        <div ref={messageListRef} className="message-list" aria-live="polite">
          {enhancedMessages.length === 0 ? (
            <div className="message-empty">
              Start chatting about the project
              <div className="message-empty__tips">
                Tip: Use Cmd/Ctrl+Enter to send • Shift+Enter for newline
              </div>
            </div>
          ) : (
            enhancedMessages.map((msg, index) => {
              const roleClass =
                msg.role === 'user' ? 'is-user' : msg.role === 'system' ? 'is-system' : 'is-assistant'
              const bubbleClass =
                msg.role === 'user'
                  ? 'chat-bubble chat-bubble--user'
                  : msg.role === 'system'
                  ? 'chat-bubble chat-bubble--system'
                  : 'chat-bubble chat-bubble--assistant'
              return (
                <div key={index} className={`message-row ${roleClass}`}>
                  <div className={bubbleClass}>
                    {msg.role === 'assistant' && msg.showModel && msg.model && (
                      <div className="chat-bubble__meta">{msg.model}</div>
                    )}
                    {msg.content}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Composer */}
        <div className="chat-composer">
          <div className="chat-composer__inner" style={{ position: 'relative' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              className="chat-textarea"
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
                className="doc-autocomplete"
                style={{ left: `${autocompletePosition.left}px`, top: `${autocompletePosition.top}px` }}
                role="listbox"
                aria-label="Docs suggestions"
              >
                {matchingDocs.map((path, idx) => (
                  <div
                    key={idx}
                    className="doc-autocomplete__item"
                    role="option"
                    onClick={() => onAutocompleteSelect(path)}
                  >
                    {path}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="chat-composer__hint">Cmd/Ctrl+Enter to send • Shift+Enter for newline</div>
        </div>
      </section>
    </div>
  )
}

export default ChatView
