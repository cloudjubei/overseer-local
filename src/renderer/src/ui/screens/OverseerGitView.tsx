import { useEffect, useState, type PointerEvent } from 'react'
import { Alert, Button, GitCommitGraph, ResizeHandle, Tooltip } from 'thefactory-ui/web'
import { IconChevronLeft, IconInfo, IconRefresh } from 'thefactory-ui/web/icons'
import { useOverseerGit } from 'thefactory-ui/headless'
import CommitDiffViewer from '@ui/components/git/CommitDiffViewer'

const AUTOMATION_TOOLTIP =
  'The overseer repo commits automatically (every 10s for non-chat, 60s for chats), squashes daily to `main`, and pushes on the daily schedule. This view is read-only.'

const TOP_HEIGHT_KEY = 'OverseerGitView.commitGraphHeightPx'
const DEFAULT_TOP_HEIGHT = 280

function readNumberLs(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(key)
    if (v === null) return fallback
    const n = parseInt(v, 10)
    return Number.isFinite(n) && n > 0 ? n : fallback
  } catch {
    return fallback
  }
}

function writeNumberLs(key: string, n: number) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, String(Math.round(n)))
  } catch {
    // best-effort
  }
}

export type OverseerGitViewProps = {
  onBack: () => void
}

export default function OverseerGitView({ onBack }: OverseerGitViewProps) {
  const {
    isLoaded,
    loadError,
    log,
    hasMoreLog,
    isLogLoading,
    loadMoreLog,
    fetchCommitDiff,
    refresh,
  } = useOverseerGit()

  const [selectedCommitSha, setSelectedCommitSha] = useState<string | undefined>()

  // Default the selection to the tip once the log lands.
  useEffect(() => {
    if (!selectedCommitSha && log.length > 0) setSelectedCommitSha(log[0].hash)
  }, [log, selectedCommitSha])

  const [topHeightPx, setTopHeightPx] = useState<number>(() =>
    readNumberLs(TOP_HEIGHT_KEY, DEFAULT_TOP_HEIGHT),
  )
  useEffect(() => {
    writeNumberLs(TOP_HEIGHT_KEY, topHeightPx)
  }, [topHeightPx])

  const onTopResizeStart = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = topHeightPx
    const container = (e.currentTarget as HTMLElement).parentElement
    const containerH = container?.clientHeight ?? window.innerHeight
    const onMove = (ev: globalThis.PointerEvent) => {
      const minTop = 80
      const maxTop = Math.max(minTop, Math.floor(containerH * 0.85))
      setTopHeightPx(Math.max(minTop, Math.min(maxTop, startH + ev.clientY - startY)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col">
      <header
        className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">
            <IconChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-semibold">Overseer Git</h2>
          <Tooltip content={<span className="max-w-xs">{AUTOMATION_TOOLTIP}</span>}>
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded opacity-70 hover:opacity-100"
              aria-label="About this view"
            >
              <IconInfo className="h-4 w-4" />
            </span>
          </Tooltip>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} aria-label="Refresh">
          <IconRefresh className="h-4 w-4" />
        </Button>
      </header>

      {loadError ? (
        <div className="p-3">
          <Alert variant="error">
            {loadError.message ?? 'Could not load the overseer git state.'}
          </Alert>
        </div>
      ) : null}

      {!isLoaded ? <p className="p-3 text-sm opacity-70">Loading…</p> : null}

      {isLoaded ? (
        <>
          <section
            className="flex flex-col shrink-0 border-b min-h-0"
            style={{ height: topHeightPx, borderColor: 'var(--border-subtle)' }}
          >
            <GitCommitGraph
              commits={log}
              selectedCommitSha={selectedCommitSha}
              onSelectCommit={setSelectedCommitSha}
              onLoadMore={loadMoreLog}
              loadingMore={isLogLoading}
              hasMore={hasMoreLog}
            />
          </section>

          <ResizeHandle orientation="horizontal" onResizeStart={onTopResizeStart} />

          <section className="flex min-h-0 flex-1 flex-col">
            {selectedCommitSha ? (
              <CommitDiffViewer
                commitSha={selectedCommitSha}
                log={log}
                fetcher={fetchCommitDiff}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-xs opacity-60">
                Select a commit to see its diff.
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
