import { useCallback, useEffect, useRef, useState } from 'react'
import { useActiveProject, useProjectAppView, type BridgeRequest } from 'thefactory-ui/headless'
import { ProjectAppView } from 'thefactory-ui/web'

type BridgeNotice = { message: string; variant: string }

/**
 * Desktop peer of the App tab. Mirrors web's `ProjectAppTab` 1:1 — the
 * Electron renderer is Chromium, so it reuses the web `ProjectAppView` +
 * the same App↔Overseer bridge handler (v1: `ready` + `toast`).
 */
export default function ProjectAppTab() {
  const { projectId } = useActiveProject()
  const { url, key, error } = useProjectAppView(projectId)

  const [connected, setConnected] = useState(false)
  const [notice, setNotice] = useState<BridgeNotice | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setConnected(false)
    setNotice(null)
  }, [projectId, key])

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
  }, [])

  const onBridgeMessage = useCallback((req: BridgeRequest) => {
    switch (req.type) {
      case 'overseer:ready':
        setConnected(true)
        return
      case 'overseer:toast': {
        const p = (req.payload ?? {}) as { message?: unknown; variant?: unknown }
        const message = typeof p.message === 'string' ? p.message : ''
        const variant = typeof p.variant === 'string' ? p.variant : 'info'
        setNotice({ message, variant })
        if (noticeTimer.current) clearTimeout(noticeTimer.current)
        noticeTimer.current = setTimeout(() => setNotice(null), 4000)
        return { shown: true }
      }
      default:
        throw new Error(`Unsupported bridge message: ${req.type}`)
    }
  }, [])

  return (
    <div className="relative w-full h-full bg-[var(--bg-surface)]">
      {connected && (
        <div className="absolute top-2 right-2 z-10 rounded-full bg-(--surface-base) border border-(--border-subtle) px-2.5 py-1 text-xs text-(--text-secondary) shadow">
          ● App connected
        </div>
      )}
      {notice && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 rounded-md bg-(--surface-base) border border-(--border-subtle) px-3 py-2 text-sm shadow">
          <span className="font-medium">App says:</span> {notice.message}
        </div>
      )}
      <ProjectAppView
        url={url}
        remountKey={key}
        onBridgeMessage={onBridgeMessage}
        fallback={
          <div className="flex h-full items-center justify-center p-8 text-center text-[var(--text-secondary)]">
            <div>
              <p className="text-base font-medium text-[var(--text-primary)]">
                {error ? 'App view unavailable' : 'No app to view yet'}
              </p>
              <p className="mt-2 text-sm">
                {error
                  ? error.message
                  : 'Run a story to scaffold this project’s app surface, then come back to this tab.'}
              </p>
            </div>
          </div>
        }
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
