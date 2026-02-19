import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ChatMessage, ToolCall, ToolResult, ToolResultType } from 'thefactory-tools'
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

    const ro = new ResizeObserver(() => {
      if (!el) return
      setNeedsCollapse(el.scrollHeight > maxHeight + 8)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [maxHeight])

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

export type EnhancedMessage = ChatMessage & {
  showModel?: boolean
  isFirstInGroup?: boolean
}

export type MessageRowProps = {
  msg: EnhancedMessage
  globalIndex: number
  messagesToDisplay: EnhancedMessage[]
  enhancedMessagesTotalLength: number
  isThinking: boolean

  // UI state
  animateAssistantIdx: number | null
  prevLenForUserAnimRef: React.MutableRefObject<number>

  // Tool UI
  onResumeTools?: (toolIds: string[]) => void
  selectedToolIds: string[]
  setSelectedToolIds: React.Dispatch<React.SetStateAction<string[]>>
  toolPreviewById: Record<string, ToolPreview>

  // Actions
  onDeleteLastMessage?: () => void
  onRetry?: () => void

  // Attachments
  filesByPath: Record<string, any>

  // Cutoff marker
  showCutoff: boolean
  tooltipText: string

  // For scroll positioning of the last message
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
  if (msg.error) {
    const isLast = globalIndex === messagesToDisplay.length - 1
    const showRetry = !!onRetry && isLast

    return (
      <div data-msg-idx={globalIndex} className="flex items-start gap-2">
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
    globalIndex === enhancedMessagesTotalLength - 1 &&
    globalIndex >= prevLenForUserAnimRef.current

  const toggleableIds: string[] = (() => {
    if (!(isSystem && isLast)) return []
    const results = msg.toolResults || []
    const ids: string[] = []
    for (const r of results) {
      const t = r.type
      const idVal = r.result
      if (t === 'require_confirmation' && typeof idVal !== 'undefined') ids.push(String(idVal))
    }
    return ids
  })()

  const toggleableCount = toggleableIds.length
  const selectedCount = selectedToolIds.filter((id) => toggleableIds.includes(id)).length
  const allSelected =
    toggleableCount > 0 && toggleableIds.every((id) => selectedToolIds.includes(id))

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

  const iso = messageIso(msg)
  const ts = iso ? formatFriendlyTimestamp(iso) : ''

  const thinkingLabel = useMemo(() => {
    if (!isAssistant) return ''

    const prev = globalIndex > 0 ? messagesToDisplay[globalIndex - 1] : undefined
    const prevIso = prev ? messageIso(prev) : undefined
    if (!prevIso || !iso) return ''

    const start = new Date(prevIso).getTime()
    const end = new Date(iso).getTime()
    if (isNaN(start) || isNaN(end) || end < start) return ''

    return formatDurationMs(end - start)
  }, [globalIndex, isAssistant, iso, messagesToDisplay])

  return (
    <div
      data-msg-idx={globalIndex}
      data-msg-role={msg.completionMessage.role}
      data-msg-iso={iso || ''}
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
        ref={isLast ? setLastMessageRef : undefined}
        className={['flex items-start gap-2', isUser ? 'flex-row-reverse' : 'flex-row'].join(' ')}
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
            {isAssistant ? (
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
            ) : ts ? (
              <div className="text-[10px] leading-4 text-[var(--text-secondary)] mb-1 opacity-80 select-none">
                {ts}
              </div>
            ) : null}

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
                  <TypewriterText text={msg.completionMessage.content} renderer="markdown" />
                ) : isSystem ? (
                  toggleableCount > 0 ? (
                    <div className="text-sm">
                      The assistant wants to run tools. Please grant permission for the tools you
                      want to allow.
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
              {msg.toolCalls!.map((call: ToolCall, i: number) => (
                <ToolCallCard
                  key={`tool-${globalIndex}-${i}`}
                  toolCall={call}
                  selectable={false}
                  disabled={true}
                />
              ))}
            </div>
          )}

          {isShowingToolResults && (
            <div className="mt-2 w-full space-y-2">
              {msg.toolResults!.map((result: ToolResult, i: number) => {
                const resultType = result.type
                const isRequireConfirm = resultType === 'require_confirmation'
                const resultId = result.result
                const selectable = isSystem && isLast && isRequireConfirm && resultId !== undefined
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
}

export default memo(MessageRow)
