import React, { useEffect, useRef, useState } from 'react'
import Spinner from '../../components/ui/Spinner'
import { GitUnifiedBranch, GitDiffSummary } from 'thefactory-tools'
import { gitService } from '@renderer/services/gitService'
import { GitLocalChanges } from './GitLocalChanges'
import { ResizeHandle } from '../../components/ui/ResizeHandle'
import { StructuredUnifiedDiff } from '@renderer/components/chat/tool-popups/diffUtils'
import { GitCommitGraph } from './GitCommitGraph'
import { GitCommitChanges, getFilePatch } from './GitCommitChanges'
import { IconFileAdded, IconFileDeleted, IconFileModified } from '../../components/ui/icons/Icons'

function StatusIcon({ status, className = 'w-4 h-4 flex-none' }: { status?: string; className?: string }) {
  if (status === 'A') return <IconFileAdded className={className} />
  if (status === 'D') return <IconFileDeleted className={className} />
  return <IconFileModified className={className} />
}

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
  const [stashLoading, setStashLoading] = useState(false)
  const [stashDiff, setStashDiff] = useState<GitDiffSummary | undefined>(undefined)
  const [stashError, setStashError] = useState<string | undefined>(undefined)
  const [selectedStashFile, setSelectedStashFile] = useState<string | null>(null)

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

  useEffect(() => {
    if (!projectId || !selectedStashRef) {
      setStashDiff(undefined)
      setStashError(undefined)
      setSelectedStashFile(null)
      return
    }

    let isMounted = true
    setStashLoading(true)
    setStashError(undefined)
    setSelectedStashFile(null)

    // A stash diff can be obtained by comparing its parent to itself
    gitService
      .getBranchDiffSummary(projectId, {
        baseRef: `${selectedStashRef}^`,
        headRef: selectedStashRef,
        includePatch: true,
      })
      .then((diff) => {
        if (!isMounted) return
        setStashDiff(diff)
        if (diff.files.length > 0) {
          setSelectedStashFile(diff.files[0].path)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setStashError(err?.message || 'Failed to load stash diff')
      })
      .finally(() => {
        if (!isMounted) return
        setStashLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [projectId, selectedStashRef])

  // Split-pane layout for Stash Details
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useState(300)
  const stashResizeRef = useRef<{ startX: number; startW: number } | null>(null)

  const onStashResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    stashResizeRef.current = { startX: e.clientX, startW: leftWidth }

    const onMove = (ev: PointerEvent) => {
      const st = stashResizeRef.current
      if (!st) return
      const dx = ev.clientX - st.startX
      const newW = st.startW + dx
      setLeftWidth(Math.max(150, Math.min(newW, 600)))
    }
    const onUp = () => {
      stashResizeRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Reset selected commit when branch changes so it defaults to top
  useEffect(() => {
    setSelectedCommitSha(undefined)
  }, [selectedBranch?.name])

  const activeStashFile = stashDiff?.files.find((f) => f.path === selectedStashFile)
  const stashFilePatch = activeStashFile?.patch || getFilePatch(stashDiff?.patch, activeStashFile?.path || '')

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
            <div className="flex-1 min-h-0" ref={containerRef}>
              {stashLoading ? (
                <div className="p-4 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                  <Spinner /> Loading stash details…
                </div>
              ) : stashError ? (
                <div className="p-4 text-sm text-red-700 dark:text-red-200">Failed to load stash: {stashError}</div>
              ) : stashDiff ? (
                <div className="flex min-h-0 h-full">
                  <div
                    className="flex flex-col min-h-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/50"
                    style={{ width: leftWidth }}
                  >
                    <div className="bg-neutral-100 dark:bg-neutral-800/50 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wide">
                      Files ({stashDiff.files.length})
                    </div>
                    <div className="divide-y divide-neutral-200 dark:divide-neutral-800 overflow-auto flex-1 p-1">
                      {stashDiff.files.map((f, i) => {
                        const isSelected = f.path === selectedStashFile
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer rounded-md ${
                              isSelected
                                ? 'bg-sky-50 dark:bg-sky-900/25 text-sky-900 dark:text-sky-100'
                                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                            }`}
                            onClick={() => setSelectedStashFile(f.path)}
                          >
                            <StatusIcon status={f.status} />
                            <span className="truncate flex-1">{f.path}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  <ResizeHandle orientation="vertical" onResizeStart={onStashResizeStart} />
                  
                  <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-white dark:bg-neutral-900">
                    {activeStashFile ? (
                      stashFilePatch ? (
                        <div className="flex-1 min-h-0 overflow-auto">
                          <StructuredUnifiedDiff
                            patch={stashFilePatch}
                            intraline="word"
                          />
                        </div>
                      ) : (
                        <div className="p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center justify-center h-full">
                          No diff available (possibly binary or identical).
                        </div>
                      )
                    ) : (
                      <div className="p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center justify-center h-full">
                        Select a file to view its diff.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="p-4 text-sm text-neutral-600 dark:text-neutral-300">Select a branch or stash from the sidebar.</div>
        )}
      </div>
    </div>
  )
}
