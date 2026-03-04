import { useEffect, useMemo, useState } from 'react'
import type {
  CompletionAssistantMessage,
  CompletionMessage,
  LLMCostAggregateContent,
  ModelPrice,
} from 'thefactory-tools'

import { Modal } from '@renderer/components/ui/Modal'
import { getPrice } from '@renderer/services/pricingService'
import { useCosts } from '@renderer/contexts/CostsContext'

function formatUSD(n?: number) {
  if (n == null || Number.isNaN(n)) return '—'
  return `$${n.toFixed(4)}`
}

function safeNumber(n: unknown): number {
  return typeof n === 'number' && isFinite(n) ? n : 0
}

function prettifyBreakdownKey(k: string): { provider?: string; model?: string; label: string } {
  // Common convention across the UI is 'provider::model'
  if (k.includes('::')) {
    const [provider, ...rest] = k.split('::')
    const model = rest.join('::')
    if (provider && model) return { provider, model, label: `${provider} · ${model}` }
  }

  // Alternate convention: 'provider/model'
  // (avoid parsing URLs like 'https://...' by requiring exactly one slash)
  if (k.includes('/') && !k.includes('://')) {
    const parts = k.split('/')
    if (parts.length === 2) {
      const [provider, model] = parts
      if (provider && model) return { provider, model, label: `${provider} · ${model}` }
    }
  }

  // Alternate convention: 'provider:model'
  // Avoid colliding with other colon-containing strings (e.g. JSON, time, etc.) by requiring exactly one ':'
  // and excluding '://'
  if (k.includes(':') && !k.includes('://')) {
    const parts = k.split(':')
    if (parts.length === 2) {
      const [provider, model] = parts
      if (provider && model) return { provider, model, label: `${provider} · ${model}` }
    }
  }

  return { label: k }
}

type UsageAgg = {
  costUSD: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedReadInputTokens: number
}

function emptyAgg(): UsageAgg {
  return {
    costUSD: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cachedReadInputTokens: 0,
  }
}

type UsageRow = {
  idx: number
  role: string
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  cachedReadInputTokens: number
  costUSD?: number
  estimatedCostUSD?: number
  price?: ModelPrice
}

export type UsageModalProps = {
  isOpen: boolean
  onClose: () => void
  messages: CompletionMessage[]
  chatKey?: string
}

function isAssistant(m: CompletionMessage): m is CompletionAssistantMessage {
  return m.role === 'assistant' && !!m.usage && !!m.model
}

