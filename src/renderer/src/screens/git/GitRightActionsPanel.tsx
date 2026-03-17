import React from 'react'
import { GitUnifiedBranch } from 'thefactory-tools'

import Tooltip from '../../components/ui/Tooltip'
import { IconRefresh } from '../../components/ui/icons/Icons'
import { IconFastMerge } from '../../components/ui/icons/IconFastMerge'
import { IconBranch } from '../../components/ui/icons/IconBranch'

export const ACTIONS_RAIL_WIDTH = 80

function GitActionButton({
  icon,
  label,
  onClick,
  disabled,
  tooltip,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  tooltip?: string
}) {
  const btn = (
    <button
      className={
        'w-[64px] h-[64px] rounded-xl border border-neutral-200 dark:border-neutral-800 ' +
        'bg-white dark:bg-neutral-950/30 ' +
        'hover:bg-neutral-50 dark:hover:bg-neutral-900/40 ' +
        'active:scale-[0.98] transition ' +
        'flex flex-col items-center justify-center gap-1 ' +
        (disabled ? 'opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-neutral-950/30' : '')
      }
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <div className="w-5 h-5 text-neutral-700 dark:text-neutral-200">{icon}</div>
      <div className="text-[10px] leading-3 text-neutral-700 dark:text-neutral-300 text-center px-1">
        {label}
      </div>
    </button>
  )

  return tooltip ? <Tooltip content={tooltip}>{btn}</Tooltip> : btn
}

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
  const canSwitch = isClean === true && !checkingClean

  return (
    <div
      className="shrink-0 border-l border-neutral-200 dark:border-neutral-800 flex flex-col min-h-0 items-center py-2"
      style={{ width: ACTIONS_RAIL_WIDTH }}
    >
      {/* No header, no footer (by design) */}
      <div className="flex flex-col gap-2 items-center">
        <GitActionButton
          icon={<IconRefresh className="w-5 h-5" />}
          label="Refresh"
          onClick={onRefresh}
          disabled={false}
          tooltip={checkingClean ? 'Checking working tree…' : `Working tree: ${isClean === true ? 'clean' : isClean === false ? 'dirty' : '—'}${changedCount > 0 ? ` • ${changedCount} changed` : ''}`}
        />

        {selectedBranch && !selectedBranch.current ? (
          <>
            <GitActionButton
              icon={<IconBranch />}
              label="Switch"
              onClick={() => onSwitchToBranch(selectedBranch.name)}
              disabled={!canSwitch}
              tooltip={canSwitch ? 'Switch to branch' : 'Working tree must be clean to switch'}
            />
            <GitActionButton
              icon={<IconFastMerge />}
              label="Merge"
              onClick={() => onOpenMerge(currentBranchName || 'main', selectedBranch.name)}
              disabled={!currentBranchName}
              tooltip={currentBranchName ? `Merge into ${currentBranchName}` : 'Current branch unknown'}
            />
          </>
        ) : null}

        {selectedBranch && selectedBranch.current ? null : null}
        {selectedStashRef ? null : null}
      </div>
    </div>
  )
}
