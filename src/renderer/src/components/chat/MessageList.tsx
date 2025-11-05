import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react'
import Spinner from '../ui/Spinner'
import ErrorBubble from '../ui/ErrorBubble'
import FileDisplay from '../ui/FileDisplay'
import RichText from '../ui/RichText'
import TypewriterText from '../ui/TypewriterText'
import ToolCallCard from './ToolCallCard'
import { useFiles } from '../../contexts/FilesContext'
import { playReceiveSound } from '../../assets/sounds'
import Markdown from '../ui/Markdown'
import { ChatMessage, ToolCall, ToolResult, ToolResultType } from 'thefactory-tools'
import { inferFileType } from 'thefactory-tools/utils'
import { IconToolbox, IconDelete, IconRefresh } from '../ui/icons/Icons'
import { Switch } from '../ui/Switch'

interface EnhancedMessage extends ChatMessage {
  showModel?: boolean
  isFirstInGroup?: boolean
}

function lastMessageIso(messages: ChatMessage[]): string | undefined {
  if (!messages || messages.length === 0) return undefined
  const last = messages[messages.length - 1]
  const cm = (last as any).completionMessage
  if (cm?.completedAt) return cm.completedAt as string
  if (cm?.startedAt) return cm.startedAt as string
  const createdAt = (last as any).createdAt
  if (typeof createdAt === 'string') return createdAt
  return undefined
}

// Best-effort extraction of an ISO timestamp for a single message
function messageIso(message: ChatMessage): string | undefined {
  const cm = (message as any)?.completionMessage
  if (cm?.completedAt) return cm.completedAt as string
  if (cm?.startedAt) return cm.startedAt as string
  const createdAt = (message as any)?.createdAt
  if (typeof createdAt === 'string') return createdAt
  return undefined
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatFriendlyTimestamp(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  if (isSameLocalDay(d, now)) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d)
  }
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }
  if (d.getFullYear() !== now.getFullYear()) {
    opts.year = 'numeric'
  }
  return new Intl.DateTimeFormat(undefined, opts).format(d)
}

