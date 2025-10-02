import React, { useEffect, useMemo, useRef, useState } from 'react'
import Spinner from '../ui/Spinner'
import ErrorBubble from '../ui/ErrorBubble'
import FileDisplay from '../ui/FileDisplay'
import RichText from '../ui/RichText'
import TypewriterText from '../ui/TypewriterText'
import ToolCallCard from './ToolCallCard'
import { useFiles } from '../../contexts/FilesContext'
import { playReceiveSound } from '../../assets/sounds'
import Markdown from '../ui/Markdown'
import { ChatMessage, ToolCall } from 'thefactory-tools'
import { inferFileType } from 'thefactory-tools/utils'

interface EnhancedMessage extends ChatMessage {
  showModel?: boolean
  isFirstInGroup?: boolean
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

  const enhancedMessages: EnhancedMessage[] = useMemo(() => {
    return messages.map((m, index) => {
      let showModel = false
      if (m.completionMessage.role === 'assistant' && m.model) {
        const prevAssistant = [...messages.slice(0, index)]
          .reverse()
          .find((m) => m.completionMessage.role === 'assistant')
        showModel = !prevAssistant || prevAssistant.model !== m.model
      }
      let effectiveMessage = { ...m }
      if (m.toolResults?.length) {
        effectiveMessage.completionMessage.role = 'system'
      }
      const prev = messages[index - 1]
      const isFirstInGroup =
        !prev ||
        prev.completionMessage.role !== effectiveMessage.completionMessage.role ||
        effectiveMessage.completionMessage.role === 'system'
      return { ...effectiveMessage, showModel, isFirstInGroup }
    })
  }, [messages])

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
      if (last?.completionMessage.role === 'assistant' && !last.error) {
        playReceiveSound()
      }
    }
    prevCountRef.current = messages.length
  }, [messages, chatId])

  // Visibility tracking: only animate when visible (sidebar open and rendered)
  const messageListRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState<boolean>(false)
  const wasVisibleRef = useRef<boolean>(false)
  useEffect(() => {
    const el = messageListRef.current
    if (!el) return

    // If element is display:none initially, IO will fire when it becomes visible
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsVisible(entry.isIntersecting)
        }
      },
      { root: null, threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Animate assistant typing for the latest assistant message
  const [animateAssistantIdx, setAnimateAssistantIdx] = useState<number | null>(null)
  const prevLenForAnimRef = useRef<number>(messages.length)
  const animationChatChangedRef = useRef<boolean>(false)
  useEffect(() => {
    // mark animation skip on chat change
    animationChatChangedRef.current = true
  }, [chatId])

  // When visibility toggles from hidden to visible, clear any pending animation and sync counters
  useEffect(() => {
    if (!wasVisibleRef.current && isVisible) {
      // Just became visible: do not animate existing messages
      setAnimateAssistantIdx(null)
      prevLenForAnimRef.current = messages.length
    }
    wasVisibleRef.current = isVisible
  }, [isVisible, messages.length])

  useEffect(() => {
    if (animationChatChangedRef.current) {
      animationChatChangedRef.current = false
      prevLenForAnimRef.current = messages.length
      setAnimateAssistantIdx(null)
      return
    }
    // Only set animation when visible to user
    if (!isVisible) {
      // Keep the counter updated but do not set animation while hidden
      prevLenForAnimRef.current = messages.length
      return
    }
    if (messages.length > prevLenForAnimRef.current) {
      const lastIdx = messages.length - 1
      const lastMsg = messages[lastIdx]
      if (lastMsg && lastMsg.completionMessage.role === 'assistant' && !lastMsg.error) {
        setAnimateAssistantIdx(lastIdx)
      } else {
        setAnimateAssistantIdx(null)
      }
    }
    prevLenForAnimRef.current = messages.length
  }, [messages, isVisible])

  // User pop animation
  const prevLenForUserAnimRef = useRef<number>(messages.length)
  const lastMessageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const increased = messages.length > prevLenForUserAnimRef.current
    const last = messages[messages.length - 1]
    const isNewUser = increased && last && last.completionMessage.role === 'user'

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

  // Track container height to size system prompt bubble (max 30% of container height)
  const [systemMaxHeight, setSystemMaxHeight] = useState<number | undefined>(undefined)
  useEffect(() => {
    const container = messageListRef.current
    if (!container) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height
        setSystemMaxHeight(Math.max(0, Math.floor(h * 0.5)))
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  const systemPromptMessage = useMemo(() => {
    return enhancedMessages.length === 1 && enhancedMessages[0].completionMessage.role === 'system'
      ? enhancedMessages[0]
      : undefined
  }, [enhancedMessages])
  const messagesToDisplay = useMemo(() => {
    return systemPromptMessage !== undefined ? enhancedMessages.slice(1) : enhancedMessages
  }, [enhancedMessages, systemPromptMessage])

  return (
    <div
      ref={messageListRef}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4"
      onScroll={handleScroll}
    >
      {systemPromptMessage && (
        <div className="flex justify-center">
          <div
            className={[
              'overflow-y-auto max-w-full px-3 py-2 rounded-2xl break-words shadow border',
              'bg-[var(--surface-overlay)] text-[var(--text-primary)] border-[var(--border-subtle)]',
              'chat-bubble',
            ].join(' ')}
            style={{
              maxHeight: systemMaxHeight ? `${systemMaxHeight}px` : undefined,
              minHeight: '3.5em',
            }}
            aria-label="System prompt"
          >
            {/* <MarkdownMessage text={systemMessage.completionMessage.content} /> */}
            <Markdown text={systemPromptMessage.completionMessage.content} />
          </div>
        </div>
      )}

      {(enhancedMessages.length === 0 || systemPromptMessage != undefined) && !isThinking && (
        <div className="mt-10 mx-auto max-w-[720px] text-center text-[var(--text-secondary)]">
          <div className="text-[18px] font-medium">Start chatting about the project</div>
          <div className="mt-4 inline-block rounded-lg border border-[var(--border-default)] bg-[var(--surface-raised)] px-4 py-3 text-[13px]">
            Attach text files to give context
            <br />
            Mention files with @<br />
            Reference stories/features with #
          </div>
        </div>
      )}
      <div className="mx-auto max-w-[960px] space-y-3">
        {messagesToDisplay.map((msg, index) => {
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

          const isSystem = msg.completionMessage.role === 'system' //system messages here indicate tool results
          const isUser = msg.completionMessage.role === 'user'
          const isNewUserBubble =
            isUser &&
            index === enhancedMessages.length - 1 &&
            messages.length > prevLenForUserAnimRef.current

          return (
            <div
              key={index}
              ref={index === enhancedMessages.length - 1 ? lastMessageRef : null}
              className={['flex items-start gap-2', isUser ? 'flex-row-reverse' : 'flex-row'].join(
                ' ',
              )}
            >
              <div
                className={[
                  'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold',
                  isUser
                    ? 'bg-[var(--accent-primary)] text-[var(--text-inverted)]'
                    : isSystem
                      ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                      : 'bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)] text-[var(--text-primary)] border border-[var(--border-subtle)]',
                ].join(' ')}
                aria-hidden="true"
              >
                {isUser ? 'You' : isSystem ? 'TOOLS' : 'AI'}
              </div>

              <div
                className={[
                  'max-w-[85%] min-w-0 flex flex-col',
                  isUser ? 'items-end' : isSystem ? 'items-center' : 'items-start',
                ].join(' ')}
              >
                {msg.showModel && msg.model && (
                  <div className="text-[11px] text-[var(--text-secondary)] mb-1 inline-flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--surface-overlay)] rounded-full px-2 py-[2px]">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                    {msg.model.model}
                  </div>
                )}

                <div
                  className={[
                    'overflow-hidden max-w-full px-3 py-2 rounded-2xl whitespace-pre-wrap break-words shadow',
                    isUser
                      ? 'bg-[var(--accent-primary)] text-[var(--text-inverted)] rounded-br-md'
                      : isSystem
                        ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                        : 'bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-md',
                    msg.isFirstInGroup ? '' : isUser ? 'rounded-tr-md' : 'rounded-tl-md',
                    'chat-bubble',
                    isNewUserBubble ? 'chat-bubble--user-pop-enter' : '',
                  ].join(' ')}
                >
                  {isUser ? (
                    <RichText text={msg.completionMessage.content} />
                  ) : index === animateAssistantIdx ? (
                    <TypewriterText text={msg.completionMessage.content} renderer="markdown" />
                  ) : (
                    !isSystem && <Markdown text={msg.completionMessage.content} />
                  )}
                </div>

                {!!msg.toolCalls && (
                  <div className="mt-2 w-full space-y-2">
                    {msg.toolCalls.map((call: ToolCall, i: number) => {
                      const name = call.name
                      const args = call.arguments ?? {}
                      const res = msg.toolResults?.[i]
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

                {msg.completionMessage.files && msg.completionMessage.files.length > 0 && (
                  <div
                    className={[
                      'mt-1 flex flex-wrap gap-1',
                      isUser ? 'justify-end' : 'justify-start',
                    ].join(' ')}
                  >
                    {msg.completionMessage.files.map((path, i) => {
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
              <div className="overflow-hidden max-w-full px-3 py-2 rounded-2xl whitespace-pre-wrap break-words break-all shadow bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-md">
                <Spinner />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
