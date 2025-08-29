import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select'
import { useChats } from '../hooks/useChats'
import { useDocsIndex } from '../hooks/useDocsIndex'
import { useDocsAutocomplete } from '../hooks/useDocsAutocomplete'
import { useReferencesAutocomplete } from '../hooks/useReferencesAutocomplete'
import { useLLMConfig } from '../hooks/useLLMConfig'
import { useNavigator } from '../navigation/Navigator'
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar'
import DependencyBullet from '../components/tasks/DependencyBullet'
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

  const {
    isOpen: isRefsOpen,
    matches: matchingRefs,
    position: refsPosition,
    onSelect: onRefsSelect,
  } = useReferencesAutocomplete({ input, setInput, textareaRef, mirrorRef })

  useEffect(() => {
    const el = messageListRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight })
  }, [messages])

  const autoSizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const max = 200
    const next = Math.min(el.scrollHeight, max)
    el.style.height = next + 'px'
  }
  useEffect(() => {
    autoSizeTextarea()
  }, [input])

  const handleSend = async () => {
    if (!input.trim() || !activeConfig) return
    if (!currentChatId) {
      await createChat()
    }
    sendMessage(input, activeConfig)
    setInput('')
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.focus()
      }
    })
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
    isFirstInGroup?: boolean
  }

  const enhancedMessages: EnhancedMessage[] = useMemo(() => {
    return messages.map((msg, index) => {
      let showModel = false
      if (msg.role === 'assistant' && msg.model) {
        const prevAssistant = [...messages.slice(0, index)].reverse().find((m) => m.role === 'assistant')
        showModel = !prevAssistant || prevAssistant.model !== msg.model
      }
      const prev = messages[index - 1]
      const isFirstInGroup = !prev || prev.role !== msg.role || msg.role === 'system'
      return { ...msg, showModel, isFirstInGroup }
    })
  }, [messages])

  const canSend = Boolean(input.trim() && activeConfig && isConfigured)

  const chatItems = useMemo(() => chatHistories.map((id) => ({
    id,
    label: `Chat ${id}`,
    icon: <span aria-hidden>💬</span>,
    accent: 'gray',
    action: (
      <button
        onClick={(e) => {
          e.stopPropagation()
          deleteChat(id)
        }}
      >
        Delete
      </button>
    ),
  })), [chatHistories, deleteChat])

  const renderMessageContent = (content: string) => {
    const uuidPattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
    const regex = new RegExp(`#(${uuidPattern})(?:\.(${uuidPattern}))?`, 'g');
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const textBefore = content.slice(lastIndex, match.index);
      if (textBefore) parts.push(textBefore);
      const dep = match[0].slice(1);
      parts.push(<DependencyBullet key={`${match.index}-${dep}`} dependency={dep} />);
      lastIndex = regex.lastIndex;
    }
    const textAfter = content.slice(lastIndex);
    if (textAfter) parts.push(textAfter);
    return parts;
  }

  return (
    <CollapsibleSidebar
      items={chatItems}
      activeId={currentChatId || ''}
      onSelect={setCurrentChatId}
      storageKey="chat-sidebar-collapsed"
      headerTitle="History"
      headerSubtitle=""
      headerAction={<button className="btn" onClick={createChat} aria-label="Create new chat">New</button>}
      emptyMessage="No chats yet"
    >
      <section className="flex-1 flex flex-col w-full h-full bg-[var(--surface-base)] overflow-hidden">
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="absolute top-[-9999px] left-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none"
        />

        <header className="flex-shrink-0 px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="m-0 text-[var(--text-primary)] text-[18px] leading-tight font-semibold truncate">
              Project Chat {currentChatId ? `(ID: ${currentChatId})` : ''}
            </h1>
            {activeConfig && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[12px] text-[var(--text-secondary)] border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 py-0.5 rounded-full">
                Model: <strong className="font-medium text-[var(--text-primary)]">{activeConfig.name}</strong>
              </span>
            )}
          </div>
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
            className="flex-shrink-0 mx-4 mt-3 rounded-md border border-[var(--border-default)] p-2 text-[13px] flex items-center justify-between gap-2"
            style={{
              background: 'color-mix(in srgb, var(--accent-primary) 10%, var(--surface-raised))',
              color: 'var(--text-primary)',
            }}
            role="status"
          >
            <span>LLM not configured. Set your API key in Settings to enable sending messages.</span>
            <button className="btn" onClick={() => navigateView('Settings')}>Configure</button>
          </div>
        )}

        <div ref={messageListRef} className="flex-1 min-h-0 overflow-auto p-4">
          {enhancedMessages.length === 0 ? (
            <div className="mt-10 mx-auto max-w-[720px] text-center text-[var(--text-secondary)]">
              <div className="text-[18px] font-medium">Start chatting about the project</div>
              <div className="text-[13px] mt-2">Tip: Use Cmd/Ctrl+Enter to send • Shift+Enter for newline</div>
              <div className="mt-4 inline-block rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 py-3 text-[13px]">
                Attach markdown or text files to give context. Mention docs with /, and reference tasks/features with #.
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[960px] space-y-3">
              {enhancedMessages.map((msg, index) => {
                const isUser = msg.role === 'user'
                const isSystem = msg.role === 'system'

                if (isSystem) {
                  return (
                    <div key={index} className="flex justify-center">
                      <div className="text-[12px] text-[var(--text-muted)] italic bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-full px-3 py-1">
                        {renderMessageContent(msg.content)}
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={index}
                    className={[
                      'flex items-start gap-2',
                      isUser ? 'flex-row-reverse' : 'flex-row',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold',
                        isUser
                          ? 'bg-[var(--accent-primary)] text-[var(--text-inverted)]'
                          : 'bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)] text-[var(--text-primary)] border border-[var(--border-subtle)]',
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      {isUser ? 'You' : 'AI'}
                    </div>

                    <div className={['max-w-[72%] min-w-[80px] flex flex-col', isUser ? 'items-end' : 'items-start'].join(' ')}>
                      {!isUser && msg.showModel && msg.model && (
                        <div className="text-[11px] text-[var(--text-secondary)] mb-1 inline-flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--surface-overlay)] rounded-full px-2 py-[2px]">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                          {msg.model}
                        </div>
                      )}

                      <div
                        className={[
                          'px-3 py-2 rounded-2xl whitespace-pre-wrap break-words shadow',
                          isUser
                            ? 'bg-[var(--accent-primary)] text-[var(--text-inverted)] rounded-br-md'
                            : 'bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-md',
                          msg.isFirstInGroup ? '' : isUser ? 'rounded-tr-md' : 'rounded-tl-md',
                        ].join(' ')}
                      >
                        {renderMessageContent(msg.content)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <div className="p-3">
            <div className="relative flex items-end gap-2">
              <div className="flex-1 bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onInput={autoSizeTextarea}
                  onKeyDown={handleTextareaKeyDown}
                  className="w-full resize-none bg-transparent px-3 py-2 text-[var(--text-primary)] outline-none"
                  placeholder={isConfigured ? 'Type your message…' : 'You can compose a message and reference docs (#) even before configuring. Configure LLM to send.'}
                  rows={1}
                  aria-label="Message input"
                  style={{ maxHeight: 200, overflowY: 'auto' }}
                />
                <div className="px-3 py-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                  <div className="flex items-center gap-2">
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
                    <span className="hidden sm:inline">Tip: Use / for docs • Use # for tasks and features</span>
                  </div>
                  <span>Cmd/Ctrl+Enter to send • Shift+Enter for newline</span>
                </div>
              </div>

              <button onClick={handleSend} className="btn" disabled={!canSend} aria-label="Send message">
                Send
              </button>

              {isAutocompleteOpen && autocompletePosition && (
                <div
                  className="fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)]"
                  style={{ left: `${autocompletePosition.left}px`, top: `${autocompletePosition.top}px`, transform: 'translateY(-100%)' }}
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

              {isRefsOpen && refsPosition && (
                <div
                  className="fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)]"
                  style={{ left: `${refsPosition.left}px`, top: `${refsPosition.top}px`, transform: 'translateY(-100%)' }}
                  role="listbox"
                  aria-label="References suggestions"
                >
                  {matchingRefs.map((item, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 cursor-pointer hover:bg-[color-mix(in_srgb,var(--accent-primary)_8%,transparent)] text-[var(--text-primary)]"
                      role="option"
                      onClick={() => onRefsSelect(item.ref)}
                    >
                      #{item.display} - {item.title} ({item.type})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </CollapsibleSidebar>
  )
}
