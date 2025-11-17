import { useEffect, useMemo, useState } from 'react'
import DependencyBullet from '../stories/DependencyBullet'
import StatusChip from './StatusChip'
import ModelChip from './ModelChip'
import {
  IconChevron,
  IconDelete,
  IconStopCircle,
  IconThumbDown,
  IconThumbUp,
} from '../ui/icons/Icons'
import ProjectChip from './ProjectChip'
import CostChip from './CostChip'
import TokensChip from './TokensChip'
import { AgentRunHistory, AgentRunRatingPatch } from 'thefactory-tools'
import { Button } from '../ui/Button'
import { formatDate, formatHmsCompact, formatTime } from '../../utils/time'
import { useAgents } from '../../contexts/AgentsContext'
import DotBadge from '../ui/DotBadge'
import { useNotifications } from '@renderer/hooks/useNotifications'

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

  const create = new Date(run.createdAt).getTime()
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : now
  const lastUpdate = new Date(run.updatedAt).getTime()

  const startMs = Math.max(0, end - create)
  const thinkingMs = Math.max(0, now - lastUpdate)
  return { duration: formatHmsCompact(startMs), thinking: formatHmsCompact(thinkingMs) }
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
  const { isRunUnread, markRunSeen } = useAgents()
  const { markNotificationsByMetadata } = useNotifications()
  const unread = isRunUnread(run)

  const [isAnimating, setIsAnimating] = useState(false)
  const [animKind, setAnimKind] = useState<'up' | 'down' | null>(null)

  const handleRate = (rating: AgentRunRatingPatch | undefined) => {
    if (onRate) {
      setIsAnimating(true)
      setAnimKind((rating ?? run.rating)?.score === 1 ? 'up' : 'down')

      window.setTimeout(() => {
        setIsAnimating(false)
        setAnimKind(null)
      }, 700)
      onRate?.(run.id, rating)
    }
  }

  const prompt = useMemo(
    () =>
      run.conversations
        .flatMap((c) => c.messages)
        .map((c) => c.completionMessage.usage.promptTokens ?? 0)
        .reduce((acc, c) => acc + c, 0),
    [run.conversations],
  )
  const completion = useMemo(
    () =>
      run.conversations
        .flatMap((c) => c.messages)
        .map((c) => c.completionMessage.usage.completionTokens ?? 0)
        .reduce((acc, c) => acc + c, 0),
    [run.conversations],
  )

  const costUSD = useMemo(
    () =>
      (run.price.inputPerMTokensUSD * prompt) / 1_000_000 +
      (run.price.outputPerMTokensUSD * completion) / 1_000_000,
    [run.price, prompt, completion],
  )

  const acknowledgeRun = () => {
    if (unread && run.id) {
      markRunSeen(run.id)
      void markNotificationsByMetadata({ runId: run.id }, {
        category: 'agent_runs',
        projectId: run.projectId,
      })
    }
  }

  return (
    <tr
      id={`run-${run.id ?? 'unknown'}`}
      className="border-t border-neutral-200 dark:border-neutral-800 group"
      onMouseEnter={acknowledgeRun}
      onFocus={acknowledgeRun}
    >
      {/* Unseen-completed red dot indicator to the left of the first column */}
      <td className="px-3 py-2 leading-tight w-4">
        {unread ? (
          <DotBadge title={'Run completed (unseen)'} />
        ) : (
          <span className="inline-block w-2.5" aria-hidden />
        )}
      </td>
      <td className="px-3 py-2 leading-tight">
        <div>{formatDate(run.finishedAt || run.createdAt)}</div>
        <div className="text-neutral-500">{formatTime(run.finishedAt || run.createdAt)}</div>
      </td>
      {showProject ? (
        <td className="px-3 py-2">
          <ProjectChip projectId={run.projectId} />
        </td>
      ) : null}
      <td className="px-3 py-2">
        <DependencyBullet
          className={'max-w-[100px] overflow-clip'}
          dependency={run.storyId}
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
                className={`hover:text-emerald-600 group relative ${isAnimating ? 'opacity-60 pointer-events-none' : ''}`}
                title="Thumbs up"
                onClick={() => handleRate({ score: 1 })}
                disabled={isAnimating}
              >
                <span
                  className={`inline-flex items-center justify-center rating-effect ${isAnimating && animKind === 'up' ? 'rating-pop rating-pop--up' : ''}`}
                >
                  <IconThumbUp className="w-5 h-5 transition-colors" />
                  {isAnimating && animKind === 'up' ? (
                    <span aria-hidden className="rating-sparkles rating-sparkles--up" />
                  ) : null}
                </span>
              </button>
              <button
                className={`hover:text-rose-600 group relative ${isAnimating ? 'opacity-60 pointer-events-none' : ''}`}
                title="Thumbs down"
                onClick={() => handleRate({ score: 0 })}
                disabled={isAnimating}
              >
                <span
                  className={`inline-flex items-center justify-center rating-effect ${isAnimating && animKind === 'down' ? 'rating-pop rating-pop--down' : ''}`}
                >
                  <IconThumbDown className="w-5 h-5 mr-1.5 transition-colors" />
                  {isAnimating && animKind === 'down' ? (
                    <span aria-hidden className="rating-sparkles rating-sparkles--down" />
                  ) : null}
                </span>
              </button>
            </div>
          ) : run.rating.score === 1 ? (
            <div className="flex items-center justify-center">
              <button
                className={`text-emerald-600 hover:opacity-80 relative ${isAnimating ? 'opacity-60 pointer-events-none' : ''}`}
                title="Remove rating"
                onClick={() => handleRate(undefined)}
                disabled={isAnimating}
              >
                <span
                  className={`inline-flex items-center justify-center rating-effect ${isAnimating && animKind === 'up' ? 'rating-pop rating-pop--up' : ''}`}
                >
                  <IconThumbUp className="w-5 h-5" filled />
                  {isAnimating && animKind === 'up' ? (
                    <span aria-hidden className="rating-sparkles rating-sparkles--up" />
                  ) : null}
                </span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <button
                className={`text-rose-600 hover:opacity-80 relative ${isAnimating ? 'opacity-60 pointer-events-none' : ''}`}
                title="Remove rating"
                onClick={() => handleRate(undefined)}
                disabled={isAnimating}
              >
                <span
                  className={`inline-flex items-center justify-center rating-effect ${isAnimating && animKind === 'down' ? 'rating-pop rating-pop--down' : ''}`}
                >
                  <IconThumbDown className="w-5 h-5 mr-1.5" filled />
                  {isAnimating && animKind === 'down' ? (
                    <span aria-hidden className="rating-sparkles rating-sparkles--down" />
                  ) : null}
                </span>
              </button>
            </div>
          )}
        </td>
      )}

      {showActions ? (
        <td className="px-3 py-2 text-right">
          <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            {onView ? (
              <Button
                className="btn-secondary w-[34px]"
                aria-label="View"
                onClick={() => run.id && onView(run.id!)}
              >
                <IconChevron className="w-4 h-4" />
              </Button>
            ) : null}
            {run.state === 'running' && onCancel && run.id ? (
              <Button
                className="btn-secondary w-[34px]"
                variant="danger"
                aria-label="Cancel"
                onClick={() => onCancel(run.id!)}
              >
                <IconStopCircle className="w-4 h-4" />
              </Button>
            ) : null}
            {run.state !== 'running' && onDelete && run.id ? (
              <Button
                className="btn-secondary w-[34px]"
                variant="danger"
                aria-label="Delete"
                onClick={() => onDelete(run.id!)}
              >
                <IconDelete className="w-4 h-4" />
              </Button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  )
}
