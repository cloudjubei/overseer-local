import { useEffect, useMemo, useState } from 'react'
import DependencyBullet from '../tasks/DependencyBullet'
import StatusChip from './StatusChip'
import ModelChip from './ModelChip'
import { IconChevron, IconDelete, IconPlus, IconThumbDown, IconThumbUp } from '../ui/Icons'
import ProjectChip from './ProjectChip'
import CostChip from './CostChip'
import TokensChip from './TokensChip'
import { AgentRunHistory, AgentRunRatingPatch } from 'thefactory-tools'

function formatTime(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString()
  } catch {
    return iso ?? ''
  }
}

function formatDate(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString()
  } catch {
    return iso ?? ''
  }
}

function formatDuration(ms?: number) {
  if (ms == null || !isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = Math.floor(ms / 1000)
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  const parts: string[] = []
  if (hrs) parts.push(`${hrs}h`)
  if (mins) parts.push(`${mins}m`)
  parts.push(`${secs}s`)
  return parts.join(' ')
}

function useConversationCounts(run: AgentRunHistory) {
  return useMemo(() => {
    const total = run.conversations.length
    let completed = 0
    for (const c of run.conversations) {
      if (c.state === 'completed') completed++
    }
    return { total, completed }
  }, [run.conversations])
}

function useDurationTimers(run: AgentRunHistory) {
  const [now, setNow] = useState<number>(Date.now())
  useEffect(() => {
    if (run.state !== 'running') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [run.state])

  const start = new Date(run.startedAt).getTime()
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : now
  const lastUpdate = new Date(run.updatedAt).getTime()

  const startMs = Math.max(0, end - start)
  const thinkingMs = Math.max(0, now - lastUpdate)
  return { duration: formatDuration(startMs), thinking: formatDuration(thinkingMs) }
}
export interface AgentRunRowProps {
  run: AgentRunHistory
  onView?: (id: string) => void
  onCancel?: (id: string) => void
  onDelete?: (id: string) => void
  onRate?: (id: string, rating?: AgentRunRatingPatch) => void
  showActions?: boolean
  showProject?: boolean
  showModel?: boolean
  // New display controls
  showStatus?: boolean // default true
  showFeaturesInsteadOfTurn?: boolean // default true
  showThinking?: boolean // default false
  showRating?: boolean // default false
}

export default function AgentRunRow({
  run,
  onView,
  onCancel,
  onDelete,
  onRate,
  showActions = true,
  showProject = false,
  showModel = true,
  showStatus = true,
  showFeaturesInsteadOfTurn = true,
  showThinking = false,
  showRating = false,
}: AgentRunRowProps) {
  const { total, completed } = useConversationCounts(run)
  const { duration, thinking } = useDurationTimers(run)
  const prompt = useMemo(
    () =>
      run.conversations
        .flatMap((c) => c.messages)
        .map((c) => c.promptTokens ?? 0)
        .reduce((acc, c) => acc + c, 0),
    [run.conversations],
  )
  const completion = useMemo(
    () =>
      run.conversations
        .flatMap((c) => c.messages)
        .map((c) => c.completionTokens ?? 0)
        .reduce((acc, c) => acc + c, 0),
    [run.conversations],
  )
  const costUSD = useMemo(
    () =>
      (run.price.inputPerMTokensUSD * prompt) / 1_000_000 +
      (run.price.outputPerMTokensUSD * completion) / 1_000_000,
    [run.price, prompt, completion],
  )

  return (
    <tr
      id={`run-${run.id ?? 'unknown'}`}
      className="border-t border-neutral-200 dark:border-neutral-800 group"
    >
      <td className="px-3 py-2 leading-tight">
        <div>{formatDate(run.startedAt)}</div>
        <div className="text-neutral-500">{formatTime(run.startedAt)}</div>
      </td>
      {showProject ? (
        <td className="px-3 py-2">
          <ProjectChip projectId={run.projectId} />
        </td>
      ) : null}
      <td className="px-3 py-2">
        <DependencyBullet
          className={'max-w-[100px] overflow-clip'}
          dependency={run.taskId}
          notFoundDependencyDisplay={'?'}
        />
      </td>
      {showStatus ? (
        <td className="px-3 py-2">
          <StatusChip state={run.state} />
        </td>
      ) : null}
      {showModel ? (
        <td className="px-3 py-2">
          <ModelChip provider={run.llmConfig.provider} model={run.llmConfig.model} />
        </td>
      ) : null}
      {showFeaturesInsteadOfTurn ? (
        <td className="px-3 py-2">
          <span className="text-xs">
            {completed}/{total}
          </span>
        </td>
      ) : null}
      <td className="px-3 py-2">
        <CostChip
          provider={run.llmConfig.provider}
          model={run.llmConfig.model}
          price={run.price}
          costUSD={costUSD}
        />
      </td>
      <td className="px-3 py-2">
        <TokensChip run={run} />
      </td>
      {showThinking ? <td className="px-3 py-2">{thinking}</td> : null}
      <td className="px-3 py-2">{duration}</td>

      {showRating && (
        <td className="w-16">
          {!run.rating ? (
            <div className="flex flex-col items-center gap-1">
              <button
                className="hover:text-emerald-600 group"
                title="Thumbs up"
                onClick={() => onRate?.(run.id, { score: 1 })}
              >
                <IconThumbUp className="w-5 h-5 transition-colors" />
              </button>
              <button
                className="hover:text-rose-600 group"
                title="Thumbs down"
                onClick={() => onRate?.(run.id, { score: 0 })}
              >
                <IconThumbDown className="w-5 h-5 mr-1.5 transition-colors" />
              </button>
            </div>
          ) : run.rating.score === 1 ? (
            <div className="flex items-center justify-center">
              <button
                className=" text-emerald-600 hover:opacity-80"
                title="Remove rating"
                onClick={() => onRate?.(run.id, undefined)}
              >
                <IconThumbUp className="w-5 h-5" filled />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <button
                className=" text-rose-600 hover:opacity-80"
                title="Remove rating"
                onClick={() => onRate?.(run.id, undefined)}
              >
                <IconThumbDown className="w-5 h-5 mr-1.5" filled />
              </button>
            </div>
          )}
        </td>
      )}

      {showActions ? (
        <td className="px-3 py-2 text-right">
          <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            {onView ? (
              <button
                className="btn-secondary btn-icon"
                aria-label="View"
                onClick={() => run.id && onView(run.id!)}
              >
                <IconChevron />
              </button>
            ) : null}
            {run.state === 'running' && onCancel && run.id ? (
              <button
                className="btn-secondary btn-icon"
                aria-label="Cancel"
                onClick={() => onCancel(run.id!)}
              >
                <IconDelete />
              </button>
            ) : null}
            {run.state !== 'running' && onDelete && run.id ? (
              <button
                className="btn-secondary btn-icon"
                aria-label="Delete"
                onClick={() => onDelete(run.id!)}
              >
                <IconDelete />
              </button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  )
}
