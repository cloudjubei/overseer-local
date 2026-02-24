import { useEffect, useMemo, useState } from 'react'
import type { CompletionMessage } from 'thefactory-tools'

import { Modal } from '@renderer/components/ui/Modal'
import { getPrice, type PricingRecord } from '@renderer/services/pricingService'

function formatUSD(n?: number) {
  if (n == null || Number.isNaN(n)) return '—'
  return `$${n.toFixed(4)}`
}

function safeNumber(n: any): number {
  return typeof n === 'number' && isFinite(n) ? n : 0
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
  provider?: string
  model?: string
  promptTokens: number
  completionTokens: number
  cachedReadInputTokens: number
  costUSD?: number
  estimatedCostUSD?: number
  price?: PricingRecord
}

export type UsageModalProps = {
  isOpen: boolean
  onClose: () => void
  messages: CompletionMessage[]
}

export default function UsageModal({ isOpen, onClose, messages }: UsageModalProps) {
  const [pricesByKey, setPricesByKey] = useState<Record<string, PricingRecord | undefined>>({})

  useEffect(() => {
    let cancelled = false

    const keys = new Set<string>()
    for (const m of messages as any[]) {
      const usage = (m as any)?.usage
      if (!usage) continue
      const provider = String(usage.provider || '')
      const model = String(usage.model || '')
      if (!provider || !model) continue
      keys.add(`${provider}::${model}`)
    }

    const run = async () => {
      const next: Record<string, PricingRecord | undefined> = {}
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
    return (messages as any[])
      .map((m, idx) => {
        const usage = m?.usage
        if (!usage) return undefined

        const provider = String(usage.provider || '') || undefined
        const model = String(usage.model || '') || undefined
        const key = provider && model ? `${provider}::${model}` : ''
        const price = key ? pricesByKey[key] : undefined

        const promptTokens = safeNumber(usage.promptTokens)
        const completionTokens = safeNumber(usage.completionTokens)
        const cachedReadInputTokens = safeNumber(usage.cachedReadInputTokens)

        const costUSD = typeof usage.cost === 'number' ? usage.cost : undefined

        const inputRate = safeNumber(price?.inputPerMTokensUSD)
        const outputRate = safeNumber(price?.outputPerMTokensUSD)
        const cacheReadRate =
          safeNumber((price as any)?.cacheReadInputPerMTokensUSD) ||
          safeNumber((price as any)?.cachedReadInputPerMTokensUSD)

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
          role: String(m?.role || 'unknown'),
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
      .filter(Boolean) as UsageRow[]
  }, [messages, pricesByKey])

  const aggByModel = useMemo(() => {
    const totalsAgg = emptyAgg()
    const map = new Map<string, UsageAgg>()
    for (const r of usageRows) {
      const name = `${r.provider || 'unknown'} · ${r.model || 'unknown'}`
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
      {/* 6 equal columns */}
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Usage"
      contentClassName="flex-grow overflow-y-auto"
    >
      <div className="bg-[var(--surface-base)] text-sm text-[var(--text-secondary)]">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="p-4">
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

          <div className="text-[11px] text-[var(--text-secondary)] opacity-80 px-4 pb-4">
            If a message has no stored cost, cost is estimated using current pricing for that
            provider+model and the message's tokens.
          </div>
        </div>
      </div>
    </Modal>
  )
}
