import { GitUnifiedBranch } from 'thefactory-tools'
import GitSidebarBranchRow from './GitSidebarBranchRow'
import GitSidebarBranchFolder from './GitSidebarBranchFolder'

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

export default function GitSidebarBranchList({
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
        <GitSidebarBranchRow
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
        <GitSidebarBranchFolder
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
    </div>
  )
}
