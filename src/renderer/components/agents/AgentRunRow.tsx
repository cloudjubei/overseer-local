import React, { useMemo } from 'react'
import ModelChip from './ModelChip'
import { AgentRunHistory } from 'thefactory-tools'
import { IconCheckCircle, IconDelete, IconLoader, IconStopCircle, IconThumbDown, IconThumbUp, IconXCircle } from '../ui/Icons'

export default function AgentRunRow({
  run,
  onView,
  onCancel,
  onDelete,
  onRate,
  showModel,
  showStatus,
  showFeaturesInsteadOfTurn,
  showThinking,
  showRating,
}: {
  run: AgentRunHistory
  onView?: (id: string) => void
  onCancel?: (id: string) => void
  onDelete?: (id: string) => void
  onRate?: (id: string, rating?: 0 | 1) => void
  showModel?: boolean
  showStatus?: boolean
  showFeaturesInsteadOfTurn?: boolean
  showThinking?: boolean
  showRating?: boolean
}) {
  const isRunning = run.state === 'running'

  const duration = useMemo(() => {
    const start = run.startedAt ? new Date(run.startedAt).getTime() : undefined
    const end = (run.completedAt || run.updatedAt) ? new Date(run.completedAt || run.updatedAt!).getTime() : Date.now()
    if (!start) return ''
    const ms = Math.max(0, end - start)
    const s = Math.floor(ms / 1000)
    const mm = Math.floor(s / 60).toString().padStart(2, '0')
    const ss = (s % 60).toString().padStart(2, '0')
    return `${mm}:${ss}`
  }, [run.startedAt, run.updatedAt, run.completedAt])

  const costStr = useMemo(() => run.costUsd != null ? `$${run.costUsd.toFixed(4)}` : '-', [run.costUsd])
  const tokensStr = useMemo(() => {
    const inT = run.tokens?.input ?? 0
    const outT = run.tokens?.output ?? 0
    const tot = inT + outT
    return tot ? `${tot.toLocaleString()} (${inT.toLocaleString()} in, ${outT.toLocaleString()} out)` : '-'
  }, [run.tokens])

  const rating: 0 | 1 | undefined = (run as any).rating

  const handleRate = (val?: 0 | 1) => {
    if (!onRate) return
    onRate(run.id, val)
  }

  return (
    <tr id={`run-${run.id}`} className="border-t border-neutral-200 dark:border-neutral-800">
      <td className="px-3 py-2">
        <div className="font-medium">#{run.id.slice(0,8)}</div>
        <div className="text-xs text-neutral-500">{run.taskId ?? 'Task'}</div>
      </td>
      <td className="px-3 py-2">
        <div className="truncate max-w-[260px]" title={run.description || ''}>{run.description || '-'}</div>
      </td>
      {showStatus ? (
        <td className="px-3 py-2">
          {isRunning ? (
            <span className="inline-flex items-center gap-1 text-amber-600"><IconLoader className="w-4 h-4 animate-spin" />Running</span>
          ) : run.state === 'completed' ? (
            <span className="inline-flex items-center gap-1 text-emerald-600"><IconCheckCircle className="w-4 h-4" />Completed</span>
          ) : run.state === 'failed' ? (
            <span className="inline-flex items-center gap-1 text-rose-600"><IconXCircle className="w-4 h-4" />Failed</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-neutral-600">{run.state}</span>
          )}
        </td>
      ) : null}
      {showModel ? (
        <td className="px-3 py-2"><ModelChip provider={run.llmConfig.provider} model={run.llmConfig.model} /></td>
      ) : null}
      <td className="px-3 py-2">
        <div className="text-xs text-neutral-600 dark:text-neutral-400">
          {showFeaturesInsteadOfTurn ? (
            run.features?.length ? `${run.features.length} features` : '0 features'
          ) : (
            run.turns != null ? `${run.turns} turns` : '-'
          )}
        </div>
      </td>
      <td className="px-3 py-2">{costStr}</td>
      <td className="px-3 py-2">{tokensStr}</td>
      {showThinking ? (
        <td className="px-3 py-2">
          <div className="text-xs text-neutral-600 dark:text-neutral-400">{run.thinkingTimeSec ? `${Math.round(run.thinkingTimeSec)}s` : '-'}</div>
        </td>
      ) : null}
      <td className="px-3 py-2">{duration}</td>

      {showRating ? (
        <td className="px-3 py-2 w-16">
          {rating === undefined ? (
            <div className="flex flex-col items-center gap-1">
              <button
                className="p-1 rounded hover:text-emerald-600 group"
                title="Thumbs up"
                onClick={() => handleRate(1)}
              >
                <IconThumbUp className="w-5 h-5 transition-colors" />
              </button>
              <button
                className="p-1 rounded hover:text-rose-600 group"
                title="Thumbs down"
                onClick={() => handleRate(0)}
              >
                <IconThumbDown className="w-5 h-5 transition-colors" />
              </button>
            </div>
          ) : rating === 1 ? (
            <div className="flex items-center justify-center">
              <button
                className="p-1 rounded text-emerald-600 hover:opacity-80"
                title="Remove rating"
                onClick={() => handleRate(undefined)}
              >
                <IconThumbUp className="w-5 h-5" filled />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <button
                className="p-1 rounded text-rose-600 hover:opacity-80"
                title="Remove rating"
                onClick={() => handleRate(undefined)}
              >
                <IconThumbDown className="w-5 h-5" filled />
              </button>
            </div>
          )}
        </td>
      ) : null}

      <td className="px-3 py-2 text-right">
        <div className="inline-flex items-center gap-2">
          <button className="btn-secondary btn-xs" onClick={() => onView?.(run.id)}>View</button>
          {isRunning ? (
            <button className="btn-danger btn-xs inline-flex items-center gap-1" onClick={() => onCancel?.(run.id)}>
              <IconStopCircle className="w-4 h-4" />
              Cancel
            </button>
          ) : null}
          {!isRunning && onDelete ? (
            <button className="btn-danger btn-xs inline-flex items-center gap-1" onClick={() => onDelete?.(run.id)}>
              <IconDelete className="w-4 h-4" />
              Delete
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
