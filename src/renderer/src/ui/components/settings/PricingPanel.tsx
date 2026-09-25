import { useEffect, useMemo, useState } from 'react'
import { PRICE_RATE_LABELS, formatDateTime, priceListEntryView } from 'thefactory-ui/headless'
import type { PriceRateKey } from 'thefactory-ui/headless'
import {
  getCachedPricing,
  getPricingState,
  isPricingStale,
  refreshPricingState,
} from 'thefactory-ui/headless/api'
import type { PricingEntry, PricingSnapshot } from 'thefactory-ui/headless/api'
import { useAuth } from '@core/contexts/AuthContext'
import { Alert, Button, Input, Spinner, Surface } from 'thefactory-ui/web'
import { IconRefresh } from 'thefactory-ui/web/icons'

/** The rate columns, in the order and words every client's price list uses. */
const RATE_COLUMNS = Object.entries(PRICE_RATE_LABELS) as Array<[PriceRateKey, string]>

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
    <section className="flex flex-col gap-3 h-full min-h-0">
      <div className="shrink-0 flex items-center justify-between gap-3">
        <p className="text-sm opacity-70">USD per 1M tokens.</p>
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

      {error && (
        <div className="shrink-0">
          <Alert>{error}</Alert>
        </div>
      )}

      {snapshot ? (
        <>
          <div className="shrink-0 flex items-center justify-between gap-3">
            <Input
              size="sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by provider or model…"
              className="max-w-xs"
            />
            <span className="text-xs opacity-60">
              Updated {formatDateTime(snapshot.updatedAt)} · {snapshot.prices.length} entries
            </span>
          </div>

          <Surface className="flex-1 min-h-0 p-0 overflow-auto">
            {refreshing && (
              <div
                className="sticky top-0 z-20 flex items-center justify-center gap-2 py-2 text-xs text-(--text-secondary) border-b border-(--border-subtle)"
                style={{ background: 'var(--surface-base)' }}
              >
                <Spinner />
                Refreshing pricing…
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="sticky z-10"
                  style={{ background: 'var(--surface-base)', top: refreshing ? '2rem' : 0 }}
                >
                  <Th>Provider</Th>
                  <Th>Model</Th>
                  {RATE_COLUMNS.map(([key, label]) => (
                    <Th key={key} className="text-right">
                      {label} / 1M
                    </Th>
                  ))}
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={RATE_COLUMNS.length + 3}
                      className="px-3 py-4 text-center opacity-60"
                    >
                      No matches.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => <Row key={`${p.provider}/${p.model}`} entry={p} />)
                )}
              </tbody>
            </table>
          </Surface>
        </>
      ) : (
        <Surface className="flex-1 min-h-0 p-0 overflow-hidden">
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
        </Surface>
      )}
    </section>
  )
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <th
      className={`text-left text-xs font-semibold uppercase tracking-wide px-3 py-2 ${className ?? ''}`}
      style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
    >
      {children}
    </th>
  )
}

/**
 * One price: every rate it is billed at, cache writes included, and where the
 * price came from — worded by the shared headless `priceListEntryView`, which
 * also words a rate the catalogue leaves out as the one the ledger bills it at,
 * so this table and the web and mobile lists read every rate alike.
 */
function Row({ entry }: { entry: PricingEntry }): React.JSX.Element {
  const view = priceListEntryView(entry)
  const rates = new Map(view.rates.map((rate) => [rate.key, rate.value]))
  return (
    <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <td className="px-3 py-2">{view.provider}</td>
      <td className="px-3 py-2 font-mono text-xs">{view.model}</td>
      {RATE_COLUMNS.map(([key]) => (
        <td key={key} className="px-3 py-2 text-right tabular-nums">
          {rates.get(key) ?? '—'}
        </td>
      ))}
      <td className="px-3 py-2 text-xs">{view.source}</td>
    </tr>
  )
}
