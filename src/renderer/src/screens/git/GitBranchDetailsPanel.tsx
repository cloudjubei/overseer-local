import React from 'react'
import Spinner from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { GitUnifiedBranch } from 'thefactory-tools'

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
          <Button variant="secondary" onClick={onRefresh} disabled={loading}>
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
        ) : (
          <div className="text-sm text-neutral-600 dark:text-neutral-300">Select a branch from the sidebar.</div>
        )}
      </div>
    </div>
  )
}
