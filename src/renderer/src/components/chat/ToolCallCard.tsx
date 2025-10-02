import React, { useState } from 'react'
import JsonView from '../ui/JsonView'
import { ToolResultNew } from 'thefactory-tools'

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
    <div
      className={`${className ?? ''} border rounded-md border-[var(--border-subtle)] bg-[var(--surface-overlay)]`}
    >
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--surface-raised)]"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xs font-medium truncate pr-2">{title}</span>
        <span className="text-xs text-[var(--text-secondary)]">{open ? '\u2212' : '+'}</span>
      </button>
      {open ? (
        <div className={`${innerClassName ?? ''} border-t border-[var(--border-subtle)]`}>
          {children}
        </div>
      ) : null}
    </div>
  )
}

export default function ToolCallCard({
  index,
  toolName,
  args,
  result,
  durationMs,
}: {
  index: number
  toolName: string
  args: any
  result?: ToolResultNew
  durationMs?: number
}) {
  const isHeavy =
    toolName === 'read_files' ||
    toolName === 'write_file' ||
    isLargeJson(args) ||
    isLargeJson(result)
  const durationText =
    typeof durationMs === 'number' ? `${(durationMs / 1000).toFixed(2)}s` : undefined
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)]">
      <div className="px-3 py-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold">
            {index + 1}. {toolName}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">Arguments</div>
        </div>
        {durationText && (
          <div className="flex-shrink-0 bg-[var(--surface-overlay)] rounded-full px-2 py-0.5 text-xs text-[var(--text-secondary)] whitespace-nowrap border border-[var(--border-subtle)]">
            {durationText}
          </div>
        )}
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
