import React, { useEffect, useRef, useState } from 'react'
import Spinner from '../../components/ui/Spinner'
import { GitUnifiedBranch } from 'thefactory-tools'
import { GitLocalChanges } from './GitLocalChanges'
import { ResizeHandle } from '../../components/ui/ResizeHandle'
import { GitCommitGraph } from './GitCommitGraph'
import { GitCommitChanges } from './GitCommitChanges'

export function GitBranchDetailsPanel({
  projectId,
  loading,
  error,
  selectedBranch,
  selectedStashRef,
  currentBranch,
  checkingClean,
  isClean,
  changedCount,
  onRefresh,
  onGoProject,
  onOpenMerge,
  onSelectBranchBySha,
}: {
  projectId?: string
  loading: boolean
  error?: string
  selectedBranch?: GitUnifiedBranch
  selectedStashRef?: string
  currentBranch?: GitUnifiedBranch
  checkingClean: boolean
  isClean?: boolean
  changedCount: number
  onRefresh: () => void
  onGoProject: () => void
  onOpenMerge: (baseRef: string, headRef: string) => void
  onSelectBranchBySha?: (sha: string) => void
}) {
  // selectedCommitSha is the row highlighted in the graph AND shown in the diff panel below.
  // It is driven from outside (branch change → tip sha, or uncommitted changes → 'UNCOMMITTED'),
  // and can also be changed by the user clicking a row directly.
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | undefined>(undefined)

  const isDirty = changedCount > 0

  // When the selected branch changes, jump to:
  //   • 'UNCOMMITTED' if there are working-tree changes (only relevant for the current branch)
  //   • the branch tip sha otherwise
  useEffect(() => {
    if (!selectedBranch) {
      setSelectedCommitSha(undefined)
      return
    }
    const isCurrent = !!selectedBranch.current
    if (isCurrent && isDirty) {
      setSelectedCommitSha('UNCOMMITTED')
    } else {
      // localSha is the tip of the local branch; fall back to remoteSha for remote-only branches
      const tip = selectedBranch.localSha ?? selectedBranch.remoteSha
      setSelectedCommitSha(tip)
    }
  // Re-run when the branch name changes OR when dirty-ness flips for the current branch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch?.name, isDirty])

  // The SHA to scroll the graph to. For UNCOMMITTED there's no row to scroll to.
  const scrollToSha = selectedCommitSha === 'UNCOMMITTED' ? undefined : selectedCommitSha

  // ─── Vertical resizer ──────────────────────────────────────────────────────
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [topHeightPx, setTopHeightPx] = useState<number>(250)
  const resizeRef = useRef<{ startY: number; startH: number; containerH: number } | null>(null)

  const onTopResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const containerH = rootRef.current?.clientHeight || window.innerHeight
    resizeRef.current = { startY: e.clientY, startH: topHeightPx, containerH }

    const onMove = (ev: PointerEvent) => {
      const st = resizeRef.current
      if (!st) return
      const minTop = 60
      const maxTop = Math.max(minTop, Math.floor(st.containerH * 0.8))
      setTopHeightPx(Math.max(minTop, Math.min(maxTop, st.startH + ev.clientY - st.startY)))
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  useEffect(() => {
    const clamp = () => {
      const h = rootRef.current?.clientHeight || window.innerHeight
      const minTop = 60
      const maxTop = Math.max(minTop, Math.floor(h * 0.8))
      setTopHeightPx((v) => Math.max(minTop, Math.min(maxTop, v)))
    }
    clamp()
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [])

  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0" ref={rootRef}>
      <div className="flex-1 min-h-0 overflow-auto flex flex-col">
        {!projectId ? (
          <div className="p-4 text-sm text-neutral-600 dark:text-neutral-300">No active project.</div>
        ) : loading ? (
          <div className="p-4 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <Spinner /> Loading branches…
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-red-700 dark:text-red-200">Failed to load branches: {error}</div>
        ) : selectedBranch ? (
          <div className="flex flex-col min-h-0 h-full w-full">
            {/* Top: commit graph */}
            <div
              className="bg-neutral-50 dark:bg-neutral-900/40 overflow-hidden flex flex-col"
              style={{ height: topHeightPx }}
            >
              <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center bg-white dark:bg-neutral-900 flex-shrink-0">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wide">
                  Commit graph
                </span>
              </div>
              <GitCommitGraph
                projectId={projectId}
                uncommittedChanges={isDirty}
                selectedCommitSha={selectedCommitSha}
                scrollToSha={scrollToSha}
                onSelectCommit={setSelectedCommitSha}
                onSelectBranchBySha={onSelectBranchBySha}
              />
            </div>

            <ResizeHandle
              orientation="horizontal"
              className="relative z-10 flex-shrink-0"
              onResizeStart={onTopResizeStart}
              hitBoxSize={4}
            />

            {/* Bottom: diff for selected commit or local working-tree changes */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col w-full relative">
              {!selectedCommitSha || selectedCommitSha === 'UNCOMMITTED' ? (
                <GitLocalChanges projectId={projectId} className="flex-1 min-h-0" />
              ) : (
                <GitCommitChanges projectId={projectId} commitSha={selectedCommitSha} className="flex-1 min-h-0" />
              )}
            </div>
          </div>
        ) : selectedStashRef ? (
          <div className="flex flex-col h-full min-h-0">
            <GitCommitChanges projectId={projectId} commitSha={selectedStashRef} className="flex-1 min-h-0" />
          </div>
        ) : (
          <div className="p-4 text-sm text-neutral-600 dark:text-neutral-300">
            Select a branch or stash from the sidebar.
          </div>
        )}
      </div>
    </div>
  )
}
