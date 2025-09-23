import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select'
import { useChats } from '../hooks/useChats'
import { useLLMConfig } from '../contexts/LLMConfigContext'
import { useNavigator } from '../navigation/Navigator'
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar'
import FileDisplay from '../components/ui/FileDisplay'
import RichText from '../components/ui/RichText'
import { inferFileType, useFiles } from '../contexts/FilesContext'
import { IconChat, IconDelete, IconPlus } from '../components/ui/Icons'
import Spinner from '../components/ui/Spinner'
import ErrorBubble from '../components/ui/ErrorBubble'
import { ChatInput } from '../components/Chat'
import { Chat, ChatMessage } from 'src/chat/ChatsManager'
import TypewriterText from '../components/ui/TypewriterText'
import JsonView from '../components/ui/JsonView'

interface EnhancedMessage extends ChatMessage {
  showModel?: boolean
  isFirstInGroup?: boolean
}

// Parse assistant JSON response to extract thoughts and tool calls safely
function parseAssistant(content: string): { thoughts?: string; tool_calls?: any[] } | null {
  try {
    const obj = JSON.parse(content)
    if (obj && typeof obj === 'object') return obj as any
    return null
  } catch {
    return null
  }
}

// Attempt to parse tool results (array of { name, result, durationMs? })
function parseToolResultsObjects(text?: string): Array<{ name: string; result: any; durationMs?: number }> {
  const trimmed = (text || '').trim()
  if (!trimmed) return []
  try {
    const arr = JSON.parse(trimmed)
    if (Array.isArray(arr)) {
      return arr.filter(
        (x) => x && typeof x === 'object' && typeof x.name === 'string' && 'result' in x,
      )
    }
  } catch {}
  return []
}

function isLargeJson(value: any) {
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value)
    return s.length > 600
  } catch {
    return false
  }
}

function Collapsible({
  title,
  children,
  defaultOpen = false,
  className,
  innerClassName,
}: {
  title: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  innerClassName?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className={`${className ?? ''} border rounded-md border-[var(--border-subtle)] bg-[var(--surface-overlay)]`}
    >
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--surface-raised)]"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xs font-medium truncate pr-2">{title}</span>
        <span className="text-xs text-[var(--text-secondary)]">{open ? '\u2212' : '+'}</span>
      </button>
      {open ? (
        <div className={`${innerClassName ?? ''} border-t border-[var(--border-subtle)]`}>{children}</div>
      ) : null}
    </div>
  )
}

