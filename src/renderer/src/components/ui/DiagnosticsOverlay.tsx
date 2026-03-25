import { useMemo, useState } from 'react'
import type { DiagnosticsSnapshot } from 'src/types/diagnostics'
import { IconCpu, IconMaximize, IconMinimize } from './icons/Icons'
import { useDiagnosticsOverlay } from '../../hooks/useDiagnosticsOverlay'

function fmtNumber(n: number | undefined, digits = 0) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—'
  return n.toFixed(digits)
}

function fmtMbFromKb(kb: number | undefined) {
  if (typeof kb !== 'number') return '—'
  return `${(kb / 1024).toFixed(1)} MB`
}

function MiniSparkline({ values, width = 140, height = 32 }: { values: number[]; width?: number; height?: number }) {
  const path = useMemo(() => {
    if (!values.length) return ''
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = Math.max(1e-6, max - min)
    const toX = (i: number) => (i / Math.max(1, values.length - 1)) * (width - 2) + 1
    const toY = (v: number) => height - 1 - ((v - min) / span) * (height - 2)

    return values
      .map((v, i) => {
        const x = toX(i)
        const y = toY(v)
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')
  }, [values, width, height])

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <rect x={0} y={0} width={width} height={height} rx={6} className="fill-black/20" />
      {path ? <path d={path} className="stroke-brand-400" fill="none" strokeWidth={1.5} /> : null}
    </svg>
  )
}

function SnapshotRows({ latest }: { latest: DiagnosticsSnapshot | null }) {
  const cpu = latest?.appMetrics?.cpu?.percentCPUUsage
  const mem = latest?.processMemoryInfo
  const lag = latest?.eventLoopLagMs

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
      <div className="text-[var(--text-secondary)]">CPU</div>
      <div className="text-right tabular-nums">{typeof cpu === 'number' ? `${cpu.toFixed(1)}%` : '—'}</div>

      <div className="text-[var(--text-secondary)]">RSS</div>
      <div className="text-right tabular-nums">{fmtMbFromKb(mem?.residentSet)}</div>

      <div className="text-[var(--text-secondary)]">Private</div>
      <div className="text-right tabular-nums">{fmtMbFromKb(mem?.private)}</div>

      <div className="text-[var(--text-secondary)]">Lag p95</div>
      <div className="text-right tabular-nums">{typeof lag?.p95 === 'number' ? `${lag.p95.toFixed(0)} ms` : '—'}</div>

      <div className="text-[var(--text-secondary)]">Lag max</div>
      <div className="text-right tabular-nums">{typeof lag?.max === 'number' ? `${lag.max.toFixed(0)} ms` : '—'}</div>
    </div>
  )
}

export default function DiagnosticsOverlay({ enabled }: { enabled: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const { latest, error, series } = useDiagnosticsOverlay({ enabled, intervalMs: 1000, maxPoints: 120 })

  const cpuValues = series.cpu.map((p) => p.v)
  const memValues = series.memoryMb.map((p) => p.v)
  const lagValues = series.lagP95.map((p) => p.v)

  if (!enabled) return null

  return (
    <div
      className="fixed bottom-3 right-3 z-[9999] pointer-events-none"
      aria-hidden={false}
    >
      <div
        className={
          'pointer-events-auto w-[300px] rounded-xl border border-white/10 bg-black/60 backdrop-blur text-white shadow-xl ' +
          (expanded ? 'p-3' : 'p-2')
        }
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconCpu className="h-4 w-4 text-brand-300" />
            <div className="text-[12px] font-semibold">Diagnostics</div>
          </div>

          <button
            type="button"
            className="text-[11px] text-white/80 hover:text-white"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Minimize' : 'Expand'}
          >
            {expanded ? <IconMinimize className="h-4 w-4" /> : <IconMaximize className="h-4 w-4" />}
          </button>
        </div>

        {error ? <div className="mt-2 text-[11px] text-red-300">{error}</div> : null}

        {!expanded ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-[11px] text-white/80">CPU</div>
            <div className="flex-1" />
            <div className="text-[11px] tabular-nums">{fmtNumber(latest?.appMetrics?.cpu?.percentCPUUsage, 1)}%</div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <SnapshotRows latest={latest} />

            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-white/80">CPU %</div>
                <div className="text-[11px] tabular-nums">{fmtNumber(latest?.appMetrics?.cpu?.percentCPUUsage, 1)}%</div>
              </div>
              <MiniSparkline values={cpuValues} />

              <div className="flex items-center justify-between">
                <div className="text-[11px] text-white/80">Memory (MB)</div>
                <div className="text-[11px] tabular-nums">{fmtMbFromKb(latest?.processMemoryInfo?.residentSet)}</div>
              </div>
              <MiniSparkline values={memValues} />

              <div className="flex items-center justify-between">
                <div className="text-[11px] text-white/80">Event-loop lag p95 (ms)</div>
                <div className="text-[11px] tabular-nums">
                  {typeof latest?.eventLoopLagMs?.p95 === 'number' ? latest.eventLoopLagMs.p95.toFixed(0) : '—'}
                </div>
              </div>
              <MiniSparkline values={lagValues} />
            </div>

            <div className="text-[10px] text-white/60">
              Tip: when a spike happens, take a screenshot and note the time (shown by OS clock).
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
