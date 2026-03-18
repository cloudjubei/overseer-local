import { useState, useEffect } from 'react'
import { GitUnifiedBranch } from 'thefactory-tools'
import { IconFolder } from '../../../components/ui/icons/IconFolder'
import { IconFolderOpen } from '../../../components/ui/icons/IconFolderOpen'
import GitSidebarBranchRow from './GitSidebarBranchRow'

export default function GitSidebarBranchFolder({
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
            <GitSidebarBranchRow
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
