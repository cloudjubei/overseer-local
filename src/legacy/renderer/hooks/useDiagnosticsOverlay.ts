import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiagnosticsSnapshot } from 'src/types/diagnostics'
import { diagnosticsService } from '../services/diagnosticsService'

type SeriesPoint = { t: number; v: number }

function pushPoint(series: SeriesPoint[], point: SeriesPoint, maxPoints: number) {
  series.push(point)
  if (series.length > maxPoints) series.splice(0, series.length - maxPoints)
}

export function useDiagnosticsOverlay(options?: {
  enabled?: boolean
  intervalMs?: number
  maxPoints?: number
}) {
  const enabled = options?.enabled ?? false
  const intervalMs = options?.intervalMs ?? 1000
  const maxPoints = options?.maxPoints ?? 120

  const [latest, setLatest] = useState<DiagnosticsSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cpuSeriesRef = useRef<SeriesPoint[]>([])
  const memSeriesRef = useRef<SeriesPoint[]>([])
  const lagSeriesRef = useRef<SeriesPoint[]>([])

  // We need state to trigger re-renders when the series updates
  const [renderTick, setRenderTick] = useState(0)

  const series = useMemo(
    () => ({
      cpu: cpuSeriesRef.current,
      memoryMb: memSeriesRef.current,
      lagP95: lagSeriesRef.current,
    }),
    [renderTick],
  )

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const tick = async () => {
      try {
        const snap = await diagnosticsService.getSnapshot()
        if (cancelled) return
        setLatest(snap)
        setError(null)

        const t = snap.timestamp
        const cpu = snap.appMetrics?.cpu?.percentCPUUsage
        const memKb = snap.appMetrics?.memory?.workingSetSize
        const lag = snap.eventLoopLagMs?.p95

        // The hooks memoize the refs array instance but we need React to trigger a re-render
        // when points are added, so we create a new array or use state updates to force re-render.
        if (typeof cpu === 'number') cpuSeriesRef.current = [...cpuSeriesRef.current, { t, v: cpu }].slice(-maxPoints)
        if (typeof memKb === 'number') memSeriesRef.current = [...memSeriesRef.current, { t, v: memKb / 1024 }].slice(-maxPoints)
        if (typeof lag === 'number') lagSeriesRef.current = [...lagSeriesRef.current, { t, v: lag }].slice(-maxPoints)

        setRenderTick((v) => v + 1)
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message ?? String(e))
      }
    }

    // immediate + interval
    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled, intervalMs, maxPoints])

  return { latest, error, series }
}