export default function MessageList({
  chatId,
  messages,
  isThinking,
  onResumeTools,
  numberMessagesToSend,
  onDeleteLastMessage,
  onAtBottomChange,
  onReadLatest,
  scrollToBottomSignal,
  onRetry,
}: {
  chatId?: string
  messages: ChatMessage[]
  isThinking: boolean
  onResumeTools?: (toolIds: string[]) => void
  numberMessagesToSend?: number
  onDeleteLastMessage?: () => void
  onAtBottomChange?: (atBottom: boolean) => void
  onReadLatest?: (iso?: string) => void
  scrollToBottomSignal?: number
  onRetry?: () => void
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
  const bottomAnchorRef = useRef<HTMLDivElement>(null)
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

  // User pop animation and tracking of recent user send
  const prevLenForUserAnimRef = useRef<number>(messages.length)
  const lastMessageRef = useRef<HTMLDivElement>(null)
  const lastUserSentRef = useRef<boolean>(false)
  useEffect(() => {
    const increased = messages.length > prevLenForUserAnimRef.current
    const last = messages[messages.length - 1]
    const isNewUser = increased && last && last.completionMessage.role === 'user'

    if (animationChatChangedRef.current) {
      prevLenForUserAnimRef.current = messages.length
      lastUserSentRef.current = false
      return
    }
    if (isNewUser) {
      requestAnimationFrame(() => {
        const wrapper = lastMessageRef.current
        const bubble = wrapper?.querySelector('.chat-bubble') as HTMLElement | null
        if (bubble) bubble.classList.add('chat-bubble--in')
      })
      lastUserSentRef.current = true
    } else if (increased) {
      // New non-user message: clear flag
      lastUserSentRef.current = false
    }
    prevLenForUserAnimRef.current = messages.length
  }, [messages])

  // Scrolling behavior
  const isAtBottomRef = useRef<boolean>(true)
  const prevLenForScrollRef = useRef<number>(messages.length)
  const justSwitchedChatRef = useRef<boolean>(false)

  const NEAR_BOTTOM_PX = 80
  const computeIsNearBottom = (): boolean => {
    const c = messageListRef.current
    if (!c) return true
    return c.scrollTop + c.clientHeight >= c.scrollHeight - NEAR_BOTTOM_PX
  }

  const forceScrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const c = messageListRef.current
    if (!c) return
    c.scrollTo({ top: c.scrollHeight, behavior })
    isAtBottomRef.current = true
    onAtBottomChange?.(true)
  }

  const handleScroll: React.UIEventHandler<HTMLDivElement> = (e) => {
    const el = e.currentTarget
    const threshold = 10
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
    if (atBottom !== isAtBottomRef.current) {
      isAtBottomRef.current = atBottom
      onAtBottomChange?.(atBottom)
      // If the user just reached bottom, consider the latest as read
      if (atBottom) onReadLatest?.(lastMessageIso(messages))
    }
  }

  // On chat switch, ensure we start at the bottom (covers cases where spinner is visible on open)
  useEffect(() => {
    justSwitchedChatRef.current = true
    requestAnimationFrame(() => {
      forceScrollToBottom('auto')
      // Clear the switch flag after initial adjustment
      justSwitchedChatRef.current = false
      // On opening, if we're at bottom and there are messages, mark them as read
      if (isAtBottomRef.current) onReadLatest?.(lastMessageIso(messages))
    })
  }, [chatId])

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
        forceScrollToBottom('auto')
        animationChatChangedRef.current = false
        // After snapping, mark latest as read since we're at bottom
        if (isAtBottomRef.current) onReadLatest?.(lastMessageIso(messages))
      })
      return
    }

    // If the assistant is thinking (spinner will render), only pin to bottom when user is near bottom
    if (isThinking && computeIsNearBottom()) {
      requestAnimationFrame(() => {
        forceScrollToBottom('auto')
        if (isAtBottomRef.current) onReadLatest?.(lastMessageIso(messages))
      })
      return
    }

    // If the last new message is from the user, always force-scroll to the very bottom
    const lastNow = messages[messages.length - 1]
    if (lastNow && lastNow.completionMessage.role === 'user') {
      requestAnimationFrame(() => {
        forceScrollToBottom('smooth')
        if (isAtBottomRef.current) onReadLatest?.(lastMessageIso(messages))
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
      // Since we keep the user at bottom, mark as read
      onReadLatest?.(lastMessageIso(messages))
    })
  }, [messages, isThinking])

  // External signal to force scroll to bottom (e.g., when user sends a message)
  const prevSignalRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (typeof scrollToBottomSignal === 'undefined') return
    if (prevSignalRef.current === undefined) {
      // Initialize without action on first mount
      prevSignalRef.current = scrollToBottomSignal
      return
    }
    if (scrollToBottomSignal !== prevSignalRef.current) {
      prevSignalRef.current = scrollToBottomSignal
      requestAnimationFrame(() => {
        forceScrollToBottom('smooth')
        onReadLatest?.(lastMessageIso(messages))
      })
    }
  }, [scrollToBottomSignal, messages, onReadLatest])

  // When entering thinking state, ensure we are fully at the bottom only if user is near bottom
  useLayoutEffect(() => {
    if (!isThinking) return
    if (computeIsNearBottom()) {
      forceScrollToBottom('auto')
      onReadLatest?.(lastMessageIso(messages))
    }
  }, [isThinking])

  // Keep pinned to bottom while DOM mutates only if user is at bottom
  useEffect(() => {
    const container = messageListRef.current
    if (!container) return

    const mo = new MutationObserver(() => {
      if (isAtBottomRef.current) {
        forceScrollToBottom('auto')
        onReadLatest?.(lastMessageIso(messages))
      }
    })
    mo.observe(container, { childList: true, subtree: true, characterData: true })

    const onResize = () => {
      if (isAtBottomRef.current) {
        forceScrollToBottom('auto')
        onReadLatest?.(lastMessageIso(messages))
      }
    }
    window.addEventListener('resize', onResize)

    return () => {
      mo.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Track container height to size system prompt bubble (max 50% of container height)
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

  const cutoffIndex = useMemo(() => {
    if (
      !numberMessagesToSend ||
      messagesToDisplay.length < numberMessagesToSend ||
      numberMessagesToSend < 1
    ) {
      return null
    }
    // The number of messages from history is numberMessagesToSend - 1 (for the new user message)
    // We show the indicator before the first message that will be sent.
    const historyCount = numberMessagesToSend - 1
    if (historyCount < 0) return null
    const idx = messagesToDisplay.length - historyCount
    return idx >= 0 ? idx : null
  }, [messagesToDisplay.length, numberMessagesToSend])

  // Selection state for 'require_confirmation' tools on the last message
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([])

  // Reset selection when chat changes or messages set changes
  useEffect(() => {
    setSelectedToolIds([])
  }, [chatId, messagesToDisplay.length])

  return (
    <div
      ref={messageListRef}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4"
      onScroll={handleScroll}
    >
      {systemPromptMessage && (
        <div className="flex justify-center">
          <div className="inline-flex flex-col items-end max-w-full">
            {(() => {
              const iso = messageIso(systemPromptMessage)
              const ts = iso ? formatFriendlyTimestamp(iso) : ''
              return ts ? (
                <div className="text-[10px] leading-4 text-[var(--text-secondary)] mb-1 opacity-80 select-none">
                  {ts}
                </div>
              ) : null
            })()}
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
              <Markdown text={systemPromptMessage.completionMessage.content} />
            </div>
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
            const isLast = index === messagesToDisplay.length - 1
            const showRetry = !!onRetry && isLast
            return (
              <div key={index} className="flex items-start gap-2">
                {/* Left avatar */}
                <div
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                  aria-hidden="true"
                >
                  AI
                </div>
                <div className="flex-1 max-w-[72%] min-w-[80px] flex flex-col items-start w-full">
                  <ErrorBubble error={msg.error} />
                </div>
                {showRetry ? (
                  <button
                    onClick={() => onRetry?.()}
                    disabled={isThinking}
                    className="btn-icon"
                    aria-label="Retry the last action"
                    title={isThinking ? 'Please wait...' : 'Retry the last action'}
                  >
                    <IconRefresh className="w-5 h-5 mt-4" />
                  </button>
                ) : null}
              </div>
            )
          }

          const isSystem = msg.completionMessage.role === 'system' //system messages here indicate tool results
          const isUser = msg.completionMessage.role === 'user'
          const isAssistant = msg.completionMessage.role === 'assistant'

          const isLast = index === messagesToDisplay.length - 1

          const isShowingToolCalls =
            isAssistant &&
            (isLast || messagesToDisplay[index + 1].toolResults === undefined) &&
            !!msg.toolCalls?.length
          const isShowingToolResults = isSystem && !!msg.toolResults?.length

          const isNewUserBubble =
            isUser &&
            index === enhancedMessages.length - 1 &&
            messages.length > prevLenForUserAnimRef.current

          // Compute toggleable tool ids for the last system message
          const toggleableIds: string[] = (() => {
            if (!(isSystem && isLast)) return []
            const results = msg.toolResults || []
            const ids: string[] = []
            for (const r of results) {
              const t = r.type
              const idVal = r.result
              if (t === 'require_confirmation' && typeof idVal !== 'undefined')
                ids.push(String(idVal))
            }
            return ids
          })()

          const toggleableCount = toggleableIds.length
          const selectedCount = selectedToolIds.filter((id) => toggleableIds.includes(id)).length
          const allSelected =
            toggleableCount > 0 && toggleableIds.every((id) => selectedToolIds.includes(id))

          const showCutoff = cutoffIndex !== null && index === cutoffIndex
          const tooltipText = numberMessagesToSend
            ? `Context cut-off: Messages below this line will be included in the next request. With your settings, your new message and ${
                numberMessagesToSend - 1
              } previous messages will be sent.`
            : ''
          toggleableCount > 0 && isSystem && isLast

          // Determine delete button visibility/labeling
          const lastMsg = messagesToDisplay[messagesToDisplay.length - 1]
          const lastIsSystemToolResults =
            lastMsg?.completionMessage?.role === 'system' &&
            Array.isArray(lastMsg?.toolResults) &&
            (lastMsg?.toolResults?.length ?? 0) > 0

          const isAssistantBeforeSystemToolResults =
            isAssistant && index === messagesToDisplay.length - 2 && lastIsSystemToolResults

          const isDeletableSystemLast = isSystem && isLast && !isShowingToolResults

          const shouldShowDelete =
            !!onDeleteLastMessage &&
            ((isLast && (isUser || isAssistant)) ||
              isAssistantBeforeSystemToolResults ||
              isDeletableSystemLast)

          const deleteTitle = isAssistantBeforeSystemToolResults
            ? 'Delete last assistant message and tool results'
            : 'Delete last message'

          return (
            <div key={index}>
              {showCutoff && (
                <div className="relative text-center my-4 group" title={tooltipText}>
                  <hr className="border-dashed border-neutral-300 dark:border-neutral-700" />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 bg-[var(--surface-base)] text-xs text-neutral-500 whitespace-nowrap">
                    Context from here on
                  </span>
                </div>
              )}
              <div
                ref={index === enhancedMessages.length - 1 ? lastMessageRef : null}
                className={[
                  'flex items-start gap-2',
                  isUser ? 'flex-row-reverse' : 'flex-row',
                ].join(' ')}
              >
                <div className="flex flex-col items-center group">
                  <div
                    className={[
                      'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold',
                      isUser
                        ? 'bg-[var(--accent-primary)] text-[var(--text-inverted)]'
                        : isSystem
                          ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                          : 'bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)] text-[var(--text-primary)] border border-[var(--border-subtle)]',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {isUser ? 'You' : isSystem ? <IconToolbox /> : 'AI'}
                  </div>
                  {shouldShowDelete ? (
                    <button
                      type="button"
                      title={deleteTitle}
                      aria-label={deleteTitle}
                      className={[
                        'mt-1 transition-opacity opacity-0 group-hover:opacity-100',
                        'btn-secondary btn-icon w-6 h-6',
                      ].join(' ')}
                      onClick={() => onDeleteLastMessage && onDeleteLastMessage()}
                      disabled={isThinking}
                    >
                      <IconDelete className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>

                <div
                  className={[
                    'max-w-[85%] min-w-0 flex flex-col',
                    isUser ? 'items-end' : isSystem ? 'w-full' : 'items-start',
                  ].join(' ')}
                >
                  <div
                    className={['inline-flex flex-col', isUser ? 'items-start' : 'items-end'].join(
                      ' ',
                    )}
                  >
                    {(() => {
                      const iso = messageIso(msg)
                      const ts = iso ? formatFriendlyTimestamp(iso) : ''

                      if (isAssistant) {
                        return (
                          <div className="w-full flex justify-between items-baseline">
                            {msg.showModel && msg.model ? (
                              <div className="text-[11px] text-[var(--text-secondary)] mb-1 inline-flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--surface-overlay)] rounded-full px-2 py-[2px]">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                                {msg.model.model}
                              </div>
                            ) : (
                              <div />
                            )}
                            {ts ? (
                              <div className="text-[10px] leading-4 text-[var(--text-secondary)] mb-1 opacity-80 select-none">
                                {ts}
                              </div>
                            ) : null}
                          </div>
                        )
                      }

                      return ts ? (
                        <div className="text-[10px] leading-4 text-[var(--text-secondary)] mb-1 opacity-80 select-none">
                          {ts}
                        </div>
                      ) : null
                    })()}

                    {!isAssistant && msg.showModel && msg.model && (
                      <div className="text-[11px] text-[var(--text-secondary)] mb-1 inline-flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--surface-overlay)] rounded-full px-2 py-[2px]">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                        {msg.model.model}
                      </div>
                    )}

                    {msg.completionMessage.content || (isSystem && toggleableCount > 0) ? (
                      <div
                        className={[
                          'overflow-hidden max-w-full px-3 py-2 rounded-2xl whitespace-pre-wrap break-words shadow',
                          isUser
                            ? 'bg-[var(--accent-primary)] text-[var(--text-inverted)] rounded-br-md'
                            : isSystem
                              ? toggleableCount > 0
                                ? 'border bg-teal-500/20 border-teal-600 dark:border-teal-700 dark:bg-teal-800/60'
                                : 'border bg-[var(--surface-overlay)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                              : 'bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-md',
                          msg.isFirstInGroup ? '' : isUser ? 'rounded-tr-md' : 'rounded-tl-md',
                          'chat-bubble',
                          isNewUserBubble ? 'chat-bubble--user-pop-enter' : '',
                        ].join(' ')}
                      >
                        {isUser ? (
                          <RichText text={msg.completionMessage.content} />
                        ) : index === animateAssistantIdx ? (
                          <TypewriterText
                            text={msg.completionMessage.content}
                            renderer="markdown"
                          />
                        ) : isSystem ? (
                          toggleableCount > 0 ? (
                            <div className="text-sm">
                              The assistant wants to run tools. Please grant permission for the
                              tools you want to allow.
                            </div>
                          ) : (
                            <Markdown text={msg.completionMessage.content} />
                          )
                        ) : (
                          <Markdown text={msg.completionMessage.content} />
                        )}
                      </div>
                    ) : null}
                  </div>

                  {isShowingToolCalls && (
                    <div className="mt-2 w-full space-y-2">
                      {msg.toolCalls!.map((call: ToolCall, i: number) => {
                        return (
                          <ToolCallCard
                            key={`tool-${index}-${i}`}
                            toolCall={call}
                            selectable={false}
                            disabled={true}
                          />
                        )
                      })}
                    </div>
                  )}
                  {isShowingToolResults && (
                    <div className="mt-2 w-full space-y-2">
                      {msg.toolResults!.map((result: ToolResult, i: number) => {
                        const resultType = result.type
                        const isRequireConfirm = resultType === 'require_confirmation'
                        const resultId = result.result
                        const selectable =
                          isSystem && isLast && isRequireConfirm && resultId !== undefined

                        const effectiveResultType: ToolResultType | undefined =
                          isRequireConfirm && !isLast ? 'aborted' : resultType

                        const resultIdStr = String(resultId)

                        return (
                          <ToolCallCard
                            key={`tool-${index}-${i}`}
                            toolCall={result.call}
                            result={result.result}
                            resultType={effectiveResultType}
                            durationMs={result.durationMs}
                            selectable={selectable}
                            selected={selectable ? selectedToolIds.includes(resultIdStr) : false}
                            onToggleSelect={
                              selectable
                                ? () => {
                                    setSelectedToolIds((prev) =>
                                      prev.includes(resultIdStr)
                                        ? prev.filter((x) => x !== resultIdStr)
                                        : [...prev, resultIdStr],
                                    )
                                  }
                                : undefined
                            }
                            disabled={!selectable}
                          />
                        )
                      })}

                      {toggleableCount > 0 && isSystem && isLast ? (
                        <div className="pt-1 flex items-center justify-between">
                          {toggleableCount > 1 ? (
                            <div className="flex items-center gap-2 text:[12px] text-[var(--text-secondary)]">
                              <span>Toggle all</span>
                              <Switch
                                checked={allSelected}
                                onCheckedChange={(checked) => {
                                  setSelectedToolIds((prev) => {
                                    if (checked) {
                                      const set = new Set([...prev, ...toggleableIds])
                                      return Array.from(set)
                                    } else {
                                      return prev.filter((id) => !toggleableIds.includes(id))
                                    }
                                  })
                                }}
                              />
                            </div>
                          ) : (
                            <div />
                          )}
                          <button
                            type="button"
                            className={[
                              'btn',
                              selectedCount > 0
                                ? 'bg-green-600 hover:bg-green-700 text-white border-transparent'
                                : 'bg-[var(--surface-overlay)] text-[var(--text-secondary)] border border-[var(--border-subtle)] cursor-not-allowed opacity-70',
                            ].join(' ')}
                            disabled={selectedCount === 0 || !onResumeTools}
                            onClick={() => {
                              if (!onResumeTools) return
                              const validSelected = selectedToolIds.filter((id) =>
                                toggleableIds.includes(id),
                              )
                              onResumeTools(validSelected)
                            }}
                          >
                            {`Resume ${selectedCount}/${toggleableCount} Tools`}
                          </button>
                        </div>
                      ) : null}
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
      {/* Anchor at the very bottom to ensure flush scrolling when needed */}
      <div ref={bottomAnchorRef} />
    </div>
  )
}
