import { useEffect, useMemo, useState } from 'react'
import {
  getPricing,
  refreshPricing,
} from 'thefactory-ui/headless/api'
import type {
  PricingEntry,
  PricingSnapshot,
} from 'thefactory-ui/headless/api'
import { useAuth } from '@core/contexts/AuthContext'
import { Alert, Button, Input, Spinner, Surface } from 'thefactory-ui/web'
import { IconRefresh } from 'thefactory-ui/web/icons'
import { formatDateTime } from '@ui/utils/date'
import { getCachedPricing, isStale, setCachedPricing } from './pricingCache'

const FMT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

export default function PricingPanel() {
  const { token } = useAuth()
  const [snapshot, setSnapshot] = useState<PricingSnapshot | null>(() => getCachedPricing())
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await getPricing({ throwOnError: true })
      setSnapshot(data)
      setCachedPricing(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pricing')
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const { data } = await refreshPricing({ body: {}, throwOnError: true })
      setSnapshot(data)
      setCachedPricing(data)
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
    if (isStale(cached)) {
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
        <p className="text-sm opacity-70">USD per 1M tokens, as the backend has them cached.</p>
        <Button
          size="icon"
          variant="outline"
          onClick={() => void refresh()}
          disabled={refreshing}
          title="Refresh from upstream"
          aria-label="Refresh from upstream"
        >
          {refreshing ? <Spinner /> : <IconRefresh className="w-4 h-4" />}
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
                  <Th className="text-right">Input / 1M</Th>
                  <Th className="text-right">Output / 1M</Th>
                  <Th className="text-right">Cache read / 1M</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center opacity-60">
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

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`text-left text-xs font-semibold uppercase tracking-wide px-3 py-2 ${className ?? ''}`}
      style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
    >
      {children}
    </th>
  )
}

function Row({ entry }: { entry: PricingEntry }) {
  return (
    <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <td className="px-3 py-2">{entry.provider}</td>
      <td className="px-3 py-2 font-mono text-xs">{entry.model}</td>
      <td className="px-3 py-2 text-right tabular-nums">{FMT.format(entry.inputPerMTokensUSD)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{FMT.format(entry.outputPerMTokensUSD)}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {entry.cacheReadInputPerMTokensUSD === undefined
          ? '—'
          : FMT.format(entry.cacheReadInputPerMTokensUSD)}
      </td>
    </tr>
  )
}
