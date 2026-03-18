import React, { useState, useRef, useEffect } from 'react'
import Spinner from '../../../components/ui/Spinner'
import { GitUnifiedBranch, GitStashListItem } from 'thefactory-tools'
import { ResizeHandle } from '../../../components/ui/ResizeHandle'
import { IconBranch } from '../../../components/ui/icons/IconBranch'
import { IconGlobe } from '../../../components/ui/icons/IconGlobe'
import { IconArchive } from '../../../components/ui/icons/IconArchive'
import { useLocalStorage } from '../../../hooks/useLocalStorage'
import GitSidebarBranchRow from './GitSidebarBranchRow'
import GitSidebarBranchList from './GitSidebarBranchList'
import GitSidebarStashRow from './GitSidebarStashRow'
import GitSidebarSectionHeader from './GitSidebarSectionHeader'

export function GitSidebar({
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
            <GitSidebarSectionHeader
              label="Branches"
              icon={<IconBranch className="w-3.5 h-3.5" />}
              open={branchesOpen}
              onToggle={() => setBranchesOpen((v) => !v)}
            />
            {branchesOpen && (
              <div className="mb-1">
                {current && (
                  <GitSidebarBranchRow
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
                <GitSidebarBranchList
                  branches={otherLocals}
                  isRemoteSection={false}
                  selectedBranchName={selectedBranchName}
                  selectedStashRef={selectedStashRef}
                  onSelectBranch={onSelectBranch}
                  onDoubleClickBranch={onDoubleClickBranch}
                />
              </div>
            )}

            <GitSidebarSectionHeader
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
                  <GitSidebarBranchList
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
                <GitSidebarSectionHeader
                  label="Stashes"
                  icon={<IconArchive className="w-3.5 h-3.5" />}
                  open={stashesOpen}
                  onToggle={() => setStashesOpen((v) => !v)}
                />
                {stashesOpen && (
                  <div className="flex flex-col gap-0.5 mb-1">
                    {stashes.map((s) => (
                      <GitSidebarStashRow
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
