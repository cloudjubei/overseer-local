import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { CompletionMessage, CompletionToolMessage, ToolResultType } from 'thefactory-tools'
import { inferFileType } from 'thefactory-tools/utils'

import ErrorBubble from '../ui/ErrorBubble'
import FileDisplay from '../ui/FileDisplay'
import RichText from '../ui/RichText'
import TypewriterText from '../ui/TypewriterText'
import Markdown from '../ui/Markdown'
import ToolCallCard from './ToolCallCard'

import { IconToolbox, IconDelete, IconRefresh } from '../ui/icons/Icons'
import { Switch } from '../ui/Switch'

import { messageIso } from '@renderer/utils/chat'
import { formatDurationMs, formatFriendlyTimestamp } from '@renderer/utils/time'

export type ToolPreview =
  | { status: 'pending' }
  | { status: 'error'; error: string }
  | { status: 'ready'; patch: string }

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

    const ro = new ResizeObserver(() => {
      if (!el) return
      setNeedsCollapse(el.scrollHeight > maxHeight + 8)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxHeight])

  return (
    <div className='flex flex-col'>
      <div
        ref={containerRef}
        style={{
          maxHeight: expanded ? 'none' : `${maxHeight}px`,
          overflow: expanded ? 'auto' : 'hidden',
        }}
      >
        {children}
      </div>
      {needsCollapse ? (
        <button
          type='button'
          className='btn-secondary self-end mt-2 text-xs'
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  )
}

export type EnhancedMessage = CompletionMessage & {
  showModel?: boolean
  isFirstInGroup?: boolean
}

export type MessageRowProps = {
  msg: EnhancedMessage
  globalIndex: number
  messagesToDisplay: EnhancedMessage[]
  enhancedMessagesTotalLength: number
  isThinking: boolean

  animateAssistantIdx: number | null
  prevLenForUserAnimRef: React.MutableRefObject<number>

  onResumeTools?: (toolIds: string[]) => void
  selectedToolIds: string[]
  setSelectedToolIds: React.Dispatch<React.SetStateAction<string[]>>
  toolPreviewById: Record<string, ToolPreview>

  onDeleteLastMessage?: () => void
  onRetry?: () => void

  filesByPath: Record<string, any>

  showCutoff: boolean
  tooltipText: string

  setLastMessageRef?: (el: HTMLDivElement | null) => void
}

function MessageRow({
  msg,
  globalIndex,
  messagesToDisplay,
  enhancedMessagesTotalLength,
  isThinking,
  animateAssistantIdx,
  prevLenForUserAnimRef,
  onResumeTools,
  selectedToolIds,
  setSelectedToolIds,
  toolPreviewById,
  onDeleteLastMessage,
  onRetry,
  filesByPath,
  showCutoff,
  tooltipText,
  setLastMessageRef,
}: MessageRowProps) {
  const role = (msg as any).role

  if ((msg as any).error) {
    const isLast = globalIndex === messagesToDisplay.length - 1
    const showRetry = !!onRetry && isLast

    return (
      <div data-msg-idx={globalIndex} className='flex items-start gap-2'>
        <div
          className='shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
          aria-hidden='true'
        >
          AI
        </div>
        <div className='flex-1 max-w-[72%] min-w-[80px] flex flex-col items-start w-full'>
          <ErrorBubble error={(msg as any).error} />
        </div>
        {showRetry ? (
          <button
            onClick={() => onRetry?.()}
            disabled={isThinking}
            className='btn-icon'
            aria-label='Retry the last action'
            title={isThinking ? 'Please wait...' : 'Retry the last action'}
          >
            <IconRefresh className='w-5 h-5 mt-4' />
          </button>
        ) : null}
      </div>
    )
  }

  const isSystem = role === 'system'
  const isUser = role === 'user'
  const isAssistant = role === 'assistant'
  const isTool = role === 'tool'

  const isLast = globalIndex === messagesToDisplay.length - 1

  const isNewUserBubble =
    isUser &&
    globalIndex === enhancedMessagesTotalLength - 1 &&
    globalIndex >= prevLenForUserAnimRef.current

  // Compute last contiguous tail of require_confirmation tool messages.
  const pendingTail = useMemo(() => {
    const msgs = messagesToDisplay as any[]
    let end = msgs.length - 1
    while (end >= 0 && msgs[end]?.role !== 'tool') end--
    if (end < 0) return { start: -1, end: -1, ids: [] as string[] }
    let start = end
    while (start >= 0 && msgs[start]?.role === 'tool' && msgs[start]?.toolResult?.type === 'require_confirmation') {
      start--
    }
    start = start + 1
    if (start > end) return { start: -1, end: -1, ids: [] as string[] }
    const ids: string[] = []
    for (let i = start; i <= end; i++) {
      const id = String(msgs[i]?.toolCall?.toolCallId || '')
      if (id) ids.push(id)
    }
    return { start, end, ids }
  }, [messagesToDisplay])

  const toggleableIds = pendingTail.ids
  const toggleableCount = toggleableIds.length
  const selectedCount = selectedToolIds.filter((id) => toggleableIds.includes(id)).length
  const allSelected = toggleableCount > 0 && toggleableIds.every((id) => selectedToolIds.includes(id))

  // delete button logic: allow delete on last message, and on assistant preceding a tool tail
  const isAssistantBeforeToolTail =
    isAssistant &&
    toggleableCount > 0 &&
    globalIndex === pendingTail.start - 1

  const shouldShowDelete =
    !!onDeleteLastMessage &&
    (isLast || isAssistantBeforeToolTail)

  const deleteTitle = isAssistantBeforeToolTail
    ? 'Delete last assistant message and tool messages'
    : 'Delete last message'

  const iso = messageIso(msg as any)
  const ts = iso ? formatFriendlyTimestamp(iso) : ''

  const thinkingLabel = useMemo(() => {
    if (!isAssistant) return ''

    const prev = globalIndex > 0 ? messagesToDisplay[globalIndex - 1] : undefined
    const prevIso = prev ? messageIso(prev as any) : undefined
    if (!prevIso || !iso) return ''

    const start = new Date(prevIso).getTime()
    const end = new Date(iso).getTime()
    if (isNaN(start) || isNaN(end) || end < start) return ''

    return formatDurationMs(end - start)
  }, [globalIndex, isAssistant, iso, messagesToDisplay])

  return (
    <div data-msg-idx={globalIndex} data-msg-role={role} data-msg-iso={iso || ''}>
      {showCutoff && (
        <div className='relative text-center my-4 group' title={tooltipText}>
          <hr className='border-dashed border-neutral-300 dark:border-neutral-700' />
          <span className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 bg-[var(--surface-base)] text-xs text-neutral-500 whitespace-nowrap'>
            Context from here on
          </span>
        </div>
      )}

      <div
        ref={isLast ? setLastMessageRef : undefined}
        className={['flex items-start gap-2', isUser ? 'flex-row-reverse' : 'flex-row'].join(' ')}
      >
        <div className='flex flex-col items-center group'>
          <div
            className={[
              'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold',
              isUser
                ? 'bg-[var(--accent-primary)] text-[var(--text-inverted)]'
                : isSystem
                  ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  : isTool
                    ? 'bg-[var(--surface-overlay)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                    : 'bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)] text-[var(--text-primary)] border border-[var(--border-subtle)]',
            ].join(' ')}
            aria-hidden='true'
          >
            {isUser ? 'You' : isSystem || isTool ? <IconToolbox /> : 'AI'}
          </div>

          {shouldShowDelete ? (
            <button
              type='button'
              title={deleteTitle}
              aria-label={deleteTitle}
              className={[
                'mt-1 transition-opacity opacity-0 group-hover:opacity-100',
                'btn-secondary btn-icon w-6 h-6',
              ].join(' ')}
              onClick={() => onDeleteLastMessage && onDeleteLastMessage()}
              disabled={isThinking}
            >
              <IconDelete className='w-3.5 h-3.5' />
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
            {isAssistant ? (
              <div className='w-full flex justify-between items-baseline'>
                {(msg as any).showModel && (msg as any).model ? (
                  <div className='text-[11px] text-[var(--text-secondary)] mb-1 inline-flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--surface-overlay)] rounded-full px-2 py-[2px]'>
                    <span className='inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]' />
                    {(msg as any).model.model}
                  </div>
                ) : (
                  <div />
                )}
                {ts || thinkingLabel ? (
                  <div className='text-[10px] leading-4 text-[var(--text-secondary)] mb-1 opacity-80 select-none flex items-baseline gap-1'>
                    {thinkingLabel ? <span>{`+${thinkingLabel}`}</span> : null}
                    {thinkingLabel && ts ? <span>·</span> : null}
                    {ts ? <span>{ts}</span> : null}
                  </div>
                ) : null}
              </div>
            ) : ts ? (
              <div className='text-[10px] leading-4 text-[var(--text-secondary)] mb-1 opacity-80 select-none'>
                {ts}
              </div>
            ) : null}

            {((msg as any).content && !isTool) || (isSystem && toggleableCount > 0) ? (
              <div
                className={[
                  'overflow-x-auto max-w-full px-3 py-2 rounded-2xl whitespace-pre-wrap break-words shadow',
                  isUser
                    ? 'bg-[var(--accent-primary)] text-[var(--text-inverted)] rounded-br-md'
                    : isSystem
                      ? 'border bg-[var(--surface-overlay)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                      : 'bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-md',
                  (msg as any).isFirstInGroup ? '' : isUser ? 'rounded-tr-md' : 'rounded-tl-md',
                  'chat-bubble',
                  isNewUserBubble ? 'chat-bubble--user-pop-enter' : '',
                ].join(' ')}
              >
                {isUser ? (
                  <CollapsibleContent maxHeight={600}>
                    <RichText text={String((msg as any).content || '')} />
                  </CollapsibleContent>
                ) : globalIndex === animateAssistantIdx ? (
                  <TypewriterText text={String((msg as any).content || '')} renderer='markdown' />
                ) : isSystem ? (
                  <CollapsibleContent maxHeight={600}>
                    <Markdown text={String((msg as any).content || '')} />
                  </CollapsibleContent>
                ) : (
                  <CollapsibleContent maxHeight={600}>
                    <Markdown text={String((msg as any).content || '')} />
                  </CollapsibleContent>
                )}
              </div>
            ) : null}
          </div>

          {/* Tool message rendering */}
          {isTool ? (
            <div className='mt-2 w-full space-y-2'>
              <ToolCallCard
                toolCall={(msg as unknown as CompletionToolMessage).toolCall}
                result={(msg as unknown as CompletionToolMessage).toolResult?.result}
                resultType={(msg as unknown as CompletionToolMessage).toolResult?.type as ToolResultType}
                durationMs={(msg as unknown as CompletionToolMessage).toolResult?.durationMs}
                previewResult={
                  toolPreviewById[
                    String((msg as unknown as CompletionToolMessage).toolCall?.toolCallId || '')
                  ]
                }
                selectable={
                  isLast &&
                  (msg as any).toolResult?.type === 'require_confirmation' &&
                  toggleableIds.includes(String((msg as any).toolCall?.toolCallId || ''))
                }
                selected={selectedToolIds.includes(String((msg as any).toolCall?.toolCallId || ''))}
                onToggleSelect={() => {
                  const id = String((msg as any).toolCall?.toolCallId || '')
                  if (!id) return
                  setSelectedToolIds((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                  )
                }}
                disabled={!(isLast && (msg as any).toolResult?.type === 'require_confirmation')}
              />

              {/* Resume controls shown at the end of the pending batch */}
              {toggleableCount > 0 && isLast ? (
                <div className='pt-1 flex items-center justify-between'>
                  {toggleableCount > 1 ? (
                    <div className='flex items-center gap-2 text:[12px] text-[var(--text-secondary)]'>
                      <span>Toggle all</span>
                      <Switch
                        checked={allSelected}
                        onCheckedChange={(checked) => {
                          setSelectedToolIds((prev) => {
                            if (checked) {
                              const set = new Set([...prev, ...toggleableIds])
                              return Array.from(set)
                            }
                            return prev.filter((id) => !toggleableIds.includes(id))
                          })
                        }}
                      />
                    </div>
                  ) : (
                    <div />
                  )}
                  <button
                    type='button'
                    className={[
                      'btn',
                      selectedCount > 0
                        ? 'bg-green-600 hover:bg-green-700 text-white border-transparent'
                        : 'bg-[var(--surface-overlay)] text-[var(--text-secondary)] border border-[var(--border-subtle)] cursor-not-allowed opacity-70',
                    ].join(' ')}
                    disabled={selectedCount === 0 || !onResumeTools}
                    onClick={() => {
                      if (!onResumeTools) return
                      const validSelected = selectedToolIds.filter((id) => toggleableIds.includes(id))
                      onResumeTools(validSelected)
                    }}
                  >
                    {`Resume ${selectedCount}/${toggleableCount} Tools`}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Attachments */}
          {(msg as any).role === 'user' && (msg as any).files && (msg as any).files.length > 0 ? (
            <div
              className={['mt-1 flex flex-wrap gap-1', isUser ? 'justify-end' : 'justify-start'].join(' ')}
            >
              {(msg as any).files.map((path: string, i: number) => {
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
                    density='compact'
                    interactive
                    showPreviewOnHover
                  />
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default memo(MessageRow)
