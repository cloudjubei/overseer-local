import React from 'react'
import Spinner from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import Tooltip from '../../components/ui/Tooltip'
import { IconFastMerge } from '../../components/ui/icons/IconFastMerge'
import { IconDelete } from '../../components/ui/icons/IconDelete'
import { IconCommit } from '../../components/ui/icons/IconCommit'
import { GitUnifiedBranch, GitStashListItem } from 'thefactory-tools'

function Pill({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: 'neutral' | 'blue' | 'green' | 'red'
}) {
  const cls =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200'
      : tone === 'green'
        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200'
        : tone === 'red'
          ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200'
          : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-200'
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${cls} whitespace-nowrap`}>{label}</span>
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-3 pt-3 pb-2">
      <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wide">
        {title}
      </div>
      {subtitle ? <div className="text-neutral-600 dark:text-neutral-400 mt-1">{subtitle}</div> : null}
    </div>
  )
}

function BranchRow({
  branch,
  isSelected,
  equalToCurrent,
  showSwitch,
  canSwitch,
  onSwitch,
  hasPendingChanges,
  onCommit,
  onMerge,
  onDelete,
  onClick,
}: {
  branch: GitUnifiedBranch
  isSelected: boolean
  equalToCurrent?: boolean
  showSwitch?: boolean
  canSwitch?: boolean
  onSwitch?: () => void
  hasPendingChanges?: boolean
  onCommit?: () => void
  onMerge?: () => void
  onDelete?: () => void
  onClick?: () => void
}) {
  const unread = hasPendingChanges
  const rowCls =
    'group flex items-center gap-2 px-3 py-2 rounded cursor-pointer ' +
    (isSelected
      ? 'bg-blue-50/80 dark:bg-blue-900/20'
      : 'hover:bg-neutral-100 dark:hover:bg-neutral-900/40')

  return (
    <div className={rowCls} onClick={onClick}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{branch.name}</div>
          {branch.current ? <Pill label="current" tone="green" /> : null}
          {equalToCurrent && !branch.current ? <Pill label="same" /> : null}
          {unread ? <Pill label="updated" tone="blue" /> : null}
        </div>
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
          {branch.isLocal ? 'local' : ''}
          {branch.isRemote ? (branch.isLocal ? ' + remote' : 'remote') : ''}
          {branch.storyId ? ` • story ${branch.storyId}` : ''}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {branch.current ? (
          <>
            {onCommit ? (
              <Tooltip content="Commit">
                <Button size="icon" variant="ghost" onClick={(e) => (e.stopPropagation(), onCommit())}>
                  <IconCommit />
                </Button>
              </Tooltip>
            ) : null}
          </>
        ) : (
          <>
            {showSwitch ? (
              <Tooltip content={canSwitch ? 'Switch to branch' : 'Working tree must be clean to switch'}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => (e.stopPropagation(), onSwitch?.())}
                  disabled={!canSwitch}
                >
                  Switch
                </Button>
              </Tooltip>
            ) : null}

            {onMerge ? (
              <Tooltip content="Merge">
                <Button size="icon" variant="ghost" onClick={(e) => (e.stopPropagation(), onMerge())}>
                  <IconFastMerge />
                </Button>
              </Tooltip>
            ) : null}

            {onDelete ? (
              <Tooltip content="Delete branch">
                <Button size="icon" variant="ghost" onClick={(e) => (e.stopPropagation(), onDelete())}>
                  <IconDelete />
                </Button>
              </Tooltip>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export function GitSidebarBranches({
  title,
  projectId,
  loading,
  error,
  localBranches,
  stashes,
  current,
  others,
  selectedBranchName,
  selectedStashRef,
  canSwitch,
  isEqualToCurrent,
  onSelectBranch,
  onSelectStash,
  onCommit,
  onMerge,
  onDelete,
  onSwitch,
}: {
  title?: string
  projectId?: string
  loading: boolean
  error?: string
  localBranches: GitUnifiedBranch[]
  stashes?: GitStashListItem[]
  current?: GitUnifiedBranch
  others: GitUnifiedBranch[]
  selectedBranchName?: string
  selectedStashRef?: string
  canSwitch: boolean
  isEqualToCurrent: (b: GitUnifiedBranch) => boolean
  onSelectBranch: (name: string) => void
  onSelectStash: (ref: string) => void
  onCommit: (branchName: string) => void
  onMerge: (baseRef: string, headRef: string) => void
  onDelete: (branchName: string) => void
  onSwitch: (branchName: string) => void
}) {
  return (
    <div className="w-[280px] shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col min-h-0">
      <div className="px-3 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Git</div>
        <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate">{title || '—'}</div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <SectionHeader title="Branches" subtitle="Local branches" />

        {!projectId ? (
          <div className="px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300">No active project.</div>
        ) : loading ? (
          <div className="px-3 py-2 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <Spinner /> Loading…
          </div>
        ) : error ? (
          <div className="px-3 py-2 text-sm text-red-700 dark:text-red-200">Error: {error}</div>
        ) : localBranches.length === 0 ? (
          <div className="px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300">No local branches found.</div>
        ) : (
          <div className="flex flex-col gap-1 px-1 pb-2">
            {current ? (
              <>
                <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Current
                </div>
                <BranchRow
                  branch={current}
                  isSelected={selectedBranchName === current.name && !selectedStashRef}
                  equalToCurrent={false}
                  showSwitch={false}
                  hasPendingChanges={false}
                  onCommit={() => onCommit(current.name)}
                  onClick={() => onSelectBranch(current.name)}
                />
                <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Local
                </div>
              </>
            ) : null}

            {others.map((b) => (
              <BranchRow
                key={b.name}
                branch={b}
                isSelected={selectedBranchName === b.name && !selectedStashRef}
                equalToCurrent={isEqualToCurrent(b)}
                showSwitch
                canSwitch={canSwitch}
                onSwitch={() => onSwitch(b.name)}
                hasPendingChanges={false}
                onMerge={() => onMerge(current?.name || 'main', b.name)}
                onDelete={() => onDelete(b.name)}
                onClick={() => onSelectBranch(b.name)}
              />
            ))}

            {stashes && stashes.length > 0 ? (
              <>
                <div className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Stashes
                </div>
                {stashes.map((s) => (
                  <div
                    key={s.ref}
                    className={
                      'flex items-center gap-2 px-3 py-2 rounded cursor-pointer ' +
                      (selectedStashRef === s.ref
                        ? 'bg-blue-50/80 dark:bg-blue-900/20'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-900/40')
                    }
                    onClick={() => onSelectStash(s.ref)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{s.message}</div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">{s.ref}</div>
                    </div>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
