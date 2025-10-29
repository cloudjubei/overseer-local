import React, { useMemo, useState } from 'react'
import type { ToolCall, ToolResultType } from 'thefactory-tools'
import Code from '../ui/Code'
import { Modal } from '../ui/Modal'
import { IconCheckmarkCircle, IconError, IconStop, IconNotAllowed, IconHourglass } from '../ui/icons/Icons'

function StatusIcon({ resultType }: { resultType?: ToolResultType }) {
  const size = 'w-3.5 h-3.5'
  switch (resultType) {
    case 'errored':
      return <IconError className={`${size} text-red-500`} />
    case 'aborted':
      return <IconStop className={`${size} text-orange-500`} />
    case 'not_allowed':
      return <IconNotAllowed className={`${size} text-neutral-500`} />
    case 'require_confirmation':
      return <IconHourglass className={`${size} text-teal-500`} />
    default:
      return <IconCheckmarkCircle className={`${size} text-green-500`} />
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1">{children}</div>
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={['text-xs leading-relaxed', className || ''].join(' ')}>{children}</div>
}

function formatTimestamp(ts?: any): string | undefined {
  if (!ts) return undefined
  try {
    const d = typeof ts === 'string' ? new Date(ts) : new Date(Number(ts))
    if (Number.isNaN(d.getTime())) return undefined
    return d.toLocaleString()
  } catch {
    return undefined
  }
}

function tryString(v: any): string | undefined {
  if (v == null) return undefined
  try {
    if (typeof v === 'string') return v
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function InlineOldNew({ oldVal, newVal }: { oldVal?: string; newVal?: string }) {
  if (!newVal && !oldVal) return null
  return (
    <div className="text-xs">
      <span className="text-[var(--text-secondary)]">Title:</span>{' '}
      {oldVal ? <span className="line-through text-red-600/80 mr-1">{oldVal}</span> : null}
      {oldVal ? <span className="mx-1">→</span> : null}
      {newVal ? <span className="font-semibold text-green-600 dark:text-green-400">{newVal}</span> : null}
    </div>
  )
}

function extract(obj: any, keys: string[]): any | undefined {
  if (!obj) return undefined
  for (const k of keys) {
    const parts = k.split('.')
    let cur: any = obj
    let ok = true
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p]
      else {
        ok = false
        break
      }
    }
    if (ok) return cur
  }
  return undefined
}

function buildUnifiedDiffIfPresent(result: any): string | undefined {
  const raw = extract(result, ['diff', 'patch', 'unifiedDiff'])
  if (typeof raw === 'string' && raw.trim()) return raw
  const oldText = extract(result, ['before.content', 'oldContent', 'previousContent'])
  const newText = extract(result, ['after.content', 'newContent', 'content'])
  // Without a diff library and if either side missing, skip trying to synthesize
  if (typeof oldText === 'string' && typeof newText === 'string') {
    // Minimal fallback: show new content only with header lines indicating unavailability of full diff
    return undefined
  }
  return undefined
}

function HunkedDiff({ diff, maxHunks = 3 }: { diff: string; maxHunks?: number }) {
  const [expanded, setExpanded] = useState(false)
  const hunks = useMemo(() => {
    const lines = diff.split(/\r?\n/)
    const groups: string[] = []
    let current: string[] = []
    for (const ln of lines) {
      if (ln.startsWith('@@')) {
        if (current.length) groups.push(current.join('\n'))
        current = [ln]
      } else {
        current.push(ln)
      }
    }
    if (current.length) groups.push(current.join('\n'))
    return groups
  }, [diff])

  const visible = expanded ? hunks : hunks.slice(0, maxHunks)

  return (
    <div>
      <Code language="diff" code={visible.join('\n\n')} />
      {hunks.length > maxHunks && (
        <button className="btn-link text-[11px] mt-1" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : `View more (${hunks.length - maxHunks} more hunks)`}
        </button>
      )}
    </div>
  )
}

function NewContentOnly({ text }: { text?: string }) {
  if (!text) return (
    <div className="text-xs text-[var(--text-secondary)]">New content only. Diff unavailable.</div>
  )
  return (
    <div>
      <div className="text-xs text-[var(--text-secondary)] mb-1">New content only. Diff unavailable.</div>
      <Code language="" code={text} />
    </div>
  )
}

function ReorderList({ items, movedId }: { items: any[]; movedId?: string }) {
  return (
    <ol className="list-decimal pl-5 text-xs space-y-0.5">
      {items.map((it: any, idx: number) => {
        const id = typeof it === 'string' ? it : it?.id || it?.key || it?.title || String(idx)
        const title = it?.title || id
        const moved = movedId && (it?.id === movedId || id === movedId)
        return (
          <li key={id} className={moved ? 'bg-yellow-200/40 dark:bg-yellow-800/30 rounded px-1' : ''}>
            <span className="text-[11px] text-[var(--text-secondary)] mr-1">{idx + 1}.</span>
            <span className="font-medium">{title}</span>
          </li>
        )
      })}
    </ol>
  )
}

