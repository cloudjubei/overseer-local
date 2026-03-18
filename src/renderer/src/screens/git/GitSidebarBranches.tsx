import React, { useState, useRef, useEffect } from 'react'
import Spinner from '../../components/ui/Spinner'
import { GitUnifiedBranch, GitStashListItem } from 'thefactory-tools'
import { ResizeHandle } from '../../components/ui/ResizeHandle'
import { IconBranch } from '../../components/ui/icons/IconBranch'
import { IconGlobe } from '../../components/ui/icons/IconGlobe'
import { IconArchive } from '../../components/ui/icons/IconArchive'
import { IconFolder } from '../../components/ui/icons/IconFolder'
import { IconFolderOpen } from '../../components/ui/icons/IconFolderOpen'
import { IconArrowUp } from '../../components/ui/icons/IconArrowUp'
import { IconArrowDown } from '../../components/ui/icons/IconArrowDown'
import { useLocalStorage } from '../../hooks/useLocalStorage'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function groupBranches(branches: GitUnifiedBranch[]) {
  const groups: Record<string, GitUnifiedBranch[]> = {}
  const root: GitUnifiedBranch[] = []
  for (const b of branches) {
    const slash = b.name.indexOf('/')
    if (slash > 0) {
      const g = b.name.slice(0, slash)
      if (!groups[g]) groups[g] = []
      groups[g].push(b)
    } else {
      root.push(b)
    }
  }
  return { groups, root }
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({
  label,
  icon,
  open,
  onToggle,
}: {
  label: string
  icon: React.ReactNode
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left select-none
                 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors rounded"
    >
      {/* chevron */}
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        className={`shrink-0 text-neutral-400 transition-transform ${open ? '' : '-rotate-90'}`}
        fill="currentColor"
      >
        <path
          d="M1 3l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="w-3.5 h-3.5 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
        {icon}
      </span>
      <span className="text-[11px] font-semibold tracking-wide text-neutral-600 dark:text-neutral-300 uppercase">
        {label}
      </span>
    </button>
  )
}

// ─── Single branch row ────────────────────────────────────────────────────────
function BranchRow({
  branch,
  isSelected,
  isRemoteSection,
  indent,
  onClick,
  onDoubleClick,
}: {
  branch: GitUnifiedBranch
  isSelected: boolean
  isRemoteSection?: boolean
  /** extra left padding levels (inside a folder) */
  indent?: number
  onClick?: () => void
  onDoubleClick?: () => void
}) {
  // Show only the part after the last "/" so grouped branches are readable
  const displayName = branch.name.includes('/')
    ? branch.name.split('/').slice(1).join('/')
    : branch.name

  const rowCls =
    'group flex items-start gap-1.5 py-1.5 pr-2 rounded cursor-pointer text-xs ' +
    (isSelected
      ? 'bg-blue-50/80 dark:bg-blue-900/20'
      : 'hover:bg-neutral-100 dark:hover:bg-neutral-900/40')

  const pl = 8 + (indent ?? 0) * 8

  return (
    <div
      className={rowCls}
      style={{ paddingLeft: pl }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* current-branch green dot */}
      <span className="mt-0.5 w-2 h-2 shrink-0 flex items-center justify-center">
        {branch.current && !isRemoteSection ? (
          <span className="block w-1.5 h-1.5 rounded-full bg-green-500" />
        ) : null}
      </span>

      <div className="min-w-0 flex-1">
        {/* Row 1: name + local/remote chips */}
        <div className="flex items-center gap-1 min-w-0">
          <span
            className={
              'truncate font-medium ' +
              (branch.current && !isRemoteSection
                ? 'text-neutral-900 dark:text-white'
                : 'text-neutral-700 dark:text-neutral-300')
            }
          >
            {displayName}
          </span>
          {/* LOCAL / REMOTE chips — only in Branches section */}
          {!isRemoteSection && (
            <span className="flex items-center gap-0.5 shrink-0">
              {branch.isLocal && (
                <span className="px-1 py-0.5 text-[9px] leading-none rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 font-medium">
                  L
                </span>
              )}
              {branch.isRemote && (
                <span className="px-1 py-0.5 text-[9px] leading-none rounded bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 font-medium">
                  R
                </span>
              )}
            </span>
          )}
        </div>

        {/* Row 2: ahead/behind pills — right-aligned, Branches section only */}
        {!isRemoteSection && (branch.ahead || branch.behind) ? (
          <div className="flex items-center justify-end gap-1 mt-0.5">
            {branch.ahead ? (
              <span className="inline-flex items-center gap-0.5 text-[9px] leading-none font-semibold px-1 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-400">
                <IconArrowUp className="w-2.5 h-2.5" />
                {branch.ahead}
              </span>
            ) : null}
            {branch.behind ? (
              <span className="inline-flex items-center gap-0.5 text-[9px] leading-none font-semibold px-1 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400">
                <IconArrowDown className="w-2.5 h-2.5" />
                {branch.behind}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─── Folder group ─────────────────────────────────────────────────────────────
function BranchFolder({
  groupName,
  branches,
  isRemoteSection,
  selectedBranchName,
  selectedStashRef,
  onSelectBranch,
  onDoubleClickBranch,
}: {
  groupName: string
  branches: GitUnifiedBranch[]
  isRemoteSection?: boolean
  selectedBranchName?: string
  selectedStashRef?: string
  onSelectBranch: (b: GitUnifiedBranch) => void
  onDoubleClickBranch?: (b: GitUnifiedBranch) => void
}) {
  const hasSelected = branches.some((b) => b.name === selectedBranchName && !selectedStashRef)
  const [open, setOpen] = useState(true)

  // Keep folder open when a child is selected
  useEffect(() => {
    if (hasSelected) setOpen(true)
  }, [hasSelected])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1 py-1 pl-3 pr-2 text-left
                   hover:bg-neutral-100 dark:hover:bg-neutral-800/50 rounded transition-colors"
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 10 10"
          className={`shrink-0 text-neutral-400 transition-transform ${open ? '' : '-rotate-90'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M1 3l4 4 4-4"
            stroke="currentColor"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="w-3.5 h-3.5 flex items-center justify-center text-neutral-400">
          {open ? <IconFolderOpen className="w-3 h-3" /> : <IconFolder className="w-3 h-3" />}
        </span>
        <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
          {groupName}
        </span>
      </button>

      {open && (
        <div className="mt-0.5 flex flex-col">
          {branches.map((b) => (
            <BranchRow
              key={b.name}
              branch={b}
              isSelected={b.name === selectedBranchName && !selectedStashRef}
              isRemoteSection={isRemoteSection}
              indent={1} // inside a folder
              onClick={() => onSelectBranch(b)}
              onDoubleClick={() => onDoubleClickBranch?.(b)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── List of branches (root + folders) ────────────────────────────────────────
function BranchList({
  branches,
  isRemoteSection,
  selectedBranchName,
  selectedStashRef,
  onSelectBranch,
  onDoubleClickBranch,
}: {
  branches: GitUnifiedBranch[]
  isRemoteSection?: boolean
  selectedBranchName?: string
  selectedStashRef?: string
  onSelectBranch: (b: GitUnifiedBranch) => void
  onDoubleClickBranch?: (b: GitUnifiedBranch) => void
}) {
  const { root, groups } = groupBranches(branches)
  const sortedGroupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b))

  return (
    <div className="flex flex-col gap-0.5">
      {/* Root branches first */}
      {root.map((b) => (
        <BranchRow
          key={b.name}
          branch={b}
          isSelected={selectedBranchName === b.name && !selectedStashRef}
          isRemoteSection={isRemoteSection}
          onClick={() => onSelectBranch(b)}
          onDoubleClick={() => onDoubleClickBranch?.(b)}
        />
      ))}

      {/* Grouped folders */}
      {sortedGroupNames.map((g) => (
        <BranchFolder
          key={g}
          groupName={g}
          branches={groups[g]}
          isRemoteSection={isRemoteSection}
          selectedBranchName={selectedBranchName}
          selectedStashRef={selectedStashRef}
          onSelectBranch={onSelectBranch}
          onDoubleClickBranch={onDoubleClickBranch}
        />
      ))}
    </>
  )
}

// ─── Stash row ────────────────────────────────────────────────────────────────
function StashRow({
  stash,
  isSelected,
  onClick,
}: {
  stash: GitStashListItem
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <div
      className={
        'flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer text-xs ' +
        (isSelected
          ? 'bg-blue-50/80 dark:bg-blue-900/20'
          : 'hover:bg-neutral-100 dark:hover:bg-neutral-900/40')
      }
      onClick={onClick}
    >
      <span className="truncate text-neutral-700 dark:text-neutral-300 font-medium">{stash.message}</span>
    </div>
  )
}

export function GitSidebarBranches({
  projectId,
  loading,
  error,
  localBranches,
  remoteBranches,
  stashes,
  current,
  selectedBranchName,
  selectedStashRef,
  isEqualToCurrent,
  onSelectBranch,
  onDoubleClickBranch,
  onSelectStash,
}: {
  title?: string
  projectId?: string
  loading: boolean
  error?: string
  localBranches: GitUnifiedBranch[]
  remoteBranches: GitUnifiedBranch[]
  stashes?: GitStashListItem[]
  current?: GitUnifiedBranch
  selectedBranchName?: string
  selectedStashRef?: string
  isEqualToCurrent: (b: GitUnifiedBranch) => boolean
  onSelectBranch: (b: GitUnifiedBranch) => void
  onDoubleClickBranch?: (b: GitUnifiedBranch) => void
  onSelectStash: (ref: string) => void
}) {
  const [widthPx, setWidthPx] = useLocalStorage<number>('GitSidebarBranches_widthPx', 280)
  const resizeRef = useRef<{ startX: number; startW: number; maxW: number } | null>(null)

  const [branchesOpen, setBranchesOpen] = useState(true)
  const [remotesOpen, setRemotesOpen] = useState(true)
  const [stashesOpen, setStashesOpen] = useState(true)

  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const maxW = Math.max(100, Math.floor(window.innerWidth * 0.5))
    resizeRef.current = { startX: e.clientX, startW: widthPx, maxW }

    const onMove = (ev: PointerEvent) => {
      const st = resizeRef.current
      if (!st) return
      setWidthPx(Math.max(100, Math.min(st.maxW, st.startW + ev.clientX - st.startX)))
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
      const maxW = Math.max(100, Math.floor(window.innerWidth * 0.5))
      setWidthPx((v) => Math.max(100, Math.min(maxW, v)))
    }
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [])

  const otherLocals = localBranches.filter((b) => !b.current)

  return (
    <div
      className="relative shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col min-h-0 pt-1"
      style={{ width: widthPx }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {!projectId ? (
          <div className="px-3 py-2 text-xs text-neutral-500">No active project.</div>
        ) : loading ? (
          <div className="px-3 py-3 flex items-center gap-2 text-xs text-neutral-500">
            <Spinner /> Loading…
          </div>
        ) : error ? (
          <div className="px-3 py-2 text-xs text-red-600 dark:text-red-400">Error: {error}</div>
        ) : (
          <div className="flex flex-col pb-3 px-1">
            {/* ── BRANCHES ──────────────────────────────── */}
            <SectionHeader
              label="Branches"
              icon={<IconBranch className="w-3.5 h-3.5" />}
              open={branchesOpen}
              onToggle={() => setBranchesOpen((v) => !v)}
            />
            {branchesOpen && (
              <div className="mb-1">
                {current && (
                  <BranchRow
                    branch={current}
                    isSelected={selectedBranchName === current.name && !selectedStashRef}
                    isRemoteSection={false}
                    onClick={() => onSelectBranch(current)}
                    onDoubleClick={() => onDoubleClickBranch?.(current)}
                  />
                )}
                {!current && localBranches.length === 0 && (
                  <div className="px-3 py-1 text-xs text-neutral-400">No local branches.</div>
                )}
                <BranchList
                  branches={otherLocals}
                  isRemoteSection={false}
                  selectedBranchName={selectedBranchName}
                  selectedStashRef={selectedStashRef}
                  onSelectBranch={onSelectBranch}
                  onDoubleClickBranch={onDoubleClickBranch}
                />
              </div>
            )}

            {/* ── REMOTES ───────────────────────────────── */}
            <SectionHeader
              label="Remotes"
              icon={<IconGlobe className="w-3.5 h-3.5" />}
              open={remotesOpen}
              onToggle={() => setRemotesOpen((v) => !v)}
            />
            {remotesOpen && (
              <div className="mb-1">
                {remoteBranches.length === 0 ? (
                  <div className="px-3 py-1 text-xs text-neutral-400">No remote branches.</div>
                ) : (
                  <BranchList
                    branches={remoteBranches}
                    isRemoteSection={true}
                    selectedBranchName={selectedBranchName}
                    selectedStashRef={selectedStashRef}
                    onSelectBranch={onSelectBranch}
                    onDoubleClickBranch={onDoubleClickBranch}
                  />
                )}
              </div>
            )}

            {/* ── STASHES ───────────────────────────────── */}
            {stashes && stashes.length > 0 && (
              <>
                <SectionHeader
                  label="Stashes"
                  icon={<IconArchive className="w-3.5 h-3.5" />}
                  open={stashesOpen}
                  onToggle={() => setStashesOpen((v) => !v)}
                />
                {stashesOpen && (
                  <div className="flex flex-col gap-0.5 mb-1">
                    {stashes.map((s) => (
                      <StashRow
                        key={s.ref}
                        stash={s}
                        isSelected={selectedStashRef === s.ref}
                        onClick={() => onSelectStash(s.ref)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <ResizeHandle
        orientation="vertical"
        className="absolute top-0 bottom-0 -right-[3px] z-10 hover:bg-neutral-300/50 dark:hover:bg-neutral-700/50 transition-colors"
        hitBoxSize={6}
        onResizeStart={onResizeStart}
      />
    </div>
  )
}
