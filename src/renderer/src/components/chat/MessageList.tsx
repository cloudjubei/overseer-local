import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
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
import { useChatUnread } from '@renderer/hooks/useChatUnread'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { factoryToolsService } from '@renderer/services/factoryToolsService'

interface EnhancedMessage extends ChatMessage {
  showModel?: boolean
  isFirstInGroup?: boolean
}

type ToolPreview =
  | { status: 'pending' }
  | { status: 'error'; error: string }
  | { status: 'ready'; patch: string }

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

function formatDurationMs(ms: number): string {
  if (!isFinite(ms) || ms < 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  const remS = Math.round(s - m * 60)
  if (m < 60) return remS > 0 ? `${m}m ${remS}s` : `${m}m`
  const h = Math.floor(m / 60)
  const remM = m - h * 60
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`
}

// Collapsible wrapper to cap initial render height of long message content
function CollapsibleContent({
  children,
  maxHeight = 600,
}: {
  children: ReactNode
  maxHeight?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [needsCollapse, setNeedsCollapse] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      setNeedsCollapse(el.scrollHeight > maxHeight + 8)
    }
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [children, maxHeight])

  return (
    <div className="flex flex-col">
      <div
        ref={containerRef}
        style={{
          // Keep expanded content contained within the chat scroller.
          // Using 'visible' can cause content to escape and make the whole app/page scroll.
          maxHeight: expanded ? 'none' : `${maxHeight}px`,
          overflow: expanded ? 'auto' : 'hidden',
        }}
      >
        {children}
      </div>
      {needsCollapse ? (
        <button
          type="button"
          className="btn-secondary self-end mt-2 text-xs"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  )
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
  const { projectId } = useActiveProject()
  const { filesByPath } = useFiles()
  const { getLastReadForKey } = useChatUnread()

  // In-memory preview cache for require_confirmation tool calls (write tools only)
  const [toolPreviewById, setToolPreviewById] = useState<Record<string, ToolPreview>>({})
  const toolPreviewByIdRef = useRef<Record<string, ToolPreview>>({})
  useEffect(() => {
    toolPreviewByIdRef.current = toolPreviewById
  }, [toolPreviewById])

  const enhancedMessages: EnhancedMessage[] = useMemo(() => {
    // O(n) single pass to avoid scanning backwards per message (which becomes O(n^2)).
    const out: EnhancedMessage[] = []
    let lastAssistantModel: any | undefined
    let lastRole: string | undefined

    for (let index = 0; index < messages.length; index++) {
      const m = messages[index]
      const effectiveMessage: EnhancedMessage = { ...m }

      // Tool results are rendered as system messages
      if (m.toolResults?.length) {
        effectiveMessage.completionMessage.role = 'system'
      }

      const role = effectiveMessage.completionMessage.role

      let showModel = false
      if (m.completionMessage.role === 'assistant' && m.model) {
        showModel = !lastAssistantModel || lastAssistantModel !== m.model
        lastAssistantModel = m.model
      }

      const isFirstInGroup = !lastRole || lastRole !== role || role === 'system'
      lastRole = role

      out.push({ ...effectiveMessage, showModel, isFirstInGroup })
    }

    return out
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
      if (last?.completionMessage.role === 'assistant' && !last.error) playReceiveSound()
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
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setIsVisible(entry.isIntersecting)
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
    animationChatChangedRef.current = true
  }, [chatId])

  useEffect(() => {
    if (animationChatChangedRef.current) {
      animationChatChangedRef.current = false
      prevLenForAnimRef.current = messages.length
      setAnimateAssistantIdx(null)
      return
    }
    if (!isVisible) {
      prevLenForAnimRef.current = messages.length
      return
    }
    if (messages.length > prevLenForAnimRef.current) {
      const lastIdx = messages.length - 1
      const lastMsg = messages[lastIdx]
      if (lastMsg && lastMsg.completionMessage.role === 'assistant' && !lastMsg.error)
        setAnimateAssistantIdx(lastIdx)
      else setAnimateAssistantIdx(null)
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
      lastUserSentRef.current = false
    }
    prevLenForUserAnimRef.current = messages.length
  }, [messages])

  // Scrolling behavior
  const isAtBottomRef = useRef<boolean>(true)
  const prevLenForScrollRef = useRef<number>(messages.length)
  const initialScrollTargetRef = useRef<'unread' | 'bottom' | null>(null)

  const NEAR_BOTTOM_PX = 80
  const computeIsNearBottom = (): boolean => {
    const c = messageListRef.current
    if (!c) return true
    return c.scrollTop + c.clientHeight >= c.scrollHeight - NEAR_BOTTOM_PX
  }

  const forceScrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    // Important: do NOT use scrollIntoView() here.
    // It can scroll the wrong ancestor (including the whole app) depending on layout/overflow.
    const c = messageListRef.current
    if (!c) return
    const top = Math.max(0, c.scrollHeight - c.clientHeight)
    c.scrollTo({ top, behavior })
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
      if (atBottom) onReadLatest?.(lastMessageIso(messages))
    }
  }

  // Determine first unread message index for this chat
  const lastReadIso = useMemo(() => {
    return chatId ? getLastReadForKey(chatId) : undefined
  }, [chatId, getLastReadForKey])

  const systemPromptMessage = useMemo(() => {
    return enhancedMessages.length === 1 && enhancedMessages[0].completionMessage.role === 'system'
      ? enhancedMessages[0]
      : undefined
  }, [enhancedMessages])

  const messagesToDisplay = useMemo(() => {
    return systemPromptMessage !== undefined ? enhancedMessages.slice(1) : enhancedMessages
  }, [enhancedMessages, systemPromptMessage])

  // Pre-apply diff preview for confirmation tools (writeFile / writeDiffToFile)
  useEffect(() => {
    if (!projectId) return
    if (!messagesToDisplay.length) return

    const lastMsg = messagesToDisplay[messagesToDisplay.length - 1]
    if (!lastMsg || lastMsg.completionMessage.role !== 'system') return
    const toolResults = lastMsg.toolResults || []
    if (!toolResults.length) return

    for (const tr of toolResults) {
      if (tr.type !== 'require_confirmation') continue
      if (tr.result === undefined || tr.result === null) continue

      const id = String(tr.result)
      if (toolPreviewByIdRef.current[id] !== undefined) continue

      const toolName = String(tr.call?.name || '')

      toolPreviewByIdRef.current = {
        ...toolPreviewByIdRef.current,
        [id]: { status: 'pending' },
      }
      setToolPreviewById((prev) => ({ ...prev, [id]: { status: 'pending' } }))

      const args = (tr.call as any)?.arguments || {}

      ;(async () => {
        try {
          const res = await factoryToolsService.previewTool(projectId, toolName, args)

          if (res && typeof res === 'object' && (res as any).type === 'not_supported') {
            return
          }

          const patch = typeof res === 'string' ? res : JSON.stringify(res, null, 2)
          const ready: ToolPreview = { status: 'ready', patch }
          toolPreviewByIdRef.current = { ...toolPreviewByIdRef.current, [id]: ready }
          setToolPreviewById((prev) => ({ ...prev, [id]: ready }))
        } catch (e: any) {
          const err: ToolPreview = { status: 'error', error: String(e?.message || e) }
          toolPreviewByIdRef.current = { ...toolPreviewByIdRef.current, [id]: err }
          setToolPreviewById((prev) => ({ ...prev, [id]: err }))
        }
      })()
    }
  }, [messagesToDisplay, projectId])

  // Render window: show only the last N messages with a pager to reveal older ones
  const DEFAULT_VISIBLE = 50
  const BATCH_SIZE = 50
  const [visibleCount, setVisibleCount] = useState<number>(DEFAULT_VISIBLE)
  useEffect(() => {
    setVisibleCount(DEFAULT_VISIBLE)
  }, [chatId])
  const totalMessages = messagesToDisplay.length
  const startIndex = Math.max(0, totalMessages - visibleCount)
  const visibleMessages = useMemo(() => {
    return messagesToDisplay.slice(startIndex)
  }, [messagesToDisplay, startIndex])
  const hiddenCountAbove = startIndex

  // Progressive read receipts
  const lastReadIsoRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    lastReadIsoRef.current = lastReadIso
  }, [lastReadIso])

  const latestSeenIsoRef = useRef<string | undefined>(undefined)
  const pendingRafRef = useRef<number | null>(null)

  const flushSeenToRead = useCallback(() => {
    pendingRafRef.current = null
    const iso = latestSeenIsoRef.current
    if (!iso) return
    const lastRead = lastReadIsoRef.current
    if (lastRead && iso.localeCompare(lastRead) <= 0) return
    onReadLatest?.(iso)
  }, [onReadLatest])

  useEffect(() => {
    const container = messageListRef.current
    if (!container) return
    if (!chatId) return
    if (!onReadLatest) return

    latestSeenIsoRef.current = undefined

    const io = new IntersectionObserver(
      (entries) => {
        let sawNew = false
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          if (entry.intersectionRatio < 0.6) continue
          const el = entry.target as HTMLElement
          const role = el.getAttribute('data-msg-role')
          if (role !== 'assistant') continue
          const iso = el.getAttribute('data-msg-iso') || undefined
          if (!iso) continue

          const prev = latestSeenIsoRef.current
          if (!prev || iso.localeCompare(prev) > 0) {
            latestSeenIsoRef.current = iso
            sawNew = true
          }
        }
        if (sawNew) {
          if (pendingRafRef.current) return
          pendingRafRef.current = requestAnimationFrame(flushSeenToRead)
        }
      },
      {
        root: container,
        threshold: [0.6],
      },
    )

    const nodes = container.querySelectorAll('[data-msg-idx]')
    nodes.forEach((n) => io.observe(n))

    return () => {
      io.disconnect()
      if (pendingRafRef.current) {
        cancelAnimationFrame(pendingRafRef.current)
        pendingRafRef.current = null
      }
    }
  }, [chatId, visibleCount, messagesToDisplay.length, onReadLatest, flushSeenToRead])

  const lastMessageIsoMemo = useMemo(() => {
    if (!messagesToDisplay.length) return undefined
    return messageIso(messagesToDisplay[messagesToDisplay.length - 1])
  }, [messagesToDisplay])

  const hasUnreadOnOpen = useMemo(() => {
    if (!messagesToDisplay.length) return false
    if (!lastReadIso) return true
    if (!lastMessageIsoMemo) return false
    return lastMessageIsoMemo.localeCompare(lastReadIso) > 0
  }, [messagesToDisplay, lastReadIso, lastMessageIsoMemo])

  const lastUnreadIndex: number | null = useMemo(() => {
    if (!messagesToDisplay.length) return null
    if (!hasUnreadOnOpen) return null
    if (!lastReadIso) return messagesToDisplay.length - 1
    for (let i = messagesToDisplay.length - 1; i >= 0; i--) {
      const iso = messageIso(messagesToDisplay[i])
      if (iso && iso.localeCompare(lastReadIso) > 0) return i
    }
    return null
  }, [messagesToDisplay, lastReadIso, hasUnreadOnOpen])

  useLayoutEffect(() => {
    const container = messageListRef.current
    if (container && messagesToDisplay.length > 0) {
      if (!hasUnreadOnOpen) {
        forceScrollToBottom('auto')
      } else if (typeof lastUnreadIndex === 'number') {
        const target = container.querySelector(
          `[data-msg-idx='${lastUnreadIndex}']`,
        ) as HTMLElement | null
        if (target) {
          const headroom = Math.floor(container.clientHeight * 0.3)
          const top = Math.max(0, target.offsetTop - headroom)
          container.scrollTo({ top, behavior: 'auto' })
          isAtBottomRef.current = false
          onAtBottomChange?.(false)
        } else {
          forceScrollToBottom('auto')
        }
      } else {
        forceScrollToBottom('auto')
      }
    } else {
      forceScrollToBottom('auto')
    }
    if (isAtBottomRef.current) onReadLatest?.(lastMessageIso(messages))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, messagesToDisplay.length, hasUnreadOnOpen, lastUnreadIndex])

  useEffect(() => {
    const container = messageListRef.current
    if (!container) return

    const prev = prevLenForScrollRef.current
    const increased = messages.length > prev
    prevLenForScrollRef.current = messages.length

    if (!increased) return

    if (isThinking && computeIsNearBottom()) {
      requestAnimationFrame(() => {
        forceScrollToBottom('auto')
        if (isAtBottomRef.current) onReadLatest?.(lastMessageIso(messages))
      })
      return
    }

    const lastNow = messages[messages.length - 1]
    if (lastNow && lastNow.completionMessage.role === 'user') {
      requestAnimationFrame(() => {
        forceScrollToBottom('smooth')
        if (isAtBottomRef.current) onReadLatest?.(lastMessageIso(messages))
      })
      return
    }

    if (!isAtBottomRef.current) return

    requestAnimationFrame(() => {
      const c = messageListRef.current
      if (!c) return
      const revealPadding = 24
      const lastEl = lastMessageRef.current
      let targetTop = c.scrollHeight - c.clientHeight - revealPadding
      if (lastEl) targetTop = lastEl.offsetTop - (c.clientHeight - revealPadding)
      if (targetTop < 0) targetTop = 0
      c.scrollTo({ top: targetTop, behavior: 'smooth' })
      onReadLatest?.(lastMessageIso(messages))
    })
  }, [messages, isThinking, onReadLatest])

  const prevSignalRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (typeof scrollToBottomSignal === 'undefined') return
    if (prevSignalRef.current === undefined) {
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

  useLayoutEffect(() => {
    if (!isThinking) return
    if (computeIsNearBottom()) {
      forceScrollToBottom('auto')
      onReadLatest?.(lastMessageIso(messages))
    }
  }, [isThinking, messages, onReadLatest])

  useEffect(() => {
    const container = messageListRef.current
    if (!container) return

    let resizeRaf: number | null = null
    const onResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(() => {
        if (isAtBottomRef.current) {
          forceScrollToBottom('auto')
          onReadLatest?.(lastMessageIso(messages))
        }
      })
    }

    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const cutoffIndex = useMemo(() => {
    if (
      !numberMessagesToSend ||
      messagesToDisplay.length < numberMessagesToSend ||
      numberMessagesToSend < 1
    ) {
      return null
    }
    const historyCount = numberMessagesToSend - 1
    if (historyCount < 0) return null
    const idx = messagesToDisplay.length - historyCount
    return idx >= 0 ? idx : null
  }, [messagesToDisplay.length, numberMessagesToSend])

  const cutoffIndexInWindow = useMemo(() => {
    if (cutoffIndex === null) return null
    const local = cutoffIndex - startIndex
    return local >= 0 && local < visibleMessages.length ? local : null
  }, [cutoffIndex, startIndex, visibleMessages.length])

  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([])

  useEffect(() => {
    setSelectedToolIds([])
    setToolPreviewById({})
    toolPreviewByIdRef.current = {}
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
                'overflow-y-auto overflow-x-auto max-w-full px-3 py-2 rounded-2xl break-words shadow border',
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
        {hiddenCountAbove > 0 && (
          <div className="relative my-2 flex items-center justify-center">
            <div className="text-xs text-[var(--text-secondary)] bg-[var(--surface-overlay)] border border-[var(--border-subtle)] rounded-full px-3 py-1 shadow">
              {hiddenCountAbove} older message{hiddenCountAbove === 1 ? '' : 's'} hidden
            </div>
            <div className="ml-2 flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary text-xs px-2 py-1"
                onClick={() => setVisibleCount((c) => Math.min(totalMessages, c + BATCH_SIZE))}
              >
                Load more
              </button>
            </div>
          </div>
        )}

        {visibleMessages.map((msg, index) => {
          const globalIndex = startIndex + index

          if (msg.error) {
            const isLast = globalIndex === messagesToDisplay.length - 1
            const showRetry = !!onRetry && isLast
            return (
              <div key={globalIndex} data-msg-idx={globalIndex} className="flex items-start gap-2">
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

          const isSystem = msg.completionMessage.role === 'system'
          const isUser = msg.completionMessage.role === 'user'
          const isAssistant = msg.completionMessage.role === 'assistant'

          const isLast = globalIndex === messagesToDisplay.length - 1

          const isShowingToolCalls =
            isAssistant &&
            (isLast || messagesToDisplay[globalIndex + 1]?.toolResults === undefined) &&
            !!msg.toolCalls?.length
          const isShowingToolResults = isSystem && !!msg.toolResults?.length

          const isNewUserBubble =
            isUser &&
            globalIndex === enhancedMessages.length - 1 &&
            messages.length > prevLenForUserAnimRef.current

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

          const showCutoff = cutoffIndexInWindow !== null && index === cutoffIndexInWindow
          const tooltipText = numberMessagesToSend
            ? `Context cut-off: Messages below this line will be included in the next request. With your settings, your new message and ${numberMessagesToSend - 1} previous messages will be sent.`
            : ''

          const lastMsg = messagesToDisplay[messagesToDisplay.length - 1]
          const lastIsSystemToolResults =
            lastMsg?.completionMessage?.role === 'system' &&
            Array.isArray(lastMsg?.toolResults) &&
            (lastMsg?.toolResults?.length ?? 0) > 0

          const isAssistantBeforeSystemToolResults =
            isAssistant && globalIndex === messagesToDisplay.length - 2 && lastIsSystemToolResults

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
            <div
              key={globalIndex}
              data-msg-idx={globalIndex}
              data-msg-role={msg.completionMessage.role}
              data-msg-iso={messageIso(msg) || ''}
            >
              {showCutoff && (
                <div className="relative text-center my-4 group" title={tooltipText}>
                  <hr className="border-dashed border-neutral-300 dark:border-neutral-700" />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 bg-[var(--surface-base)] text-xs text-neutral-500 whitespace-nowrap">
                    Context from here on
                  </span>
                </div>
              )}

              <div
                ref={isLast ? lastMessageRef : null}
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
                    'max-w-[85%] min-w-0',
                    isUser ? 'items-end' : isSystem ? 'w-full' : 'items-start',
                  ].join(' ')}
                >
                  <div className={['flex-col', isUser ? 'items-start' : 'items-end'].join(' ')}>
                    {(() => {
                      const iso = messageIso(msg)
                      const ts = iso ? formatFriendlyTimestamp(iso) : ''
                      if (isAssistant) {
                        const prev =
                          globalIndex > 0 ? messagesToDisplay[globalIndex - 1] : undefined
                        const prevIso = prev ? messageIso(prev) : undefined
                        let thinkingLabel = ''
                        if (prevIso && iso) {
                          const start = new Date(prevIso).getTime()
                          const end = new Date(iso).getTime()
                          if (!isNaN(start) && !isNaN(end) && end >= start) {
                            thinkingLabel = formatDurationMs(end - start)
                          }
                        }

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
                            {ts || thinkingLabel ? (
                              <div className="text-[10px] leading-4 text-[var(--text-secondary)] mb-1 opacity-80 select-none flex items-baseline gap-1">
                                {thinkingLabel ? <span>{`+${thinkingLabel}`}</span> : null}
                                {thinkingLabel && ts ? <span>·</span> : null}
                                {ts ? <span>{ts}</span> : null}
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
                          'overflow-x-auto max-w-full px-3 py-2 rounded-2xl whitespace-pre-wrap break-words shadow',
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
                          <CollapsibleContent maxHeight={600}>
                            <RichText text={msg.completionMessage.content} />
                          </CollapsibleContent>
                        ) : globalIndex === animateAssistantIdx ? (
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
                            <CollapsibleContent maxHeight={600}>
                              <Markdown text={msg.completionMessage.content} />
                            </CollapsibleContent>
                          )
                        ) : (
                          <CollapsibleContent maxHeight={600}>
                            <Markdown text={msg.completionMessage.content} />
                          </CollapsibleContent>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {isShowingToolCalls && (
                    <div className="mt-2 w-full space-y-2">
                      {msg.toolCalls!.map((call: ToolCall, i: number) => {
                        return (
                          <ToolCallCard
                            key={`tool-${globalIndex}-${i}`}
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

                        const preview =
                          isRequireConfirm && resultId !== undefined && resultId !== null
                            ? toolPreviewById[String(resultId)]
                            : undefined

                        return (
                          <ToolCallCard
                            key={`tool-${globalIndex}-${i}`}
                            toolCall={result.call}
                            result={result.result}
                            previewResult={preview}
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
                            key={`${globalIndex}-att-${i}-${path}`}
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
              <div className="overflow-x-auto max-w-full px-3 py-2 rounded-2xl whitespace-pre-wrap break-words break-all shadow bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-md">
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
