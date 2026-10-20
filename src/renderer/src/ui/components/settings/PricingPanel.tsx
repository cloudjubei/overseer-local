import { useEffect, useMemo, useState } from 'react'
import { formatDateTime, priceListEntryView } from 'thefactory-ui/headless'
import {
  getCachedPricing,
  getPricingState,
  isPricingStale,
  refreshPricingState,
} from 'thefactory-ui/headless/api'
import type { PricingEntry, PricingSnapshot } from 'thefactory-ui/headless/api'
import { useAuth } from '@core/contexts/AuthContext'
import { Alert, Button, Input, LLMProviderIcon, Spinner } from 'thefactory-ui/web'
import { IconRefresh } from 'thefactory-ui/web/icons'

export default function PricingPanel(): React.JSX.Element {
  const { token } = useAuth()
  const [snapshot, setSnapshot] = useState<PricingSnapshot | null>(() => getCachedPricing())
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const load = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPricingState()
      setSnapshot(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing')
    } finally {
      setLoading(false)
    }
  }

  const refresh = async (): Promise<void> => {
    setRefreshing(true)
    setError(null)
    try {
      const data = await refreshPricingState()
      setSnapshot(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh pricing')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!token) return
    const cached = getCachedPricing()
    if (!cached) {
      void load()
      return
    }
    if (isPricingStale(cached)) {
      void refresh()
    }
  }, [token])

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const all = snapshot?.prices ?? []
    if (needle.length === 0) return all
    return all.filter(
      (p) => p.provider.toLowerCase().includes(needle) || p.model.toLowerCase().includes(needle),
    )
  }, [snapshot, filter])

  return (
    <section className="flex flex-col gap-2 h-full min-h-0">
      <p className="shrink-0 text-xs opacity-70">USD per 1M tokens.</p>

      <div className="shrink-0 flex items-center gap-2">
        <Input
          size="sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by provider or model…"
          className="flex-1"
        />
        <Button
          size="icon"
          variant="outline"
          onClick={() => void refresh()}
          disabled={loading || refreshing}
          title="Refresh from upstream"
          aria-label="Refresh from upstream"
        >
          {loading || refreshing ? <Spinner /> : <IconRefresh className="w-4 h-4" />}
        </Button>
      </div>

      {snapshot && (
        <span className="shrink-0 text-[10px] opacity-60">
          Updated {formatDateTime(snapshot.updatedAt)} · {snapshot.prices.length} entries
        </span>
      )}

      {error && (
        <div className="shrink-0">
          <Alert>{error}</Alert>
        </div>
      )}

      {snapshot ? (
        <div className="flex-1 min-h-0 overflow-auto no-scrollbar">
          {refreshing && (
            <div
              className="sticky top-0 z-20 flex items-center justify-center gap-2 py-2 text-xs text-(--text-secondary) border-b border-(--border-subtle)"
              style={{ background: 'var(--surface-base)' }}
            >
              <Spinner />
              Refreshing pricing…
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm opacity-60">No matches.</div>
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((p) => (
                <PriceItem key={`${p.provider}/${p.model}`} entry={p} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-(--text-secondary)">
            {loading ? (
              <>
                <Spinner />
                Loading pricing…
              </>
            ) : (
              'No pricing data yet.'
            )}
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * One price: the model, where its price came from (LiteLLM, or Cursor's own
 * published prices), and every rate it is billed at — cache writes included,
 * worded by the shared headless `priceListEntryView` so all clients agree.
 */
function PriceItem({ entry }: { entry: PricingEntry }): React.JSX.Element {
  const view = priceListEntryView(entry)
  return (
    <li
      className="flex items-center gap-2 rounded-md border px-3 py-2"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-raised)' }}
    >
      <LLMProviderIcon provider={view.provider} size={20} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-xs text-(--text-secondary)">{view.provider}</span>
          <span className="shrink-0 text-[10px] text-(--text-muted)">Source: {view.source}</span>
        </div>
        <div className="truncate text-sm font-semibold font-mono">{view.model}</div>
        <div className="mt-0.5 text-xs text-(--text-muted) tabular-nums">
          {view.rates.map((rate) => `${rate.label}: ${rate.value}`).join(' · ')}
        </div>
      </div>
    </li>
  )
}
