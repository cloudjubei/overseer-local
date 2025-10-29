import {
  IconCheckmarkCircle,
  IconError,
  IconStop,
  IconNotAllowed,
  IconHourglass,
  IconChevron,
} from '../ui/icons/Icons'
import Code from '../ui/Code'
import { useMemo, useState } from 'react'
import { Switch } from '../ui/Switch'
import JsonView from '../ui/JsonView'
import { ToolCall, ToolResultType } from 'thefactory-tools'
import Tooltip from '../ui/Tooltip'
import ToolCallChangePopup from './ToolCallChangePopup'

export type ToolCallCardProps = {
  index: number
  toolCall: ToolCall
  result?: any
  resultType?: ToolResultType
  durationMs?: number
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  disabled?: boolean
}
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
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
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

function StatusIcon({ resultType }: { resultType?: ToolResultType }) {
  const size = 'w-4 h-4'
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

function StatusPill({ resultType }: { resultType?: ToolResultType }) {
  if (!resultType) return null
  const base =
    'text-[10px] text-center uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full'
  let colors = ''
  switch (resultType) {
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
      colors = 'bg-neutral-500/20 text-teal-600 dark:text-teal-400'
      break
    default:
      colors = 'bg-neutral-500/20 text-neutral-600 dark:text-neutral-400'
      break
  }
  return <div className={`${base} ${colors}`}>{resultType.replace('_', ' ')}</div>
}

function getResultString(result: any): string {
  let out = result
  if (typeof result === 'string') {
    try {
      out = JSON.parse(result)
    } catch {}
  }
  try {
    return JSON.stringify(out, null, 2)
  } catch {
    return String(out)
  }
}

function getErrorString(result: any): string | undefined {
  if (!result) return undefined
  try {
    const msg =
      (result?.error && (result.error.message || result.error.msg || String(result.error))) ||
      result?.message ||
      result?.err ||
      (typeof result === 'string' ? result : undefined)
    if (msg) return typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)
  } catch {}
  try {
    return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  } catch {
    return undefined
  }
}

export default function ToolCallCard({
  index,
  toolCall,
  result,
  resultType,
  durationMs,
  selectable,
  selected,
  onToggleSelect,
}: ToolCallCardProps) {
  const [isCallExpanded, setIsCallExpanded] = useState(false)

  const resultString = resultType === 'success' ? getResultString(result) : undefined
  const errorString = resultType === 'errored' ? getErrorString(result) : undefined
  const isRequireConfirm = resultType === 'require_confirmation'

  const hasArgs = useMemo(() => {
    const args = toolCall?.arguments
    if (!args) return false
    if (typeof args !== 'object') return true
    return Object.keys(args).length > 0
  }, [toolCall?.arguments])

  const hasPopup = typeof result !== 'undefined' && resultType !== 'aborted'
  const anchorClassName = [
    'rounded-md border text-sm text-[var(--text-primary)] relative focus:outline-none focus:ring-2 focus:ring-blue-500/40',
    isRequireConfirm
      ? 'bg-teal-500/20 border-teal-600 dark:border-teal-700 dark:bg-teal-800/60'
      : 'border-[var(--border-subtle)] bg-[var(--surface-overlay)]',
  ].join(' ')

  const content = (
    <>
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="flex items-center gap-2">
          <StatusIcon resultType={resultType} />
          <span className="font-semibold">{toolCall.name}</span>
          {(durationMs ?? 0) > 0 && <span className="font-light text-xs ">{durationMs}ms</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile hint icon */}
          {hasPopup ? (
            <span
              className="sm:hidden inline-flex items-center justify-center w-4 h-4 rounded-full border border-blue-500 text-blue-600"
              aria-hidden="true"
              title="View change summary"
            >
              <span className="text-[10px] leading-none">i</span>
            </span>
          ) : null}
          {hasArgs ? (
            <button
              type="button"
              className="btn-icon"
              onClick={(e) => {
                e.stopPropagation()
                setIsCallExpanded((v) => !v)
              }}
              aria-expanded={isCallExpanded}
            >
              <IconChevron
                className="w-4 h-4 transition-transform"
                style={{ transform: `rotate(${isCallExpanded ? 90 : 0}deg)` }}
              />
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <StatusPill resultType={resultType} />
        {selectable && onToggleSelect && (
          <span onClick={(e) => e.stopPropagation()}>
            <Switch checked={selected == true} onCheckedChange={onToggleSelect} label="" />
          </span>
        )}
      </div>
      {isCallExpanded && hasArgs && (
        <div className="px-3 pb-2">
          <Code language="json" code={JSON.stringify(toolCall.arguments ?? {}, null, 2)} />
          {/* <JsonView value={result} /> */}
        </div>
      )}{' '}
      {resultString && (
        <Collapsible title={<span>View result</span>}>
          <div className="p-2 max-h-72 overflow-auto bg-[var(--surface-raised)] border-t border-[var(--border-subtle)]">
            <Code language="json" code={resultString} />
            {/* <JsonView value={result} /> */}
          </div>
        </Collapsible>
      )}
      {!resultString && errorString && (
        <Collapsible title={<span>View error</span>}>
          <div className="p-2 max-h-72 overflow-auto bg-[var(--surface-raised)] border-t border-[var(--border-subtle)]">
            <Code language="" code={errorString} />
          </div>
        </Collapsible>
      )}
    </>
  )

  if (!hasPopup) {
    return <div className={anchorClassName}>{content}</div>
  }

  return (
    <Tooltip
      content={
        <ToolCallChangePopup
          toolCall={toolCall}
          result={result}
          resultType={resultType}
          durationMs={durationMs}
        />
      }
      placement="right"
      delayMs={150}
      anchorAs="div"
      anchorClassName={anchorClassName}
      anchorTabIndex={0}
    >
      {content}
    </Tooltip>
  )
}
