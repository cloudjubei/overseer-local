import FileDisplay from '../ui/FileDisplay'
import { useFiles } from '../../contexts/FilesContext'
import { inferFileType } from 'thefactory-tools/utils'

export interface MenuPosition {
  left: number
  top: number
}

export default function FilesSuggestionsMenu({
  matches,
  position,
  onSelect,
}: {
  matches: string[]
  position: MenuPosition
  onSelect: (path: string) => void
}) {
  const { filesByPath } = useFiles()
  return (
    <div
      className="fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)] p-1"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        transform: 'translateY(-100%)',
      }}
      role="listbox"
      aria-label="Files suggestions"
    >
      {matches.map((path, idx) => {
        const meta = filesByPath[path]
        const name = meta?.name || path.split('/').pop() || path
        const type = meta?.type || inferFileType(path)
        const size = meta?.size ?? undefined
        const mtime = meta?.mtime ?? undefined
        const ctime = meta?.ctime ?? undefined
        return (
          <div key={idx} role="option" className="px-1 py-0.5">
            <FileDisplay
              file={{ name, absolutePath: path, relativePath: path, type, size, mtime, ctime }}
              density="compact"
              interactive
              showPreviewOnHover
              onClick={() => onSelect(path)}
            />
          </div>
        )
      })}
    </div>
  )
}
