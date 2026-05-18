import { useEffect, useRef, useState } from 'react'
import { useApi } from '@core/contexts/ApiContext'

type Frame = { ts: number }

/**
 * Tiny live perf overlay — fps from `requestAnimationFrame`, JS heap usage when
 * the browser exposes `performance.memory`, and the WebSocket connection state
 * from `ApiContext`. Toggle with `Ctrl/Cmd+Shift+D`.
 *
 * Mounts a single hidden div until activated; keeps the cost negligible when
 * not in use.
 */
export default function DiagnosticsOverlay() {
  const [open, setOpen] = useState(false)
  const [fps, setFps] = useState(0)
  const [heapUsedMB, setHeapUsedMB] = useState<number | null>(null)
  const frames = useRef<Frame[]>([])
  const { wsState } = useApi()

  // Toggle hotkey
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // FPS sampler — only running when the overlay is open.
  useEffect(() => {
    if (!open) return
    let raf = 0
    const tick = () => {
      const now = performance.now()
      const buf = frames.current
      buf.push({ ts: now })
      while (buf.length > 0 && now - buf[0].ts > 1000) buf.shift()
      setFps(buf.length)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open])

  // Heap sampler at 1Hz.
  useEffect(() => {
    if (!open) return
    const sample = () => {
      const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
      setHeapUsedMB(m ? Math.round(m.usedJSHeapSize / (1024 * 1024)) : null)
    }
    sample()
    const id = window.setInterval(sample, 1000)
    return () => window.clearInterval(id)
  }, [open])

  if (!open) return null
  return (
    <div
      className="fixed bottom-3 right-3 z-50 rounded-md border px-3 py-2 text-xs font-mono shadow-lg"
      style={{
        background: 'var(--surface-overlay)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-primary)',
        minWidth: 180,
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <strong className="text-[10px] uppercase tracking-wide opacity-70">Diagnostics</strong>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="opacity-60 hover:opacity-100"
          aria-label="Close diagnostics"
        >
          ×
        </button>
      </div>
      <Row label="fps" value={fps.toString()} />
      <Row label="heap" value={heapUsedMB === null ? 'n/a' : `${heapUsedMB} MB`} />
      <Row label="ws" value={wsState} />
      <div className="text-[10px] opacity-60 mt-1">Ctrl/Cmd+Shift+D to toggle</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 tabular-nums">
      <span className="opacity-60">{label}</span>
      <span>{value}</span>
    </div>
  )
}
