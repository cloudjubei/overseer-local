import { GitUnifiedBranch } from 'thefactory-tools'
import { IconArrowUp } from '../../../components/ui/icons/IconArrowUp'
import { IconArrowDown } from '../../../components/ui/icons/IconArrowDown'

export default function GitSidebarBranchRow({
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