export default function UsageModal({ isOpen, onClose, messages, chatKey }: UsageModalProps) {
  const [pricesByKey, setPricesByKey] = useState<Record<string, ModelPrice | undefined>>({})
  const [durable, setDurable] = useState<LLMCostAggregateContent | undefined>(undefined)
  const { getCost } = useCosts()

  useEffect(() => {
    let cancelled = false
    if (!isOpen) return
    if (!chatKey) {
      setDurable(undefined)
      return
    }

    const run = async () => {
      try {
        const agg = await getCost(chatKey)
        if (cancelled) return
        setDurable(agg)
      } catch {
        if (cancelled) return
        setDurable(undefined)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [chatKey, isOpen, getCost])

  useEffect(() => {
    let cancelled = false

    const keys = new Set<string>()
    for (const m of messages) {
      if (!isAssistant(m)) continue

      keys.add(`${m.model.provider}::${m.model.model}`)
    }

    const run = async () => {
      const next: Record<string, ModelPrice | undefined> = {}
      for (const k of Array.from(keys)) {
        const [provider, model] = k.split('::')
        try {
          next[k] = await getPrice(provider, model)
        } catch {
          next[k] = undefined
        }
      }
      if (!cancelled) setPricesByKey(next)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [messages])

  const usageRows: UsageRow[] = useMemo(() => {
    return messages
      .filter((m) => isAssistant(m))
      .map((m, idx) => {
        const usage = m.usage
        const provider = m.model.provider
        const model = m.model.model

        const key = `${provider}::${model}`
        const price = pricesByKey[key]

        const promptTokens = safeNumber(usage.promptTokens)
        const completionTokens = safeNumber(usage.completionTokens)
        const cachedReadInputTokens = safeNumber(usage.cachedReadInputTokens)

        const costUSD = typeof usage.cost === 'number' ? usage.cost : undefined

        const inputRate = safeNumber(price?.inputPerMTokensUSD)
        const outputRate = safeNumber(price?.outputPerMTokensUSD)
        const cacheReadRate = safeNumber(price?.cacheReadInputPerMTokensUSD)

        const canEstimate = inputRate > 0 || outputRate > 0 || cacheReadRate > 0

        const estPromptUSD =
          canEstimate && inputRate > 0 ? (promptTokens * inputRate) / 1_000_000 : 0
        const estCachedReadUSD =
          canEstimate && cacheReadRate > 0
            ? (cachedReadInputTokens * cacheReadRate) / 1_000_000
            : // If we don't have a specific cache-read rate, fall back to normal input pricing.
              canEstimate && inputRate > 0
              ? (cachedReadInputTokens * inputRate) / 1_000_000
              : 0
        const estOutputUSD =
          canEstimate && outputRate > 0 ? (completionTokens * outputRate) / 1_000_000 : 0
        const estCostUSD = canEstimate ? estPromptUSD + estCachedReadUSD + estOutputUSD : undefined

        return {
          idx,
          role: m.role,
          provider,
          model,
          promptTokens,
          completionTokens,
          cachedReadInputTokens,
          costUSD,
          estimatedCostUSD: typeof costUSD === 'number' ? undefined : estCostUSD,
          price,
        } satisfies UsageRow
      })
  }, [messages, pricesByKey])
  const hasCurrent = usageRows.length > 0


  const aggByModel = useMemo(() => {
    const totalsAgg = emptyAgg()
    const map = new Map<string, UsageAgg>()
    for (const r of usageRows) {
      const name = `${r.provider} · ${r.model}`
      const a = map.get(name) || emptyAgg()

      const cost =
        typeof r.costUSD === 'number'
          ? r.costUSD
          : typeof r.estimatedCostUSD === 'number'
            ? r.estimatedCostUSD
            : 0
      a.costUSD += cost
      totalsAgg.costUSD += cost
      a.promptTokens += r.promptTokens
      totalsAgg.promptTokens += r.promptTokens
      a.completionTokens += r.completionTokens
      totalsAgg.completionTokens += r.completionTokens
      a.totalTokens += r.promptTokens + r.completionTokens
      totalsAgg.totalTokens += r.promptTokens + r.completionTokens
      a.cachedReadInputTokens += r.cachedReadInputTokens
      totalsAgg.cachedReadInputTokens += r.cachedReadInputTokens
      map.set(name, a)
    }
    const rows = Array.from(map.entries())
      .map(([name, a]) => {
        return { name, ...a }
      })
      .sort((a, b) => b.costUSD - a.costUSD)
    if (rows.length <= 1) return [{ name: 'TOTALS', ...totalsAgg }]
    return [{ name: 'TOTALS', ...totalsAgg }, ...rows]
  }, [usageRows])

  const colGroup = (
    <colgroup>
      <col style={{ width: '160px' }} />
      <col style={{ width: '160px' }} />
      <col style={{ width: '160px' }} />
      <col style={{ width: '160px' }} />
      <col style={{ width: '160px' }} />
      <col style={{ width: '160px' }} />
    </colgroup>
  )
  const sharedHeader = (
    <thead className="bg-[var(--surface-raised)] text-[var(--text-secondary)]">
      <tr>
        <th className="text-center px-2 py-2 align-top whitespace-normal break-words">Group</th>
        <th className="text-center px-2 py-2 align-top whitespace-normal break-words">Cost</th>
        <th className="text-center px-2 py-2 align-top whitespace-normal break-words">Tokens</th>
        <th className="text-center px-2 py-2 align-top whitespace-normal break-words">Prompt</th>
        <th className="text-center px-2 py-2 align-top whitespace-normal break-words">
          Completion
        </th>
        <th className="text-center px-2 py-2 align-top whitespace-normal break-words">
          Cached read
        </th>
      </tr>
    </thead>
  )
  const renderAggBody = (rows: Array<{ key: string; label: string } & UsageAgg>) => {
    return (
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-[var(--border-subtle)]">
            <td className="px-2 py-2 text-[var(--text-primary)] whitespace-normal break-words align-top">
              {r.label}
            </td>
            <td className="px-2 py-2 align-top whitespace-normal break-words">
              <div className="line-clamp-3">{formatUSD(r.costUSD)}</div>
            </td>
            <td className="px-2 py-2 align-top">{Math.round(r.totalTokens).toLocaleString()}</td>
            <td className="px-2 py-2 align-top">{Math.round(r.promptTokens).toLocaleString()}</td>
            <td className="px-2 py-2 align-top">
              {Math.round(r.completionTokens).toLocaleString()}
            </td>
            <td className="px-2 py-2 align-top">
              {Math.round(r.cachedReadInputTokens).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    )
  }

  const durableAgg: UsageAgg | undefined = durable
    ? {
        costUSD: durable.totalCostUSD,
        promptTokens: durable.totalPromptTokens,
        completionTokens: durable.totalCompletionTokens,
        totalTokens: durable.totalPromptTokens + durable.totalCompletionTokens,
        cachedReadInputTokens: durable.totalCachedReadInputTokens,
      }
    : undefined

  const durableBreakdownRows: Array<{ key: string; label: string } & UsageAgg> | undefined = useMemo(
    () => {
      if (!durable) return undefined
      const rows = Object.entries(durable.breakdown)
        .map(([k, b]) => {
          const pretty = prettifyBreakdownKey(k)
          return {
            key: `durable:${k}`,
            label: pretty.label,
            costUSD: b.costUSD,
            promptTokens: b.promptTokens,
            completionTokens: b.completionTokens,
            totalTokens: b.promptTokens + b.completionTokens,
            cachedReadInputTokens: b.cachedReadInputTokens,
          }
        })
        .sort((a, b) => b.costUSD - a.costUSD)

      return [
        {
          key: 'durable:TOTALS',
          label: 'TOTALS',
          ...(durableAgg || emptyAgg()),
        },
        ...rows,
      ]
    },
    [durable, durableAgg],
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Usage"
      contentClassName="flex-grow overflow-y-auto"
    >
      <div className="bg-[var(--surface-base)] text-sm text-[var(--text-secondary)]">
        <div className="space-y-6">
          {chatKey ? (
            <div className="space-y-2">
              <div className="px-4 pt-4">
                <div className="text-[12px] text-[var(--text-secondary)]">
                  Ledger totals (durable)
                </div>
              </div>
              <div className="px-4">
                <div className="border border-[var(--border-subtle)] rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm table-fixed">
                      {colGroup}
                      {sharedHeader}
                      {durableBreakdownRows
                        ? renderAggBody(durableBreakdownRows)
                        : renderAggBody([
                            {
                              key: 'durable',
                              label: 'TOTALS (unavailable)',
                              ...emptyAgg(),
                            },
                          ])}
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {hasCurrent ? (
            <div className="space-y-2">
              <div className="px-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                  <div className="text-[12px] text-[var(--text-secondary)] tracking-wide">
                    CURRENT
                  </div>
                  <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                </div>
              </div>
              <div className="px-4 pb-4">
                <div className="border border-[var(--border-subtle)] rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm table-fixed">
                      {colGroup}
                      {sharedHeader}
                      {renderAggBody(
                        aggByModel.map((r) => ({
                          key: `${r.name}`,
                          label: `${r.name}`,
                          ...r,
                        })),
                      )}
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="text-[11px] text-[var(--text-secondary)] opacity-80 px-4 pb-4 space-y-1">
            <div>
              If a message has no stored cost, cost is estimated using current pricing for that
              provider+model and the message's tokens.
            </div>
            <div>
              Durable totals are computed from the persisted cost ledger for this 'chatKey' and do
              not decrease if you clear/restart/delete a chat.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
