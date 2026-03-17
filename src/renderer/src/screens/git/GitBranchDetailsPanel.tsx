import React, { useEffect, useRef, useState } from 'react'
import Spinner from '../../components/ui/Spinner'
import { GitUnifiedBranch, GitDiffSummary } from 'thefactory-tools'
import { gitService } from '@renderer/services/gitService'
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
}) {
  // Track the currently selected commit in the graph
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | undefined>(undefined)

  // Vertical resizer for branch view: top graph stub / bottom local changes
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
      const dy = ev.clientY - st.startY
      const next = st.startH + dy
      const minTop = 60
      const maxTop = Math.max(minTop, Math.floor(st.containerH * 0.8))
      setTopHeightPx(Math.max(minTop, Math.min(maxTop, next)))
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Clamp on window resize
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

  // Reset selected commit when branch changes so it defaults to top
  useEffect(() => {
    setSelectedCommitSha(undefined)
  }, [selectedBranch?.name])

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
            {/* Top graph */}
            <div
              className="bg-neutral-50 dark:bg-neutral-900/40 overflow-hidden flex flex-col"
              style={{ height: topHeightPx }}
            >
              <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-900 flex-shrink-0">
                <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wide">
                  Commit graph
                </div>
              </div>
              <GitCommitGraph 
                projectId={projectId} 
                uncommittedChanges={changedCount > 0}
                selectedCommitSha={selectedCommitSha} 
                onSelectCommit={setSelectedCommitSha} 
              />
            </div>

            {/* Resize handle */}
            <ResizeHandle
              orientation="horizontal"
              className="relative z-10 flex-shrink-0"
              onResizeStart={onTopResizeStart}
              hitBoxSize={4}
            />

            {/* Bottom panel: either commit diffs or local changes */}
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
          <div className="p-4 text-sm text-neutral-600 dark:text-neutral-300">Select a branch or stash from the sidebar.</div>
        )}
      </div>
    </div>
  )
}
