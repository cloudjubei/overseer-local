import React, { useEffect, useState } from 'react'
import Spinner from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { GitUnifiedBranch, GitDiffSummary } from 'thefactory-tools'
import { gitService } from '@renderer/services/gitService'

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

  useEffect(() => {
    if (!projectId || !selectedStashRef) {
      setStashDiff(undefined)
      setStashError(undefined)
      return
    }

    let isMounted = true
    setStashLoading(true)
    setStashError(undefined)

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

  const handleApplyStash = async () => {
    if (!projectId || !selectedStashRef) return
    try {
      const res = await gitService.applyStash(projectId, { stashRef: selectedStashRef })
      if (!res?.ok) {
        alert(`Apply stash failed: ${res?.error || 'Unknown error'}`)
      } else {
        onRefresh()
      }
    } catch (e: any) {
      alert(`Apply stash failed: ${e?.message}`)
    }
  }

  const handleDeleteStash = async () => {
    if (!projectId || !selectedStashRef) return
    try {
      const res = await gitService.removeStash(projectId, { stashRef: selectedStashRef })
      if (!res?.ok) {
        alert(`Delete stash failed: ${res?.error || 'Unknown error'}`)
      } else {
        onRefresh()
      }
    } catch (e: any) {
      alert(`Delete stash failed: ${e?.message}`)
    }
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {selectedBranch ? 'Branch' : selectedStashRef ? 'Stash' : 'Git'} details
          </div>
          <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
            {selectedBranch
              ? `${selectedBranch.name}${selectedBranch.current ? ' (current)' : ''}`
              : selectedStashRef
                ? selectedStashRef
                : '—'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onRefresh} disabled={loading || stashLoading}>
            Refresh
          </Button>
          <Button variant="secondary" onClick={onGoProject}>
            Project
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {!projectId ? (
          <div className="text-sm text-neutral-600 dark:text-neutral-300">No active project.</div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <Spinner /> Loading branches…
          </div>
        ) : error ? (
          <div className="text-sm text-red-700 dark:text-red-200">Failed to load branches: {error}</div>
        ) : selectedBranch ? (
          <div className="space-y-3">
            <div className="text-sm">
              <div className="font-medium text-neutral-800 dark:text-neutral-200">{selectedBranch.name}</div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                {selectedBranch.current
                  ? 'You are currently on this branch.'
                  : `Base: ${currentBranch?.name || 'main'} → Head: ${selectedBranch.name}`}
              </div>
            </div>

            {!selectedBranch.current ? (
              <div className="rounded border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wide">
                  Merge preview
                </div>
                <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                  Diffs and analyses placeholders are shown in the merge modal.
                </div>
                <div className="mt-3">
                  <Button
                    variant="primary"
                    onClick={() => onOpenMerge(currentBranch?.name || 'main', selectedBranch.name)}
                  >
                    Open merge…
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded border border-neutral-200 dark:border-neutral-800 p-3">
                <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wide">
                  Working tree
                </div>
                <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                  {checkingClean
                    ? 'Checking…'
                    : isClean === true
                      ? 'Clean. Ready to commit.'
                      : isClean === false
                        ? 'Dirty. Commit or discard changes.'
                        : 'Unknown status.'}
                </div>
              </div>
            )}
          </div>
        ) : selectedStashRef ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={handleApplyStash} disabled={stashLoading}>
                Apply Stash
              </Button>
              <Button variant="secondary" onClick={handleDeleteStash} disabled={stashLoading}>
                Delete Stash
              </Button>
            </div>

            {stashLoading ? (
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                <Spinner /> Loading stash details…
              </div>
            ) : stashError ? (
              <div className="text-sm text-red-700 dark:text-red-200">Failed to load stash: {stashError}</div>
            ) : stashDiff ? (
              <div className="rounded border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                <div className="bg-neutral-50 dark:bg-neutral-900/40 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wide">
                  Files ({stashDiff.files.length})
                </div>
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {stashDiff.files.map((f, i) => (
                    <div key={i} className="px-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono px-1 bg-neutral-100 dark:bg-neutral-800 rounded">
                          {f.status}
                        </span>
                        <span className="text-sm text-neutral-800 dark:text-neutral-200">{f.path}</span>
                      </div>
                      {f.patch && (
                        <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 p-2 rounded overflow-auto max-h-64">
                          {f.patch}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-neutral-600 dark:text-neutral-300">Select a branch or stash from the sidebar.</div>
        )}
      </div>
    </div>
  )
}
