import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChatMessage } from 'src/chat/ChatsManager'
import Spinner from '../ui/Spinner'
import ErrorBubble from '../ui/ErrorBubble'
import FileDisplay from '../ui/FileDisplay'
import RichText from '../ui/RichText'
import TypewriterText from '../ui/TypewriterText'
import ToolCallCard from './ToolCallCard'
import { inferFileType, useFiles } from '../../contexts/FilesContext'
import { playReceiveSound } from '../../../../assets/sounds'

interface EnhancedMessage extends ChatMessage {
  showModel?: boolean
  isFirstInGroup?: boolean
}

function parseAssistant(content: string): { thoughts?: string; tool_calls?: any[] } | null {
  try {
    const obj = JSON.parse(content)
    if (obj && typeof obj === 'object') return obj as any
    return null
  } catch {
    return null
  }
}

function parseToolResultsObjects(
  text?: string,
): Array<{ name: string; result: any; durationMs?: number }> {
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

export default function MessageList({
  chatId,
  messages,
  isThinking,
}: {
  chatId?: string
  messages: ChatMessage[]
  isThinking: boolean
}) {
  const { filesByPath } = useFiles()

  // Enhanced messages to group and mark model changes
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

  // Sounds: play receive only when a new assistant message arrives and not on chat switch
  const prevCountRef = useRef<number>(messages.length)
  const lastChatIdRef = useRef<string | undefined>(chatId)
  useEffect(() => {
    const switched = lastChatIdRef.current !== chatId
    if (switched) {
      lastChatIdRef.current = chatId
      prevCountRef.current = messages.length
      return
    }
    if (messages.length > prevCountRef.current) {
      const last = messages[messages.length - 1]
      if (last?.role === 'assistant' && !last.error) {
        playReceiveSound()
      }
    }
    prevCountRef.current = messages.length
  }, [messages, chatId])

  // Animate assistant typing for the latest assistant message
  const [animateAssistantIdx, setAnimateAssistantIdx] = useState<number | null>(null)
  const prevLenForAnimRef = useRef<number>(messages.length)
  const animationChatChangedRef = useRef<boolean>(false)
  useEffect(() => {
    // mark animation skip on chat change
    animationChatChangedRef.current = true
  }, [chatId])

  useEffect(() => {
    if (animationChatChangedRef.current) {
      animationChatChangedRef.current = false
      prevLenForAnimRef.current = messages.length
      setAnimateAssistantIdx(null)
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

  // User pop animation
  const prevLenForUserAnimRef = useRef<number>(messages.length)
  const lastMessageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const increased = messages.length > prevLenForUserAnimRef.current
    const last = messages[messages.length - 1]
    const isNewUser = increased && last && last.role === 'user'

    if (animationChatChangedRef.current) {
      prevLenForUserAnimRef.current = messages.length
      return
    }
    if (isNewUser) {
      requestAnimationFrame(() => {
        const wrapper = lastMessageRef.current
        const bubble = wrapper?.querySelector('.chat-bubble') as HTMLElement | null
        if (bubble) bubble.classList.add('chat-bubble--in')
      })
    }
    prevLenForUserAnimRef.current = messages.length
  }, [messages])

  // Scrolling behavior
  const isAtBottomRef = useRef<boolean>(true)
  const messageListRef = useRef<HTMLDivElement>(null)
  const prevLenForScrollRef = useRef<number>(messages.length)
  const handleScroll: React.UIEventHandler<HTMLDivElement> = (e) => {
    const el = e.currentTarget
    const threshold = 10
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
    isAtBottomRef.current = atBottom
  }

  useEffect(() => {
    const container = messageListRef.current
    if (!container) return

    const prev = prevLenForScrollRef.current
    const increased = messages.length > prev
    prevLenForScrollRef.current = messages.length

    if (!increased) return

    // If chat switched, jump to bottom
    if (animationChatChangedRef.current) {
      requestAnimationFrame(() => {
        const c = messageListRef.current
        if (!c) return
        c.scrollTo({ top: c.scrollHeight, behavior: 'auto' })
        animationChatChangedRef.current = false
        isAtBottomRef.current = true
      })
      return
    }

    // Only partially scroll when user is at bottom
    if (!isAtBottomRef.current) return

    requestAnimationFrame(() => {
      const c = messageListRef.current
      if (!c) return
      const revealPadding = 24
      const lastEl = lastMessageRef.current
      let targetTop = c.scrollHeight - c.clientHeight - revealPadding
      if (lastEl) {
        targetTop = lastEl.offsetTop - (c.clientHeight - revealPadding)
      }
      if (targetTop < 0) targetTop = 0
      c.scrollTo({ top: targetTop, behavior: 'smooth' })
    })
  }, [messages])

  // When entering thinking state and user is at bottom, reveal spinner gently
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

  return (
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
                  <div className="max-w-[72%] min-w-0 min-w-[80px] flex flex-col items-start">
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
                  <div className="text:[12px] text-[var(--text-muted)] italic bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded-full px-3 py-1">
                    <RichText text={msg.content} />
                  </div>
                </div>
              )
            }

            const isNewUserBubble =
              isUser &&
              index === enhancedMessages.length - 1 &&
              messages.length > prevLenForUserAnimRef.current

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
                    'max-w-[72%] min-w-0 min-w-[80px] flex flex-col',
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
                      'overflow-hidden max-w-full px-3 py-2 rounded-2xl whitespace-pre-wrap break-words break-all shadow',
                      isUser
                        ? 'bg-[var(--accent-primary)] text-[var(--text-inverted)] rounded-br-md'
                        : 'bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-md',
                      msg.isFirstInGroup ? '' : isUser ? 'rounded-tr-md' : 'rounded-tl-md',
                      'chat-bubble',
                      isNewUserBubble ? 'chat-bubble--user-pop-enter' : '',
                    ].join(' ')}
                  >
                    {isUser ? (
                      <RichText text={msg.content} />
                    ) : index === animateAssistantIdx ? (
                      <TypewriterText text={msg.content} />
                    ) : (
                      <RichText text={msg.content} />
                    )}
                  </div>

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
              <div className="max-w-[72%] min-w-0 min-w-[80px] flex flex-col items-start">
                <div className="overflow-hidden max-w-full px-3 py-2 rounded-2xl whitespace-pre-wrap break-words break-all shadow bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-md">
                  <Spinner />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