export default function ToolCallChangePopup({
  toolCall,
  result,
  resultType,
  durationMs,
}: {
  toolCall: ToolCall
  result?: any
  resultType?: ToolResultType
  durationMs?: number
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const name = toolCall?.name || 'tool'

  const timestamp = formatTimestamp(result?.completedAt || result?.finishedAt || result?.updatedAt)
  const opId = tryString(result?.id || toolCall?.id || result?.operationId)

  const content = useMemo(() => {
    const args = toolCall?.arguments || {}
    const n = String(name)

    const showViewDetails = (node: React.ReactNode, detailsNode?: React.ReactNode) => {
      return (
        <div>
          {node}
          {detailsNode ? (
            <div className="mt-1">
              <button className="btn-link text-[11px]" onClick={() => setDetailsOpen(true)}>
                View details
              </button>
            </div>
          ) : null}
          {detailsNode ? (
            <Modal isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} title={`${name} details`}>
              <div className="p-3 max-h-[70vh] overflow-auto text-sm">
                {detailsNode}
              </div>
            </Modal>
          ) : null}
        </div>
      )
    }

    if (n === 'update_story_title' || n === 'update_feature_title') {
      const oldVal = tryString(extract(result, ['before.title']) || extract(args, ['oldTitle']))
      const newVal = tryString(extract(result, ['after.title']) || extract(args, ['newTitle']))
      return showViewDetails(<InlineOldNew oldVal={oldVal} newVal={newVal} />)
    }

    if (n === 'update_story_description' || n === 'update_feature_description') {
      const oldDesc = tryString(extract(result, ['before.description']) || extract(args, ['oldDescription']))
      const newDesc = tryString(extract(result, ['after.description']) || extract(args, ['newDescription', 'description']))
      const diff = tryString(extract(result, ['diff', 'patch']))
      const summary = (
        <div className="text-xs">
          {diff ? (
            <Code language="diff" code={diff} />
          ) : oldDesc && newDesc ? (
            <div>
              <SectionTitle>Updated description</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-[var(--text-secondary)] mb-1">Before</div>
                  <Code language="" code={oldDesc} />
                </div>
                <div>
                  <div className="text-[11px] text-[var(--text-secondary)] mb-1">After</div>
                  <Code language="" code={newDesc} />
                </div>
              </div>
            </div>
          ) : (
            <NewContentOnly text={newDesc} />
          )}
        </div>
      )
      return showViewDetails(summary)
    }

    if (n === 'write_file') {
      const path = tryString(extract(args, ['path']) || extract(result, ['path']))
      const diff = buildUnifiedDiffIfPresent(result)
      const newText = tryString(extract(result, ['after.content', 'newContent', 'content']))
      const body = (
        <div className="space-y-1">
          <Row>
            <span className="text-[var(--text-secondary)]">Path:</span>{' '}
            <span className="font-mono text-[11px]">{path || '(unknown)'}</span>
          </Row>
          {diff ? (
            <HunkedDiff diff={diff} />
          ) : (
            <NewContentOnly text={newText} />
          )}
        </div>
      )
      const details = diff ? <Code language="diff" code={diff} /> : newText ? <Code language="" code={newText} /> : undefined
      return showViewDetails(body, details)
    }

    if (n === 'create_feature' || n === 'create_story') {
      const title = tryString(extract(result, ['title']) || extract(args, ['title']))
      const description = tryString(
        extract(result, ['description']) || extract(args, ['description']) || extract(result, ['content']),
      )
      const body = (
        <div>
          <Row>
            <span className="text-[var(--text-secondary)]">Title:</span>{' '}
            <span className="font-semibold">{title || '(untitled)'}</span>
          </Row>
          {description ? (
            <div className="mt-1">
              <SectionTitle>Description</SectionTitle>
              <Code language="" code={description} />
            </div>
          ) : null}
        </div>
      )
      return showViewDetails(body)
    }

    if (n === 'reorder_feature' || n === 'reorder_story' || n === 'reorder_features' || n === 'reorder_stories') {
      const order = (extract(result, ['order']) || extract(result, ['features']) || extract(result, ['stories']) || extract(args, ['order'])) as any[] | undefined
      const movedId = tryString(extract(args, ['movedId']) || extract(result, ['movedId']))
      if (order && Array.isArray(order) && order.length > 0) {
        return showViewDetails(<ReorderList items={order} movedId={movedId} />)
      }
      return showViewDetails(
        <div className="text-xs text-[var(--text-secondary)]">Final order unavailable.</div>,
      )
    }

    // Default: show JSON result preview limited
    const str = (() => {
      try {
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      } catch {
        return String(result)
      }
    })()
    return showViewDetails(
      <div className="max-w-[420px] max-h-60 overflow-auto">
        <Code language="json" code={str || '(no result)'} />
      </div>,
      str ? <Code language="json" code={str} /> : undefined,
    )
  }, [name, toolCall?.arguments, result, detailsOpen])

  const errorBanner = (() => {
    if (!resultType || resultType === 'success' || resultType === 'require_confirmation') return null
    const msg = tryString(extract(result, ['error.message']) || extract(result, ['message']) || extract(result, ['error']) )
    let label = 'Tool status'
    if (resultType === 'errored') label = 'Tool failed'
    else if (resultType === 'aborted') label = 'Tool aborted'
    else if (resultType === 'not_allowed') label = 'Not allowed'
    return (
      <div className="mb-2 text-[11px] rounded border border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-300 px-2 py-1">
        <span className="font-semibold mr-1">{label}.</span>
        {msg ? <span className="font-mono">{msg}</span> : null}
      </div>
    )
  })()

  return (
    <div className="min-w-[260px] max-w-[520px]">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon resultType={resultType} />
          <div className="truncate text-xs font-semibold">{name}</div>
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">
          {durationMs ? <span className="mr-2">{durationMs}ms</span> : null}
          {timestamp ? <span className="mr-2">{timestamp}</span> : null}
          {opId ? <span className="font-mono">{opId}</span> : null}
        </div>
      </div>
      {errorBanner}
      <div className="border-t border-[var(--border-subtle)] pt-1">{content}</div>
    </div>
  )
}
