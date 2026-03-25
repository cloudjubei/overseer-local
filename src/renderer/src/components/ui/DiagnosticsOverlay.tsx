import { useMemo, useState, useRef } from 'react'
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

function getCpuColorClass(cpu: number | undefined) {
  if (typeof cpu !== 'number') return ''
  if (cpu >= 80) return 'text-red-600 font-bold'
  if (cpu >= 60) return 'text-red-400 font-bold'
  if (cpu >= 40) return 'text-orange-400 font-bold'
  if (cpu >= 20) return 'text-yellow-400 font-semibold'
  return ''
}

function MiniSparkline({ values, width = 276, height = 36 }: { values: number[]; width?: number; height?: number }) {
  const path = useMemo(() => {
    if (!values || values.length < 2) return ''
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
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block mt-1">
      <rect x={0} y={0} width={width} height={height} rx={6} className="fill-white/5" />
      {path ? <path d={path} className="stroke-white" fill="none" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" /> : null}
    </svg>
  )
}


export default function DiagnosticsOverlay({ enabled }: { enabled: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [cpuListExpanded, setCpuListExpanded] = useState(false)
  const [ramListExpanded, setRamListExpanded] = useState(false)
  
  // Draggable state (using right/bottom coordinates)
  const [pos, setPos] = useState({ right: 12, bottom: 12 })
  const dragRef = useRef<{ startX: number; startY: number; startRight: number; startBottom: number } | null>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag on left click
    if (e.button !== 0) return
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: pos.right,
      startBottom: pos.bottom,
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setPos({
      right: Math.max(0, dragRef.current.startRight - dx),
      bottom: Math.max(0, dragRef.current.startBottom - dy),
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    dragRef.current = null
    const target = e.currentTarget as HTMLElement
    target.releasePointerCapture(e.pointerId)
  }

  const { latest, error, series } = useDiagnosticsOverlay({ enabled, intervalMs: 1000, maxPoints: 120 })

  const cpuValues = series.cpu.map((p) => p.v)
  const memValues = series.memoryMb.map((p) => p.v)
  const lagValues = series.lagP95.map((p) => p.v)

  if (!enabled) return null

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ right: `${pos.right}px`, bottom: `${pos.bottom}px` }}
      aria-hidden={false}
    >
      <div
        className={
          'pointer-events-auto w-[300px] rounded-xl border border-white/10 bg-black/60 backdrop-blur text-white shadow-xl ' +
          (expanded ? 'p-3' : 'p-2')
        }
      >
        <div 
          className="flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="flex items-center gap-2">
            <IconCpu className="h-4 w-4 text-brand-300" />
            <div className="text-[12px] font-semibold">Diagnostics</div>
          </div>

          <button
            type="button"
            className="text-[11px] text-white/80 hover:text-white cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Minimize' : 'Expand'}
          >
            {expanded ? <IconMinimize className="h-4 w-4 pointer-events-none" /> : <IconMaximize className="h-4 w-4 pointer-events-none" />}
          </button>
        </div>

        {error ? <div className="mt-2 text-[11px] text-red-300">{error}</div> : null}

        {!expanded ? (
          <div className="mt-2 text-[11px] tabular-nums text-white/80 text-center">
            <span className={getCpuColorClass(latest?.appMetrics?.cpu?.percentCPUUsage)}>CPU {fmtNumber(latest?.appMetrics?.cpu?.percentCPUUsage, 1)}%</span> | RAM {fmtMbFromKb(latest?.appMetrics?.memory?.workingSetSize)} | LAG {typeof latest?.eventLoopLagMs?.p95 === 'number' ? latest.eventLoopLagMs.p95.toFixed(0) : '—'} ms
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-white/80">CPU %</div>
                <div className={`text-[11px] tabular-nums ${getCpuColorClass(latest?.appMetrics?.cpu?.percentCPUUsage)}`}>{fmtNumber(latest?.appMetrics?.cpu?.percentCPUUsage, 1)}%</div>
              </div>
              <MiniSparkline values={cpuValues} />

              <div className="flex items-center justify-between">
                <div className="text-[11px] text-white/80">Memory (MB)</div>
                <div className="text-[11px] tabular-nums">{fmtMbFromKb(latest?.appMetrics?.memory?.workingSetSize)}</div>
              </div>
              <MiniSparkline values={memValues} />

              <div className="flex items-center justify-between">
                <div className="text-[11px] text-white/80">Event-loop lag p95 (ms)</div>
                <div className="text-[11px] tabular-nums">
                  {typeof latest?.eventLoopLagMs?.p95 === 'number' ? latest.eventLoopLagMs.p95.toFixed(0) : '—'} ms
                </div>
              </div>
              <MiniSparkline values={lagValues} />
            </div>

            {latest?.topCulprits && (
              <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-3">
                <button 
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => setCpuListExpanded(!cpuListExpanded)}
                >
                  <div className="text-[11px] font-semibold text-white/90">Top 3 CPU</div>
                  <div className="text-[10px] text-white/50">{cpuListExpanded ? 'Hide' : 'Show'}</div>
                </button>
                {cpuListExpanded && latest.topCulprits.cpu.map((c, i) => (
                  <div key={`cpu-${i}`} className="flex justify-between items-center text-[10px]">
                    <div className="text-white/70 truncate mr-2" title={c.name}>{c.name || 'Unknown'} (pid {c.pid})</div>
                    <div className="tabular-nums text-white/90">{fmtNumber(c.percentCPUUsage, 1)}%</div>
                  </div>
                ))}
                
                <button 
                  className="flex items-center justify-between w-full text-left mt-2"
                  onClick={() => setRamListExpanded(!ramListExpanded)}
                >
                  <div className="text-[11px] font-semibold text-white/90">Top 3 RAM</div>
                  <div className="text-[10px] text-white/50">{ramListExpanded ? 'Hide' : 'Show'}</div>
                </button>
                {ramListExpanded && latest.topCulprits.memory.map((c, i) => (
                  <div key={`mem-${i}`} className="flex justify-between items-center text-[10px]">
                    <div className="text-white/70 truncate mr-2" title={c.name}>{c.name || 'Unknown'} (pid {c.pid})</div>
                    <div className="tabular-nums text-white/90">{fmtNumber(c.memoryMb, 1)} MB</div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[10px] text-white/60 mt-3">
              Tip: when a spike happens, take a screenshot and note the time (shown by OS clock).
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
