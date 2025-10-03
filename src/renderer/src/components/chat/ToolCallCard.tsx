import React, { useState } from 'react'
import JsonView from '../ui/JsonView'
import { ToolResultNew, ToolResultType } from 'thefactory-tools'
import { IconCheckCircle, IconWarningTriangle, IconXCircle, IconStopCircle } from '../ui/Icons'

function isLargeJson(value: any) {
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value)
    return s.length > 600
  } catch {
    return false
  }
}

function Collapsible({
  title,
  children,
  defaultOpen = false,
  className,
  innerClassName,
}: {
  title: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  innerClassName?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`${className ?? ''} border rounded-md border-[var(--border-subtle)] bg-[var(--surface-overlay)]`}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--surface-raised)]"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xs font-medium truncate pr-2">{title}</span>
        <span className="text-xs text-[var(--text-secondary)]">{open ? '\u2212' : '+'}</span>
      </button>
      {open ? (
        <div className={`${innerClassName ?? ''} border-t border-[var(--border-subtle)]`}>{children}</div>
      ) : null}
    </div>
  )
}

function StatusBadge({ status }: { status?: ToolResultType }) {
  if (!status) return null
  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] border'
  switch (status) {
    case 'success':
      return (
        <span className={`${base} text-green-600 border-green-600 bg-[color-mix(in_srgb,#10B981_10%,transparent)]`}>
          <IconCheckCircle className="w-3 h-3" />
          success
        </span>
      )
    case 'errored':
      return (
        <span className={`${base} text-red-500 border-red-500 bg-[color-mix(in_srgb,#EF4444_10%,transparent)]`}>
          <IconXCircle className="w-3 h-3" />
          errored
        </span>
      )
    case 'aborted':
      return (
        <span className={`${base} text-orange-500 border-orange-500 bg-[color-mix(in_srgb,#F59E0B_10%,transparent)]`}>
          <IconWarningTriangle className="w-3 h-3" />
          aborted
        </span>
      )
    case 'not_allowed':
      return (
        <span className={`${base} text-black border-black bg-[color-mix(in_srgb,black_6%,transparent)] dark:text-white dark:border-neutral-400 dark:bg-[color-mix(in_srgb,white_6%,transparent)]`}>
          <IconStopCircle className="w-3 h-3" />
          not allowed
        </span>
      )
    case 'require_confirmation':
      return (
        <span className={`${base} text-amber-600 border-amber-600 bg-[color-mix(in_srgb,#F59E0B_10%,transparent)]`}>
          <IconWarningTriangle className="w-3 h-3" />
          requires confirmation
        </span>
      )
    default:
      return null
  }
}

export default function ToolCallCard({
  index,
  toolName,
  args,
  result,
  durationMs,
  status,
  selectable,
  selected,
  onToggleSelect,
  disabled,
}: {
  index: number
  toolName: string
  args: any
  result?: ToolResultNew
  durationMs?: number
  status?: ToolResultType
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  disabled?: boolean
}) {
  const isHeavy =
    toolName === 'read_files' ||
    toolName === 'write_file' ||
    isLargeJson(args) ||
    isLargeJson(result)
  const durationText = typeof durationMs === 'number' ? `${(durationMs / 1000).toFixed(2)}s` : undefined

  const statusBorderClass = (() => {
    switch (status) {
      case 'errored':
        return 'border-red-500'
      case 'aborted':
        return 'border-orange-500'
      case 'not_allowed':
        return 'border-black dark:border-neutral-400'
      default:
        return 'border-[var(--border-subtle)]'
    }
  })()

  return (
    <div className={`rounded-md border ${statusBorderClass} bg-[var(--surface-base)]`}>
      <div className="px-3 py-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold truncate">
              {index + 1}. {toolName}
            </div>
            <StatusBadge status={status} />
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">Arguments</div>
        </div>
        <div className="flex items-center gap-2">
          {selectable ? (
            <label className={`inline-flex items-center gap-1 text-xs ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                className="accent-[var(--accent-primary)]"
                checked={!!selected}
                onChange={() => !disabled && onToggleSelect && onToggleSelect()}
                disabled={disabled}
              />
              Allow
            </label>
          ) : null}
          {durationText && (
            <div className="flex-shrink-0 bg-[var(--surface-overlay)] rounded-full px-2 py-0.5 text-xs text-[var(--text-secondary)] whitespace-nowrap border border-[var(--border-subtle)]">
              {durationText}
            </div>
          )}
        </div>
      </div>
      <div className="px-3 pb-2">
        {isHeavy ? (
          <Collapsible title={<span>View arguments</span>}>
            <div className="p-2 max-h-64 overflow-auto bg-[var(--surface-raised)] border-t border-[var(--border-subtle)]">
              <JsonView value={args} />
            </div>
          </Collapsible>
        ) : (
          <div className="rounded bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-2 max-h-60 overflow-auto">
            <JsonView value={args} />
          </div>
        )}
      </div>
      {typeof result !== 'undefined' && (
        <div className="px-3 pb-3">
          <div className="text-[11px] text-[var(--text-secondary)] mb-1">Result</div>
          {isHeavy ? (
            <Collapsible title={<span>View result</span>}>
              <div className="p-2 max-h-72 overflow-auto bg-[var(--surface-raised)] border-t border-[var(--border-subtle)]">
                <JsonView value={result} />
              </div>
            </Collapsible>
          ) : (
            <div className="rounded bg-[var(--surface-raised)] border border-[var(--border-subtle)] p-2 text-xs whitespace-pre-wrap break-words max-h-60 overflow-auto">
              <JsonView value={result} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
