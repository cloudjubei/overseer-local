import {
  IconCheckmarkCircle,
  IconError,
  IconStop,
  IconNotAllowed,
  IconHourglass,
  IconChevron,
} from '../ui/Icons'
import Code from '../ui/Code'
import { useState } from 'react'
import { Switch } from '../ui/Switch'

type ToolResultType = 'require_confirmation' | 'not_allowed' | 'errored' | 'aborted' | 'success'

export type ToolCallCardProps = {
  index: number
  toolName: string
  args: Record<string, unknown>
  result?: {
    type: ToolResultType
    result: string | number | boolean | Record<string, unknown> | Array<unknown>
  }
  durationMs?: number
  status?: ToolResultType
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  disabled?: boolean
}

function StatusIcon({ status }: { status?: ToolResultType }) {
  const size = 'w-4 h-4'
  switch (status) {
    case 'success':
      return <IconCheckmarkCircle className={`${size} text-green-500`} />
    case 'errored':
      return <IconError className={`${size} text-red-500`} />
    case 'aborted':
      return <IconStop className={`${size} text-orange-500`} />
    case 'not_allowed':
      return <IconNotAllowed className={`${size} text-neutral-500`} />
    case 'require_confirmation':
      return <IconHourglass className={`${size} text-teal-500`} />
    default:
      return <IconHourglass className={`${size} text-neutral-500`} />
  }
}

function StatusPill({ status }: { status?: ToolResultType }) {
  if (!status) return null
  const base = 'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full'
  let colors = ''
  switch (status) {
    case 'success':
      colors = 'bg-green-500/20 text-green-600 dark:text-green-400'
      break
    case 'errored':
      colors = 'bg-red-500/20 text-red-600 dark:text-red-400'
      break
    case 'aborted':
      colors = 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
      break
    case 'not_allowed':
      colors = 'bg-neutral-500/20 text-neutral-600 dark:text-neutral-400'
      break
    case 'require_confirmation':
      colors = 'bg-teal-500/20 text-teal-600 dark:text-teal-400'
      break
    default:
      colors = 'bg-neutral-500/20 text-neutral-600 dark:text-neutral-400'
      break
  }
  return <div className={`${base} ${colors}`}>{status.replace('_', ' ')}</div>
}

export default function ToolCallCard({
  toolName,
  args,
  result,
  durationMs,
  status,
  selectable,
  selected,
  onToggleSelect,
}: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const isRequireConfirm = status === 'require_confirmation'

  return (
    <div
      className={[
        'rounded-md border text-sm text-[var(--text-primary)] relative',
        isRequireConfirm
          ? 'bg-teal-500/20 border-teal-600 dark:border-teal-700 dark:bg-teal-800/60'
          : 'border-[var(--border-subtle)] bg-[var(--surface-overlay)]',
      ].join(' ')}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <StatusIcon status={status} />
          <span className="font-semibold">{toolName}</span>
        </div>
        <div className="flex items-center gap-2">
          {durationMs !== undefined && (
            <span className="text-xs text-[var(--text-secondary)]">{durationMs}ms</span>
          )}
          <StatusPill status={status} />
          {selectable && onToggleSelect && (
            <Switch checked={selected} onCheckedChange={onToggleSelect} label="" />
          )}
          <button
            type="button"
            className="btn-icon"
            onClick={() => setIsExpanded((v) => !v)}
            aria-expanded={isExpanded}
          >
            <IconChevron
              className="w-4 h-4 transition-transform"
              style={{ transform: `rotate(${isExpanded ? 0 : -90}deg)` }}
            />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="px-3 pb-2">
          <Code language="json" code={JSON.stringify({ args, result }, null, 2)} />
        </div>
      )}
    </div>
  )
}
