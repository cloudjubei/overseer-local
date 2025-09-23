import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select'
import { useChats } from '../hooks/useChats'
import { useFilesAutocomplete } from '../hooks/useFilesAutocomplete'
import { useReferencesAutocomplete } from '../hooks/useReferencesAutocomplete'
import { useLLMConfig } from '../contexts/LLMConfigContext'
import { useNavigator } from '../navigation/Navigator'
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar'
import FileDisplay from '../components/ui/FileDisplay'
import { Chat, ChatMessage } from '../services/chatsService'
import RichText from '../components/ui/RichText'
import { inferFileType, useFiles } from '../contexts/FilesContext'
import { IconChat, IconDelete, IconPlus } from '../components/ui/Icons'
import Spinner from '../components/ui/Spinner'

interface EnhancedMessage extends ChatMessage {
  showModel?: boolean
  isFirstInGroup?: boolean
}

export default function ChatView() {
  const {
    currentChatId,
    setCurrentChatId,
    chatsById,
    createChat,
    deleteChat,
    sendMessage,
    isThinking,
  } = useChats()
  const { files, filesByPath, uploadFile } = useFiles()
  const { configs, activeConfigId, activeConfig, isConfigured, setActive } = useLLMConfig()
  const { navigateView } = useNavigator()

  const [currentChat, setCurrentChat] = useState<Chat | undefined>()
  const [input, setInput] = useState<string>('')
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([])
  const messageListRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const {
    isOpen: isAutocompleteOpen,
    matches: matchingDocs,
    position: autocompletePosition,
    onSelect: onAutocompleteSelect,
  } = useFilesAutocomplete({
    filesList: files.map((f) => f.relativePath!),
    input,
    setInput,
    textareaRef,
    mirrorRef,
  })

  const {
    isOpen: isRefsOpen,
    matches: matchingRefs,
    position: refsPosition,
    onSelect: onRefsSelect,
  } = useReferencesAutocomplete({ input, setInput, textareaRef, mirrorRef })

  useEffect(() => {
    const el = messageListRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [chatsById, isThinking])

  useEffect(() => {
    if (currentChatId) {
      const chat = chatsById[currentChatId]
      setCurrentChat(chat)
    }
  }, [currentChatId, chatsById])

  useEffect(() => {
    if (currentChat) {
      setMessages(currentChat.messages)
    }
  }, [currentChat])

  const chatHistories = useMemo(() => {
    return Object.values(chatsById).sort(
      (a, b) => new Date(a.updateDate).getTime() - new Date(b.updateDate).getTime(),
    )
  }, [chatsById])

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
    await sendMessage(input, activeConfig, pendingAttachments)
    setInput('')
    setPendingAttachments([])
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
    reader.onload = async (event) => {
      const content = event.target?.result as string
      const newPath = await uploadFile(file.name, content)
      if (newPath) {
        setPendingAttachments((prev) => Array.from(new Set([...prev, newPath])))
      }
    }
    reader.readAsText(file)
    // e.currentTarget.value = ''
  }

  const handleTextareaKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const enhancedMessages: EnhancedMessage[] = useMemo(() => {
    return messages.map((msg, index) => {
      let showModel = false
      if (msg.role === 'assistant' && msg.model) {
        const prevAssistant = [...messages.slice(0, index)]
          .reverse()
          .find((m) => m.role === 'assistant')
        showModel = !prevAssistant || prevAssistant.model !== msg.model
      }
      const prev = messages[index - 1]
      const isFirstInGroup = !prev || prev.role !== msg.role || msg.role === 'system'
      return { ...msg, showModel, isFirstInGroup }
    })
  }, [messages])

  const canSend = Boolean(input.trim() && activeConfig && isConfigured)

  const chatItems = useMemo(
    () =>
      chatHistories.map((chat) => ({
        id: chat.id,
        label: `Chat ${new Date(chat.creationDate)}`,
        icon: <IconChat className="w-4 h-4" />,
        accent: 'gray',
        action: (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteChat(chat.id)
            }}
            aria-label="Delete chat"
            title="Delete chat"
          >
            <IconDelete className="w-4 h-4" />
          </button>
        ),
      })),
    [chatHistories, deleteChat],
  )

  return (
    <CollapsibleSidebar
      items={chatItems}
      activeId={currentChatId || ''}
      onSelect={setCurrentChatId}
      storageKey="chat-sidebar-collapsed"
      headerTitle="History"
      headerSubtitle=""
      headerAction={
        <button
          className="btn"
          onClick={createChat}
          aria-label="Create new chat"
          title="Create new chat"
        >
          <span className="inline-flex items-center gap-1">
            <IconPlus className="w-4 h-4" />
            <span>New</span>
          </span>
        </button>
      }
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
              Project Chat{' '}
              {currentChat ? `(${new Date(currentChat.updateDate).toLocaleString()})` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={activeConfigId || ''} onValueChange={setActive}>
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
            <span>
              LLM not configured. Set your API key in Settings to enable sending messages.
            </span>
            <button className="btn" onClick={() => navigateView('Settings')}>
              Configure
            </button>
          </div>
        )}

        <div ref={messageListRef} className="flex-1 min-h-0 overflow-auto p-4">
          {enhancedMessages.length === 0 && !isThinking ? (
            <div className="mt-10 mx-auto max-w-[720px] text-center text-[var(--text-secondary)]">
              <div className="text-[18px] font-medium">Start chatting about the project</div>
              <div className="text-[13px] mt-2">
                Tip: Use Cmd/Ctrl+Enter to send • Shift+Enter for newline
              </div>
              <div className="mt-4 inline-block rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 py-3 text-[13px]">
                Attach markdown or text files to give context. Mention files with @, and reference
                stories/features with #.
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
                        <RichText text={msg.content} />
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

                    <div
                      className={[
                        'max-w-[72%] min-w-[80px] flex flex-col',
                        isUser ? 'items-end' : 'items-start',
                      ].join(' ')}
                    >
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
                        <RichText text={msg.content} />
                      </div>

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div
                          className={[
                            'mt-1 flex flex-wrap gap-1',
                            isUser ? 'justify-end' : 'justify-start',
                          ].join(' ')}
                        >
                          {msg.attachments.map((path, i) => {
                            const meta = filesByPath[path]
                            const name = meta?.name || path.split('/').pop() || path
                            const type = meta?.type || inferFileType(path)
                            const size = meta?.size ?? undefined
                            const mtime = meta?.mtime ?? undefined
                            return (
                              <FileDisplay
                                key={`${index}-att-${i}-${path}`}
                                file={{ name, path, type, size, mtime }}
                                density="compact"
                                interactive
                                showPreviewOnHover
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {isThinking && (
                <div className="flex items-start gap-2 flex-row">
                  <div
                    className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                    aria-hidden="true"
                  >
                    AI
                  </div>
                  <div className="max-w-[72%] min-w-[80px] flex flex-col items-start">
                    <div className="px-3 py-2 rounded-2xl whitespace-pre-wrap break-words shadow bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-md">
                      <Spinner size="sm" />
                    </div>
                  </div>
                </div>
              )}
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
                  placeholder={
                    isConfigured
                      ? 'Type your message…'
                      : 'You can compose a message and reference files (@) and stories/features (#) even before configuring. Configure LLM to send.'
                  }
                  rows={1}
                  aria-label="Message input"
                  style={{ maxHeight: 200, overflowY: 'auto' }}
                  disabled={isThinking}
                />
                <div className="px-3 py-1 border-t border-[var(--border-subtle)]">
                  {pendingAttachments.length > 0 && (
                    <div className="mb-1 flex flex-wrap gap-1">
                      {pendingAttachments.map((path, idx) => {
                        const meta = filesByPath[path]
                        const name = meta?.name || path.split('/').pop() || path
                        const type = meta?.type || inferFileType(path)
                        const size = meta?.size ?? undefined
                        const mtime = meta?.mtime ?? undefined
                        return (
                          <div key={`${idx}-${path}`} className="inline-flex items-center gap-1">
                            <FileDisplay
                              file={{ name, path, type, size, mtime }}
                              density="compact"
                              interactive
                              showPreviewOnHover
                            />
                            <button
                              type="button"
                              className="btn-secondary"
                              aria-label={`Remove ${name}`}
                              onClick={() =>
                                setPendingAttachments((prev) => prev.filter((p) => p !== path))
                              }
                              disabled={isThinking}
                            >
                              ✕
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-secondary"
                        aria-label="Attach a document"
                        type="button"
                        disabled={isThinking}
                      >
                        Attach
                      </button>
                      <input
                        type="file"
                        accept=".md,.txt,.json,.js,.jsx,.ts,.tsx,.css,.scss,.less,.html,.htm,.xml,.yml,.yaml,.csv,.log,.sh,.bash,.zsh,.bat,.ps1,.py,.rb,.java,.kt,.go,.rs,.c,.h,.cpp,.hpp,.m,.swift,.ini,.conf,.env"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                      <span className="hidden sm:inline">
                        Tip: Use @ for files • Use # for stories and features
                      </span>
                    </div>
                    <span>Cmd/Ctrl+Enter to send • Shift+Enter for newline</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSend}
                className="btn"
                disabled={!canSend || isThinking}
                aria-label="Send message"
              >
                Send
              </button>

              {isAutocompleteOpen && autocompletePosition && (
                <div
                  className="fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)] p-1"
                  style={{
                    left: `${autocompletePosition.left}px`,
                    top: `${autocompletePosition.top}px`,
                    transform: 'translateY(-100%)',
                  }}
                  role="listbox"
                  aria-label="Files suggestions"
                >
                  {matchingDocs.map((path, idx) => {
                    const meta = filesByPath[path]
                    const name = meta?.name || path.split('/').pop() || path
                    const type = meta?.type || inferFileType(path)
                    const size = meta?.size ?? undefined
                    const mtime = meta?.mtime ?? undefined
                    return (
                      <div key={idx} role="option" className="px-1 py-0.5">
                        <FileDisplay
                          file={{ name, path, type, size, mtime }}
                          density="compact"
                          interactive
                          showPreviewOnHover
                          onClick={() => onAutocompleteSelect(path)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}

              {isRefsOpen && refsPosition && (
                <div
                  className="fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)]"
                  style={{
                    left: `${refsPosition.left}px`,
                    top: `${refsPosition.top}px`,
                    transform: 'translateY(-100%)',
                  }}
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
