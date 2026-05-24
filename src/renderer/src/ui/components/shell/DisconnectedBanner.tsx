import { useEffect, useState } from 'react'
import { useApi } from '@core/contexts/ApiContext'
import { useAuth } from '@core/contexts/AuthContext'

const GRACE_MS = 3000

/**
 * Persistent strip surfaced when the renderer's WebSocket has been non-`open`
 * for `GRACE_MS` and the user is authenticated. The grace window collapses
 * transient flickers (e.g. a refetch that briefly drops the socket) so the
 * banner only paints on genuine disconnects.
 *
 * `reconnecting-websocket` (wired by [`WsClient`](../../../api/WsClient.ts))
 * handles the actual reconnect; this component is informational only.
 */
export default function DisconnectedBanner() {
  const { token, baseUrl } = useAuth()
  const { wsState } = useApi()
  const stableDown = useStableNonOpen(wsState, GRACE_MS)

  // Only meaningful once both halves of the connection are configured. Before
  // that, the LoginScreen owns the user's attention.
  if (!token || !baseUrl) return null
  if (!stableDown) return null

  const { label, sublabel } = describe(wsState)

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 px-4 py-1.5 text-xs border-b"
      style={{
        background: 'var(--color-amber-50, #fffbeb)',
        color: 'var(--color-amber-900, #78350f)',
        borderColor: 'var(--color-amber-200, #fde68a)',
      }}
    >
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: dotColor(wsState) }} aria-hidden />
      <span className="font-medium">{label}</span>
      <span className="opacity-80">{sublabel}</span>
    </div>
  )
}

function describe(state: string): { label: string; sublabel: string } {
  switch (state) {
    case 'connecting':
      return { label: 'Connecting to backend…', sublabel: 'Live updates will resume once the connection is established.' }
    case 'closed':
      return { label: 'Disconnected from backend.', sublabel: 'Reconnecting automatically; views show their last-known data.' }
    case 'idle':
    default:
      return { label: 'Not connected.', sublabel: 'Live updates are paused.' }
  }
}

function dotColor(state: string): string {
  if (state === 'connecting') return 'var(--color-orange-500, #f59e0b)'
  return 'var(--color-gray-400, #9ca3af)'
}

function useStableNonOpen(wsState: string, graceMs: number): boolean {
  const [down, setDown] = useState(false)
  useEffect(() => {
    if (wsState === 'open') {
      setDown(false)
      return
    }
    const t = setTimeout(() => setDown(true), graceMs)
    return () => clearTimeout(t)
  }, [wsState, graceMs])
  return down
}
