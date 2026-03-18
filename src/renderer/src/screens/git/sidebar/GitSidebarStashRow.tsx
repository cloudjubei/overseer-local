import { GitStashListItem } from 'thefactory-tools'

export default function GitSidebarStashRow({
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
      <span className="truncate text-neutral-700 dark:text-neutral-300 font-medium">
        {stash.message}
      </span>
    </div>
  )
}
