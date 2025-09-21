import React from 'react'
import { Input } from './Input'
import FileDisplay from './FileDisplay'
import { useFiles, inferFileType } from '../../contexts/FilesContext'

export type FileSelectorProps = {
  selected?: string[] // relPaths
  onConfirm: (selected: string[]) => void
  onCancel?: () => void
  allowMultiple?: boolean
  title?: string
}

function pathToMeta(path: string) {
  const parts = path.split('/')
  const name = parts[parts.length - 1] || path
  return {
    name,
    path,
    type: inferFileType(path),
  }
}

export const FileSelector: React.FC<FileSelectorProps> = ({
  selected = [],
  onConfirm,
  onCancel,
  allowMultiple = true,
  title,
}) => {
  const { files } = useFiles()
  const [query, setQuery] = React.useState('')
  const [localSelected, setLocalSelected] = React.useState<string[]>(selected)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setLocalSelected(selected)
  }, [selected])

  React.useEffect(() => {
    // Focus the search input when the selector opens
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0)
    return () => clearTimeout(t)
  }, [])

  const filteredFiles = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? files.filter((p) => p.name.toLowerCase().includes(q)) : files
    return filtered.sort((a, b) => {
      if (q) {
        const aScore = a.name.toLowerCase().indexOf(q)
        const bScore = b.name.toLowerCase().indexOf(q)
        if (aScore !== bScore) return aScore - bScore
      }
      return a.name.localeCompare(b.name)
    })
  }, [files, query])

  function toggle(path: string) {
    setLocalSelected((prev) => {
      const has = prev.includes(path)
      if (has) return prev.filter((p) => p !== path)
      if (!allowMultiple) return [path]
      return [...prev, path]
    })
  }

  function isSelected(path: string) {
    return localSelected.includes(path)
  }

  return (
    <div className="file-selector flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <Input
            ref={inputRef}
            placeholder="Search files by name or path"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search files"
          />
        </div>
        <div className="text-xs text-text-muted whitespace-nowrap pl-1">
          {filteredFiles.length} files
        </div>
      </div>

      <div
        role="listbox"
        aria-label={title || 'Files'}
        className="border rounded-md max-h-[50vh] overflow-auto p-1 bg-surface-raised border-border"
      >
        {filteredFiles.map((file) => {
          const selected = isSelected(file.relativePath!)
          return (
            <div
              key={file.relativePath!}
              role="option"
              aria-selected={selected}
              className="flex items-center"
            >
              <FileDisplay
                file={file}
                density="normal"
                interactive
                showPreviewOnHover
                onClick={() => toggle(file.relativePath!)}
                trailing={
                  <span
                    className={
                      'inline-flex items-center justify-center w-5 h-5 rounded-sm border text-[10px] ' +
                      (selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-transparent text-text-muted border-border')
                    }
                    aria-hidden
                  >
                    {selected ? '✓' : ''}
                  </span>
                }
                className={selected ? 'bg-blue-50 dark:bg-blue-950/30' : ''}
              />
            </div>
          )
        })}
        {filteredFiles.length === 0 && (
          <div className="p-4 text-sm text-text-muted">No files match your search.</div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => onConfirm(localSelected)}
          disabled={localSelected.length === 0 && allowMultiple}
        >
          Confirm{localSelected.length ? ` (${localSelected.length})` : ''}
        </button>
      </div>
    </div>
  )
}

export default FileSelector
