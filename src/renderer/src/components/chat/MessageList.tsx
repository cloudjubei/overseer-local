import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFiles } from '../../contexts/FilesContext'
import { playReceiveSound } from '../../assets/sounds'
import type { CompletionMessage, CompletionToolMessage } from 'thefactory-tools'
import { useChatUnread } from '@renderer/hooks/useChatUnread'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { factoryToolsService } from '@renderer/services/factoryToolsService'
import { lastMessageIso, messageIso } from '@renderer/utils/chat'

import SystemPromptBubble from './SystemPromptBubble'
import ThinkingRow from './ThinkingRow'
import MessageRow, { type EnhancedMessage, type ToolPreview } from './MessageRow'

function isToolMessage(msg: any): boolean {
  return !!msg && msg.role === 'tool'
}

function isEmptyAssistantMessage(msg: any): boolean {
  if (!msg || msg.role !== 'assistant') return false
  const c = msg.content
  if (c == null) return true
  if (typeof c !== 'string') return false
  return c.trim().length === 0
}

function MessageListInner({
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
  messages: CompletionMessage[]
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

  const messageListRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const bottomAnchorRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState<boolean>(false)

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

  // In-memory preview cache for require_confirmation tool calls (write tools only)
  const [toolPreviewById, setToolPreviewById] = useState<Record<string, ToolPreview>>({})
  const toolPreviewByIdRef = useRef<Record<string, ToolPreview>>({})
  useEffect(() => {
    toolPreviewByIdRef.current = toolPreviewById
  }, [toolPreviewById])

  const enhancedMessages: EnhancedMessage[] = useMemo(() => {
    const out: EnhancedMessage[] = []
    let lastAssistantModel: any | undefined
    let lastRole: string | undefined

    for (let index = 0; index < messages.length; index++) {
      const m = messages[index] as any
      const effectiveMessage: EnhancedMessage = { ...(m as any) }

      const role = (effectiveMessage as any).role

      let showModel = false
      if (m.role === 'assistant' && (m as any).model) {
        showModel = !lastAssistantModel || lastAssistantModel !== (m as any).model
        lastAssistantModel = (m as any).model
      }

      const isFirstInGroup = !lastRole || lastRole !== role || role === 'system' || role === 'tool'
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
      const last = messages[messages.length - 1] as any
      if (last?.role === 'assistant' && !(last as any).error) playReceiveSound()
    }

    prevCountRef.current = messages.length
  }, [messages, chatId])

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
      const lastMsg = messages[lastIdx] as any
      if (lastMsg && lastMsg.role === 'assistant' && !(lastMsg as any).error)
        setAnimateAssistantIdx(lastIdx)
      else setAnimateAssistantIdx(null)
    }

    prevLenForAnimRef.current = messages.length
  }, [messages, isVisible])

  const prevLenForUserAnimRef = useRef<number>(messages.length)
  useEffect(() => {
    if (animationChatChangedRef.current) {
      prevLenForUserAnimRef.current = messages.length
      return
    }
    prevLenForUserAnimRef.current = messages.length
  }, [messages])

  const isAtBottomRef = useRef<boolean>(true)

  const NEAR_BOTTOM_PX = 80
  const computeIsNearBottom = useCallback((): boolean => {
    const c = messageListRef.current
    if (!c) return true
    return c.scrollTop + c.clientHeight >= c.scrollHeight - NEAR_BOTTOM_PX
  }, [])

  const updateAtBottomState = useCallback(() => {
    const nearBottom = computeIsNearBottom()
    if (nearBottom !== isAtBottomRef.current) {
      isAtBottomRef.current = nearBottom
      onAtBottomChange?.(nearBottom)
      if (nearBottom) onReadLatest?.(lastMessageIso(messages as any))
    }
  }, [computeIsNearBottom, messages, onAtBottomChange, onReadLatest])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const c = messageListRef.current
    if (!c) return
    const top = Math.max(0, c.scrollHeight - c.clientHeight)
    c.scrollTo({ top, behavior })
  }, [])

  const handleScroll: React.UIEventHandler<HTMLDivElement> = (_e) => {
    updateAtBottomState()
  }

  const lastReadIso = useMemo(() => {
    return chatId ? getLastReadForKey(chatId) : undefined
  }, [chatId, getLastReadForKey])

  const systemPromptMessage = useMemo(() => {
    return enhancedMessages.length === 1 && (enhancedMessages[0] as any).role === 'system'
      ? enhancedMessages[0]
      : undefined
  }, [enhancedMessages])

  const messagesToDisplay = useMemo(() => {
    return systemPromptMessage !== undefined ? enhancedMessages.slice(1) : enhancedMessages
  }, [enhancedMessages, systemPromptMessage])

  // Pre-apply diff preview for confirmation tools
  useEffect(() => {
    if (!projectId) return
    if (!messagesToDisplay.length) return

    // Find pending tail: contiguous tool messages at the end that require confirmation
    let end = messagesToDisplay.length - 1
    while (end >= 0 && (messagesToDisplay[end] as any).role !== 'tool') end--
    if (end < 0) return

    let start = end
    while (
      start >= 0 &&
      messagesToDisplay[start].role === 'tool' &&
      (messagesToDisplay[start] as CompletionToolMessage).toolResult.type === 'require_confirmation'
    ) {
      start--
    }
    start = start + 1
    if (start > end) return

    const pendingTools = messagesToDisplay.slice(start, end + 1) as any[]

    for (const tm of pendingTools) {
      const toolCallId = String(tm.toolCall?.toolCallId || '')
      if (!toolCallId) continue
      if (toolPreviewByIdRef.current[toolCallId] !== undefined) continue

      const toolName = String(tm.toolCall?.name || '')
      if (!toolName) continue

      toolPreviewByIdRef.current = {
        ...toolPreviewByIdRef.current,
        [toolCallId]: { status: 'pending' },
      }
      setToolPreviewById((prev) => ({ ...prev, [toolCallId]: { status: 'pending' } }))

      const args = tm.toolCall?.arguments || {}

      ;(async () => {
        try {
          const res = await factoryToolsService.previewTool(projectId, toolName, args)
          if (res && typeof res === 'object' && (res as any).type === 'not_supported') return

          const patch = typeof res === 'string' ? res : JSON.stringify(res, null, 2)
          const ready: ToolPreview = { status: 'ready', patch }
          toolPreviewByIdRef.current = { ...toolPreviewByIdRef.current, [toolCallId]: ready }
          setToolPreviewById((prev) => ({ ...prev, [toolCallId]: ready }))
        } catch (e: any) {
          const err: ToolPreview = { status: 'error', error: String(e?.message || e) }
          toolPreviewByIdRef.current = { ...toolPreviewByIdRef.current, [toolCallId]: err }
          setToolPreviewById((prev) => ({ ...prev, [toolCallId]: err }))
        }
      })()
    }
  }, [messagesToDisplay, projectId])

  const DEFAULT_VISIBLE = 50
  const BATCH_SIZE = 50
  const [visibleCount, setVisibleCount] = useState<number>(DEFAULT_VISIBLE)
  useEffect(() => {
    setVisibleCount(DEFAULT_VISIBLE)
  }, [chatId])

  const totalMessages = messagesToDisplay.length
  const startIndex = Math.max(0, totalMessages - visibleCount)
  const visibleMessages = useMemo(
    () => messagesToDisplay.slice(startIndex),
    [messagesToDisplay, startIndex],
  )
  const hiddenCountAbove = startIndex

  // Progressive read receipts (assistant role only)
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
      { root: container, threshold: [0.6] },
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
    return messageIso(messagesToDisplay[messagesToDisplay.length - 1] as any)
  }, [messagesToDisplay])

  const hasUnreadOnOpen = useMemo(() => {
    if (!lastReadIso) return false
    if (!messagesToDisplay.length) return false
    if (!lastMessageIsoMemo) return false
    return lastMessageIsoMemo.localeCompare(lastReadIso) > 0
  }, [messagesToDisplay.length, lastReadIso, lastMessageIsoMemo])

  const lastUnreadIndex: number | null = useMemo(() => {
    if (!messagesToDisplay.length) return null
    if (!hasUnreadOnOpen) return null
    if (!lastReadIso) return null
    for (let i = messagesToDisplay.length - 1; i >= 0; i--) {
      const iso = messageIso(messagesToDisplay[i] as any)
      if (iso && iso.localeCompare(lastReadIso) > 0) return i
    }
    return null
  }, [messagesToDisplay, lastReadIso, hasUnreadOnOpen])

  const initialPositionedChatIdRef = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    const container = messageListRef.current
    if (!container) return

    if (chatId && initialPositionedChatIdRef.current === chatId) return
    initialPositionedChatIdRef.current = chatId

    const openAtBottom = () => {
      scrollToBottom('auto')
      updateAtBottomState()
    }

    if (!messagesToDisplay.length) return openAtBottom()
    if (!lastReadIso) return openAtBottom()
    if (!hasUnreadOnOpen) return openAtBottom()

    if (typeof lastUnreadIndex === 'number') {
      const target = container.querySelector(
        `[data-msg-idx='${lastUnreadIndex}']`,
      ) as HTMLElement | null
      if (target) {
        const headroom = Math.floor(container.clientHeight * 0.3)
        const top = Math.max(0, target.offsetTop - headroom)
        container.scrollTo({ top, behavior: 'auto' })
        updateAtBottomState()
        return
      }
    }

    openAtBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  useEffect(() => {
    const container = messageListRef.current
    const content = contentRef.current
    if (!container || !content) return

    const ro = new ResizeObserver(() => {
      if (!computeIsNearBottom()) return
      scrollToBottom('auto')
      updateAtBottomState()
    })

    ro.observe(content)
    return () => ro.disconnect()
  }, [computeIsNearBottom, scrollToBottom, updateAtBottomState])

  const prevLenForScrollRef = useRef<number>(messages.length)
  const lastMessageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = messageListRef.current
    if (!container) return

    const prev = prevLenForScrollRef.current
    const increased = messages.length > prev
    prevLenForScrollRef.current = messages.length
    if (!increased) return

    if (!computeIsNearBottom()) {
      updateAtBottomState()
      return
    }

    if (isThinking) {
      requestAnimationFrame(() => {
        scrollToBottom('auto')
        updateAtBottomState()
      })
      return
    }

    const lastNow = messages[messages.length - 1] as any
    if (lastNow && lastNow.role === 'user') {
      requestAnimationFrame(() => {
        scrollToBottom('smooth')
        updateAtBottomState()
      })
      return
    }

    requestAnimationFrame(() => {
      const c = messageListRef.current
      if (!c) return
      if (!computeIsNearBottom()) {
        updateAtBottomState()
        return
      }
      const revealPadding = 24
      const lastEl = lastMessageRef.current
      let targetTop = c.scrollHeight - c.clientHeight - revealPadding
      if (lastEl) targetTop = lastEl.offsetTop - (c.clientHeight - revealPadding)
      if (targetTop < 0) targetTop = 0
      c.scrollTo({ top: targetTop, behavior: 'smooth' })
      updateAtBottomState()
    })
  }, [messages, isThinking, scrollToBottom, computeIsNearBottom, updateAtBottomState])

  const prevSignalRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (typeof scrollToBottomSignal === 'undefined') return

    if (prevSignalRef.current === undefined) {
      prevSignalRef.current = scrollToBottomSignal
      return
    }

    if (scrollToBottomSignal !== prevSignalRef.current) {
      prevSignalRef.current = scrollToBottomSignal

      if (!computeIsNearBottom()) {
        updateAtBottomState()
        return
      }

      requestAnimationFrame(() => {
        scrollToBottom('smooth')
        updateAtBottomState()
      })
    }
  }, [scrollToBottomSignal, scrollToBottom, computeIsNearBottom, updateAtBottomState])

  useLayoutEffect(() => {
    if (!isThinking) return
    if (!computeIsNearBottom()) {
      updateAtBottomState()
      return
    }
    scrollToBottom('auto')
    updateAtBottomState()
  }, [isThinking, scrollToBottom, computeIsNearBottom, updateAtBottomState])

  useEffect(() => {
    const container = messageListRef.current
    if (!container) return

    let resizeRaf: number | null = null
    const onResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      resizeRaf = requestAnimationFrame(() => {
        if (!computeIsNearBottom()) {
          updateAtBottomState()
          return
        }
        scrollToBottom('auto')
        updateAtBottomState()
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
    if (!numberMessagesToSend || numberMessagesToSend < 1) return null
    const totalMessages = messagesToDisplay.length
    if (totalMessages <= numberMessagesToSend) return null

    let totalCount = 0
    let logicalCount = 0
    let isInGroup = false
    for (let i = totalMessages - 1; i > 0; i--) {
      const m = messagesToDisplay[i]
      if (!(isToolMessage(m) || isEmptyAssistantMessage(m))) {
        if (logicalCount >= numberMessagesToSend) break
        isInGroup = false
        logicalCount++
      } else {
        if (!isInGroup) {
          if (logicalCount >= numberMessagesToSend) break
          logicalCount++
        }
        isInGroup = true
      }
      totalCount++
    }
    return totalMessages - totalCount
  }, [messagesToDisplay, numberMessagesToSend])

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
      {systemPromptMessage ? (
        <SystemPromptBubble message={systemPromptMessage as any} maxHeight={systemMaxHeight} />
      ) : null}

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

      <div ref={contentRef} className="mx-auto max-w-[960px] space-y-3">
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

          const showCutoff = cutoffIndexInWindow !== null && index === cutoffIndexInWindow
          const tooltipText = numberMessagesToSend
            ? `Context cut-off: Messages below this line will be included in the next request. With your settings, your new message and ${numberMessagesToSend - 1} previous messages will be sent.`
            : ''

          return (
            <MessageRow
              key={globalIndex}
              msg={msg as any}
              globalIndex={globalIndex}
              messagesToDisplay={messagesToDisplay as any}
              enhancedMessagesTotalLength={enhancedMessages.length}
              isThinking={isThinking}
              animateAssistantIdx={animateAssistantIdx}
              prevLenForUserAnimRef={prevLenForUserAnimRef}
              onResumeTools={onResumeTools}
              selectedToolIds={selectedToolIds}
              setSelectedToolIds={setSelectedToolIds}
              toolPreviewById={toolPreviewById}
              onDeleteLastMessage={onDeleteLastMessage}
              onRetry={onRetry}
              filesByPath={filesByPath}
              showCutoff={showCutoff}
              tooltipText={tooltipText}
              setLastMessageRef={(el) => {
                lastMessageRef.current = el
              }}
            />
          )
        })}

        {isThinking && <ThinkingRow />}
      </div>

      <div ref={bottomAnchorRef} />
    </div>
  )
}

export default React.memo(MessageListInner)
