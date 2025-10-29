import React, { useMemo } from 'react'
import type { ToolCall, ToolResultType } from 'thefactory-tools'
import Code from '../ui/Code'
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
  if (!result) return undefined
  const raw =
    extract(result, ['diff']) ||
    extract(result, ['patch']) ||
    extract(result, ['unifiedDiff']) ||
    extract(result, ['result.patch']) ||
    extract(result, ['result.diff'])
  if (typeof raw === 'string' && raw.trim()) return raw
  // Some backends might wrap diff under { diff: { patch: string } }
  const nestedPatch = extract(result, ['diff.patch'])
  if (typeof nestedPatch === 'string' && nestedPatch.trim()) return nestedPatch
  return undefined
}

function isCompletelyNewFile(result: any, diff?: string): boolean {
  const before = extract(result, ['before', 'old', 'previous'])
  const after = extract(result, ['after', 'new'])
  if (!before && after) return true
  const isNewFlag = !!(extract(result, ['isNew']) || extract(result, ['newFile']))
  if (isNewFlag) return true
  if (typeof diff === 'string') {
    const lower = diff.toLowerCase()
    if (lower.includes('new file mode') || lower.includes('--- /dev/null')) return true
  }
  return false
}

function HunkedDiff({ diff, maxHunks = 3 }: { diff: string; maxHunks?: number }) {
  const [expanded, setExpanded] = React.useState(false)
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

function NewContentOnly({ text, label }: { text?: string; label?: string }) {
  const header = label || 'New content only. Diff unavailable.'
  if (!text) return <div className="text-xs text-[var(--text-secondary)]">{header}</div>
  return (
    <div>
      <div className="text-xs text-[var(--text-secondary)] mb-1">{header}</div>
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
  const name = toolCall?.name || 'tool'

  const timestamp = formatTimestamp(result?.completedAt || result?.finishedAt || result?.updatedAt)
  const opId = tryString(result?.id || toolCall?.id || result?.operationId)

  function errorContentOnly(): React.ReactNode {
    const msg = tryString(
      extract(result, ['error.message']) || extract(result, ['message']) || extract(result, ['error']),
    )
    const label = resultType === 'errored' ? 'Tool failed' : resultType === 'aborted' ? 'Tool aborted' : 'Tool status'
    return (
      <div className="text-[11px] rounded border border-red-600/40 bg-red-500/10 text-red-700 dark:text-red-300 px-2 py-1">
        <span className="font-semibold mr-1">{label}.</span>
        {msg ? <span className="font-mono">{msg}</span> : null}
      </div>
    )
  }

  const content = useMemo(() => {
    const args = toolCall?.arguments || {}
    const n = String(name)

    // If errored: show only error state, nothing else.
    if (resultType === 'errored') {
      return errorContentOnly()
    }

    if (n === 'update_story_title' || n === 'update_feature_title') {
      const oldVal = tryString(extract(result, ['before.title']) || extract(args, ['oldTitle']))
      const newVal = tryString(extract(result, ['after.title']) || extract(args, ['newTitle']))
      return <InlineOldNew oldVal={oldVal} newVal={newVal} />
    }

    if (n === 'update_story_description' || n === 'update_feature_description') {
      const oldDesc = tryString(extract(result, ['before.description']) || extract(args, ['oldDescription']))
      const newDesc = tryString(extract(result, ['after.description']) || extract(args, ['newDescription', 'description']))
      const diff = tryString(extract(result, ['diff', 'patch']))
      return (
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
    }

    if (n === 'write_file') {
      const path = tryString(extract(args, ['path']) || extract(result, ['path']))
      const diff = buildUnifiedDiffIfPresent(result)
      const newText = tryString(extract(result, ['after.content', 'newContent', 'content']))
      const isNew = isCompletelyNewFile(result, diff)
      return (
        <div className="space-y-1">
          <Row>
            <span className="text-[var(--text-secondary)]">Path:</span>{' '}
            <span className="font-mono text-[11px]">{path || '(unknown)'}</span>
          </Row>
          {isNew ? (
            <NewContentOnly text={newText} label="File completely new." />
          ) : diff ? (
            <HunkedDiff diff={diff} />
          ) : (
            <NewContentOnly text={newText} />
          )}
        </div>
      )
    }

    if (n === 'create_feature' || n === 'create_story') {
      const title = tryString(extract(result, ['title']) || extract(args, ['title']))
      const description = tryString(
        extract(result, ['description']) || extract(args, ['description']) || extract(result, ['content']),
      )
      return (
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
    }

    if (n === 'reorder_feature' || n === 'reorder_story' || n === 'reorder_features' || n === 'reorder_stories') {
      const order = (extract(result, ['order']) || extract(result, ['features']) || extract(result, ['stories']) || extract(args, ['order'])) as any[] | undefined
      const movedId = tryString(extract(args, ['movedId']) || extract(result, ['movedId']))
      if (order && Array.isArray(order) && order.length > 0) {
        return <ReorderList items={order} movedId={movedId} />
      }
      return <div className="text-xs text-[var(--text-secondary)]">Final order unavailable.</div>
    }

    if (n === 'search_files') {
      const query = tryString(extract(args, ['query']) || extract(result, ['query']))
      return (
        <div className="text-xs">
          <Row>
            <span className="text-[var(--text-secondary)]">Query:</span>{' '}
            <span className="font-mono">{query || '(empty query)'}</span>
          </Row>
        </div>
      )
    }

    if (n === 'run_test' || n === 'run_tests') {
      // Summarize results similarly to Tests view: show counts and duration only
      const stats = extract(result, ['summary']) || extract(result, ['stats']) || result || {}
      const passed = extract(stats, ['passed', 'pass', 'passes']) || 0
      const failed = extract(stats, ['failed', 'failures', 'fails']) || 0
      const skipped = extract(stats, ['skipped', 'pending', 'todo']) || 0
      const total = extract(stats, ['total']) || (Number(passed) + Number(failed) + Number(skipped)) || undefined
      const duration = extract(result, ['durationMs']) || extract(stats, ['durationMs', 'duration']) || undefined
      return (
        <div className="text-xs">
          <div className="flex items-center gap-2">
            <span className="text-green-700 dark:text-green-300 font-medium">{Number(passed)} passed</span>
            <span className="text-red-700 dark:text-red-300 font-medium">{Number(failed)} failed</span>
            {typeof skipped === 'number' ? (
              <span className="text-neutral-600 dark:text-neutral-400">{Number(skipped)} skipped</span>
            ) : null}
            {typeof total === 'number' ? (
              <span className="text-neutral-600 dark:text-neutral-400">{Number(total)} total</span>
            ) : null}
            {duration ? (
              <span className="text-neutral-600 dark:text-neutral-400">{Number(duration)}ms</span>
            ) : null}
          </div>
        </div>
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
    return (
      <div className="max-w-[420px] max-h-60 overflow-auto">
        <Code language="json" code={str || '(no result)'} />
      </div>
    )
  }, [name, toolCall?.arguments, result, resultType])

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
      <div className="border-t border-[var(--border-subtle)] pt-1">{content}</div>
    </div>
  )
}
