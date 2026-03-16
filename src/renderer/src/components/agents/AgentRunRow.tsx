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
import type { Chat, LLMConfig } from 'thefactory-tools'
import { Button } from '../ui/Button'
import { formatDate, formatHmsCompact, formatTime } from '../../utils/time'
import { useAgents } from '../../contexts/AgentsContext'
import DotBadge from '../ui/DotBadge'
import { useNotifications } from '@renderer/hooks/useNotifications'
import { useCosts } from '@renderer/contexts/CostsContext'
import { getChatContextKey } from 'thefactory-tools/utils'

function useDurationTimers(run: Chat) {
  const [now, setNow] = useState<number>(Date.now())
  useEffect(() => {
    if (run.state !== 'running') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [run.state])

  const create = new Date(run.createdAt).getTime()
  // Try to find the last message to estimate 'finishedAt' if it's completed
  const lastUpdate = new Date(run.updatedAt).getTime()
  const end = run.state === 'running' || run.state === 'created' ? now : lastUpdate

  const startMs = Math.max(0, end - create)
  const thinkingMs = Math.max(0, now - lastUpdate)
  return { duration: formatHmsCompact(startMs), thinking: formatHmsCompact(thinkingMs) }
}

export interface AgentRunRowProps {
  run: Chat
  onView?: (id: string) => void
  onCancel?: (id: string) => void
  onDelete?: (id: string) => void
  onRate?: (id: string, rating?: { score: number; comment?: string }) => void
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
  const { duration, thinking } = useDurationTimers(run)
  const { isRunUnread, markRunSeen } = useAgents()
  const { markNotificationsByMetadata } = useNotifications()
  const { getCost } = useCosts()
  const unread = isRunUnread(run)

  const [isAnimating, setIsAnimating] = useState(false)
  const [animKind, setAnimKind] = useState<'up' | 'down' | null>(null)

  const [durableCostUSD, setDurableCostUSD] = useState<number | undefined>(undefined)

  const chatKey = useMemo(() => {
    if (!run?.context.agentRunId) return undefined
    return getChatContextKey(run.context)
  }, [run?.context])

  useEffect(() => {
    let cancelled = false
    if (!chatKey) {
      setDurableCostUSD(undefined)
      return
    }
    getCost(chatKey)
      .then((res) => {
        if (cancelled) return
        setDurableCostUSD(res?.totalCostUSD)
      })
      .catch(() => {
        if (cancelled) return
        setDurableCostUSD(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [chatKey, getCost])

  const handleRate = (rating: { score: number; comment?: string } | undefined) => {
    if (onRate) {
      setIsAnimating(true)
      setAnimKind((rating ?? run.rating)?.score === 1 ? 'up' : 'down')

      window.setTimeout(() => {
        setIsAnimating(false)
        setAnimKind(null)
      }, 700)
      onRate?.(run.context.agentRunId!, rating)
    }
  }

  const prompt = useMemo(
    () =>
      run.messages
        .map((m: any) => (m?.role === 'assistant' ? (m?.usage?.promptTokens ?? 0) : 0))
        .reduce((acc, c) => acc + c, 0),
    [run.messages],
  )
  const completion = useMemo(
    () =>
      run.messages
        .map((m: any) => (m?.role === 'assistant' ? (m?.usage?.completionTokens ?? 0) : 0))
        .reduce((acc, c) => acc + c, 0),
    [run.messages],
  )

  const llmConfig = run.metadata?.llmConfig as LLMConfig | undefined

  const costUSD = useMemo(() => {
    if (durableCostUSD != null) return durableCostUSD
    if (!llmConfig) return 0
    const inputPrice = llmConfig.costInputPerMTokensUSD || 0
    const outputPrice = llmConfig.costOutputPerMTokensUSD || 0
    return (inputPrice * prompt) / 1_000_000 + (outputPrice * completion) / 1_000_000
  }, [durableCostUSD, llmConfig, prompt, completion])

  const acknowledgeRun = () => {
    if (unread && run.context.agentRunId) {
      markRunSeen(run.context.agentRunId)
      void markNotificationsByMetadata(
        { runId: run.context.agentRunId },
        {
          category: 'agent_runs',
          projectId: run.context.projectId,
        },
      )
    }
  }

  return (
    <tr
      id={`run-${run.context.agentRunId ?? 'unknown'}`}
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
        <div>{formatDate(run.updatedAt || run.createdAt)}</div>
        <div className="text-neutral-500">{formatTime(run.updatedAt || run.createdAt)}</div>
      </td>
      {showProject ? (
        <td className="px-3 py-2">
          <ProjectChip projectId={run.context.projectId} />
        </td>
      ) : null}
      <td className="px-3 py-2">
        <DependencyBullet
          className={'max-w-[100px] overflow-clip'}
          dependency={run.context.featureId ? `${run.context.storyId}.${run.context.featureId}` : run.context.storyId || ''}
          notFoundDependencyDisplay={'?'}
        />
      </td>
      {showStatus ? (
        <td className="px-3 py-2">
          <StatusChip state={run.state || 'created'} />
        </td>
      ) : null}
      {showModel ? (
        <td className="px-3 py-2">
          {llmConfig ? (
            <ModelChip provider={llmConfig.provider} model={llmConfig.model} />
          ) : (
            <span className="text-neutral-500">—</span>
          )}
        </td>
      ) : null}
      {showFeaturesInsteadOfTurn ? (
        <td className="px-3 py-2">
          <span className="text-xs">
            {run.context.featureId ? '1/1' : '—'}
          </span>
        </td>
      ) : null}
      <td className="px-3 py-2">
        <CostChip
          provider={llmConfig?.provider || ''}
          model={llmConfig?.model || ''}
          price={llmConfig ? { inputPerMTokensUSD: llmConfig.costInputPerMTokensUSD || 0, outputPerMTokensUSD: llmConfig.costOutputPerMTokensUSD || 0 } : undefined}
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
                 onClick={() => run.context.agentRunId && onView(run.context.agentRunId)}
               >
                 <IconChevron className="w-4 h-4" />
               </Button>
            ) : null}
            {run.state === 'running' && onCancel && run.context.agentRunId ? (
              <Button
                className="btn-secondary w-[34px]"
                variant="danger"
                aria-label="Cancel"
                onClick={() => onCancel(run.context.agentRunId!)}
              >
                <IconStopCircle className="w-4 h-4" />
              </Button>
            ) : null}
            {run.state !== 'running' && onDelete && run.context.agentRunId ? (
              <Button
                className="btn-secondary w-[34px]"
                variant="danger"
                aria-label="Delete"
                onClick={() => onDelete(run.context.agentRunId!)}
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
