import React from 'react'
import { Button } from '../../components/ui/Button'
import { GitUnifiedBranch } from 'thefactory-tools'

export function GitRightActionsPanel({
  selectedBranch,
  selectedStashRef,
  checkingClean,
  isClean,
  changedCount,
  onRefresh,
  onSwitchToBranch,
  onOpenMerge,
  currentBranchName,
}: {
  selectedBranch?: GitUnifiedBranch
  selectedStashRef?: string
  checkingClean: boolean
  isClean?: boolean
  changedCount: number
  onRefresh: () => void
  onSwitchToBranch: (name: string) => void
  onOpenMerge: (baseRef: string, headRef: string) => void
  currentBranchName?: string
}) {
  return (
    <div className="w-[280px] lg:w-[320px] shrink-0 border-l border-neutral-200 dark:border-neutral-800 flex flex-col min-h-0">
      <div className="px-3 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Actions</div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
          {selectedBranch ? `Branch: ${selectedBranch.name}` : selectedStashRef ? `Stash: ${selectedStashRef}` : '—'}
        </div>
      </div>
      <div className="p-3 flex-1 min-h-0 overflow-auto">
        {selectedBranch ? (
          <div className="flex flex-col gap-2">
            {selectedBranch.current ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    alert('Use the Commit button on the current branch row (hover) for now.')
                  }}
                  disabled={checkingClean}
                >
                  Commit…
                </Button>
                <Button variant="secondary" onClick={onRefresh}>
                  Refresh
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => onSwitchToBranch(selectedBranch.name)} disabled={!isClean}>
                  Switch to branch
                </Button>
                <Button
                  variant="primary"
                  onClick={() => onOpenMerge(currentBranchName || 'main', selectedBranch.name)}
                  disabled={!currentBranchName}
                >
                  Merge into {currentBranchName || 'current'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    alert('Delete is available on the branch row (hover) for now.')
                  }}
                >
                  Delete branch…
                </Button>
              </>
            )}
          </div>
        ) : selectedStashRef ? (
          <div className="text-sm text-neutral-700 dark:text-neutral-200">Stash actions coming soon.</div>
        ) : (
          <div className="text-sm text-neutral-500 dark:text-neutral-400">Select a branch to see actions.</div>
        )}

        <div className="mt-6">
          <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wide">Repo</div>
          <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
            Working tree: {checkingClean ? 'checking…' : isClean === true ? 'clean' : isClean === false ? 'dirty' : '—'}
            {typeof changedCount === 'number' && changedCount > 0 ? ` • ${changedCount} changed` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