function ToolCallCard({
  index,
  toolName,
  args,
  result,
  durationMs,
}: {
  index: number
  toolName: string
  args: any
  result?: any
  durationMs?: number
}) {
  const isHeavy = toolName === 'read_files' || toolName === 'write_file' || isLargeJson(args) || isLargeJson(result)
  const durationText = typeof durationMs === 'number' ? `${(durationMs / 1000).toFixed(2)}s` : undefined
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)]">
      <div className="px-3 py-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold">
            {index + 1}. {toolName}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">Arguments</div>
        </div>
        {durationText && (
          <div className="flex-shrink-0 bg-[var(--surface-overlay)] rounded-full px-2 py-0.5 text-xs text-[var(--text-secondary)] whitespace-nowrap border border-[var(--border-subtle)]">
            {durationText}
          </div>
        )}
      </div>
      <div className="px-3 pb-2">
        {isHeavy ? (
          <Collapsible title={<span>View arguments</span>}>
            <div className="p-2 max-h-64 overflow-auto bg-[var(--surface-raised)] border-t border-[var(--border-subtle)]">
              <JsonView value={args} />
            </div>
          </Collapsible>
        ) : (
          <div className="rounded bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-2 max-h-60 overflow-auto">
            <JsonView value={args} />
          </div>
        )}
      </div>
      {typeof result !== 'undefined' && (
        <div className="px-3 pb-3">
          <div className="text-[11px] text-[var(--text-secondary)] mb-1">Result</div>
          {isHeavy ? (
            <Collapsible title={<span>View result</span>}>
              <div className="p-2 max-h-72 overflow-auto bg-[var(--surface-raised)] border-t border-[var(--border-subtle)]">
                <JsonView value={result} />
              </div>
            </Collapsible>
          ) : (
            <div className="rounded bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-2 text-xs whitespace-pre-wrap break-words max-h-60 overflow-auto">
              <JsonView value={result} />
            </div>
          )}
        </div>
      )}
    </div>
  )
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
  const { filesByPath } = useFiles()
  const { configs, activeConfigId, activeConfig, isConfigured, setActive } = useLLMConfig()
  const { navigateView } = useNavigator()

  const sendSound = useMemo(() => new Audio(sendSoundFile), [])
  const receiveSound = useMemo(() => new Audio(receiveSoundFile), [])

  const [currentChat, setCurrentChat] = useState<Chat | undefined>()
  const messageListRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const prevMessagesCountRef = useRef(messages.length)
  const chatChanged = useRef(false)

  // Track which assistant message should animate (index-based)
  const [animateAssistantIdx, setAnimateAssistantIdx] = useState<number | null>(null)
  const prevLenForAnimRef = useRef<number>(messages.length)
  const animationChatChangedRef = useRef<boolean>(false)

  // Track new-user-message animation (length-based)
  const prevLenForUserAnimRef = useRef<number>(messages.length)

  // Scrolling state/refs
  const isAtBottomRef = useRef<boolean>(true)
  const lastMessageRef = useRef<HTMLDivElement>(null)
  const prevLenForScrollRef = useRef<number>(messages.length)

  useEffect(() => {
    chatChanged.current = true
    // also mark animation to skip on initial load of a different chat
    animationChatChangedRef.current = true
  }, [currentChatId])

  useEffect(() => {
    if (chatChanged.current) {
      // On chat switch, don't play receive sound for historical messages
      chatChanged.current = false
      prevMessagesCountRef.current = messages.length
      return
    }
    if (
      messages.length > prevMessagesCountRef.current &&
      messages[messages.length - 1]?.role === 'assistant'
    ) {
      receiveSound.play()
    }
    prevMessagesCountRef.current = messages.length
  }, [messages, receiveSound])

  // Decide when to animate the latest assistant message
  useEffect(() => {
    if (animationChatChangedRef.current) {
      // Skip animation when chat changes (initial load of messages)
      animationChatChangedRef.current = false
      prevLenForAnimRef.current = messages.length
      setAnimateAssistantIdx(null)
      // Also align user animation tracker to avoid false pop after switching chats
      prevLenForUserAnimRef.current = messages.length
      return
    }

    if (messages.length > prevLenForAnimRef.current) {
      const lastIdx = messages.length - 1
      const lastMsg = messages[lastIdx]
      if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.error) {
        setAnimateAssistantIdx(lastIdx)
      } else {
        setAnimateAssistantIdx(null)
      }
    }

    prevLenForAnimRef.current = messages.length
  }, [messages])

  // Trigger the user bubble pop-in transition when a new user message is appended
  useEffect(() => {
    const increased = messages.length > prevLenForUserAnimRef.current
    const last = messages[messages.length - 1]
    const isNewUser = increased && last && last.role === 'user'

    if (animationChatChangedRef.current) {
      // On chat switch, align counters and skip animation
      prevLenForUserAnimRef.current = messages.length
      return
    }

    if (isNewUser) {
      requestAnimationFrame(() => {
        const wrapper = lastMessageRef.current
        const bubble = wrapper?.querySelector('.chat-bubble') as HTMLElement | null
        if (bubble) {
          bubble.classList.add('chat-bubble--in')
        }
      })
    }

    prevLenForUserAnimRef.current = messages.length
  }, [messages])

  // Track is-at-bottom on user scroll
  const handleScroll: React.UIEventHandler<HTMLDivElement> = (e) => {
    const el = e.currentTarget
    const threshold = 10
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
    isAtBottomRef.current = atBottom
  }

  // Auto-scroll behavior
  useEffect(() => {
    const container = messageListRef.current
    if (!container) return

    const prev = prevLenForScrollRef.current
    const increased = messages.length > prev
    prevLenForScrollRef.current = messages.length

    if (!increased) return

    // If we just switched chats, jump to bottom (show full latest) and exit
    if (animationChatChangedRef.current) {
      requestAnimationFrame(() => {
        const c = messageListRef.current
        if (!c) return
        c.scrollTo({ top: c.scrollHeight, behavior: 'auto' })
        animationChatChangedRef.current = false
        // Being at bottom now
        isAtBottomRef.current = true
      })
      return
    }

    // Only partially scroll when user is at the bottom
    if (!isAtBottomRef.current) return

    requestAnimationFrame(() => {
      const c = messageListRef.current
      if (!c) return
      const revealPadding = 24 // small gap so user starts reading without chasing
      const lastEl = lastMessageRef.current

      let targetTop = c.scrollHeight - c.clientHeight - revealPadding
      if (lastEl) {
        targetTop = lastEl.offsetTop - (c.clientHeight - revealPadding)
      }
      if (targetTop < 0) targetTop = 0
      c.scrollTo({ top: targetTop, behavior: 'smooth' })
    })
  }, [messages])

  // When entering thinking state and user is at bottom, reveal spinner start gently
  useEffect(() => {
    const c = messageListRef.current
    if (!c) return
    if (!isThinking) return
    if (!isAtBottomRef.current) return

    requestAnimationFrame(() => {
      const container = messageListRef.current
      if (!container) return
      const revealPadding = 24
      const targetTop = Math.max(0, container.scrollHeight - container.clientHeight - revealPadding)
      container.scrollTo({ top: targetTop, behavior: 'smooth' })
    })
  }, [isThinking])

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

  const handleSend = async (message: string, attachments: string[]) => {
    if (!activeConfig) return
    sendSound.play()
    await sendMessage(message, activeConfig, attachments)
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
      {/* Fixed-height chat container to avoid responsive vh; list scrolls vertically */}
      <section className="flex-1 flex flex-col w-full h-[720px] bg-[var(--surface-base)] overflow-hidden">
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

        <div
          ref={messageListRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4"
          onScroll={handleScroll}
        >
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
                if (msg.error) {
                  return (
                    <div key={index} className="flex items-start gap-2 flex-row">
                      <div
                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                        aria-hidden="true"
                      >
                        AI
                      </div>
                      <div className="max-w-[72%] min-w-[80px] flex flex-col items-start">
                        <ErrorBubble error={msg.error} />
                      </div>
                    </div>
                  )
                }
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

                // Determine if this is a newly added user message to apply pop-in classes
                const isNewUserBubble =
                  isUser &&
                  index === enhancedMessages.length - 1 &&
                  messages.length > prevLenForUserAnimRef.current &&
                  !animationChatChangedRef.current

                // Parse assistant content (thoughts/tool calls) and pair with next tool results message
                const parsedAssistant = !isUser ? parseAssistant(msg.content) : null
                const hasToolCalls = !!parsedAssistant?.tool_calls?.length
                let toolResults: Array<{ name: string; result: any; durationMs?: number }> = []
                if (hasToolCalls) {
                  const nextMsg = messages[index + 1]
                  if (nextMsg && nextMsg.role === 'user') {
                    toolResults = parseToolResultsObjects(nextMsg.content)
                  }
                }

                return (
                  <div
                    key={index}
                    ref={index === enhancedMessages.length - 1 ? lastMessageRef : null}
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
                          // Bubble animation classes
                          'chat-bubble',
                          isNewUserBubble ? 'chat-bubble--user-pop-enter' : '',
                        ].join(' ')}
                      >
                        {isUser ? (
                          <RichText text={msg.content} />
                        ) : index === animateAssistantIdx ? (
                          // If the assistant sent structured JSON, we still animate typing for natural feel
                          <TypewriterText text={msg.content} />
                        ) : (
                          <RichText text={msg.content} />
                        )}
                      </div>

                      {/* Tool call inspection view */}
                      {!isUser && hasToolCalls && (
                        <div className="mt-2 w-full space-y-2">
                          {parsedAssistant!.tool_calls!.map((call: any, i: number) => {
                            const name = call.tool_name || call.name || 'tool'
                            const args = call.arguments ?? {}
                            const res = toolResults[i]
                            return (
                              <ToolCallCard
                                key={`tool-${index}-${i}`}
                                index={i}
                                toolName={name}
                                args={args}
                                result={res?.result}
                                durationMs={res?.durationMs}
                              />
                            )
                          })}
                        </div>
                      )}

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
                            const ctime = meta?.ctime ?? undefined
                            return (
                              <FileDisplay
                                key={`${index}-att-${i}-${path}`}
                                file={{
                                  name,
                                  absolutePath: path,
                                  relativePath: path,
                                  type,
                                  size,
                                  mtime,
                                  ctime,
                                }}
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
                      <Spinner />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <ChatInput onSend={handleSend} isThinking={isThinking} isConfigured={isConfigured} />
      </section>
    </CollapsibleSidebar>
  )
}
