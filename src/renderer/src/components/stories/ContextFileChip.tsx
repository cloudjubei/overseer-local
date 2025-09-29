import React from 'react'
import FileDisplay from '../ui/FileDisplay'
import WarningChip from './WarningChip'
import { inferFileType } from '../../contexts/FilesContext'
import { FileMeta } from 'thefactory-tools'

export default function ContextFileChip({
  path,
  onRemove,
  warn,
}: {
  path: string
  onRemove?: () => void
  warn?: boolean
}) {
  const file: FileMeta = React.useMemo(() => {
    const parts = path.split('/')
    const name = parts[parts.length - 1] || path
    return { name, absolutePath: path, type: inferFileType(path), size: 0, ctime: 0, mtime: 0 }
  }, [path])

  return (
    <div className="inline-file-chip relative">
      {warn ? (
        <div className="absolute -top-1 -left-1">
          <WarningChip
            title="File not referenced in text"
            tooltip="File not referenced in title/description/rejection"
          />
        </div>
      ) : null}
      <FileDisplay
        file={file}
        density="normal"
        showPreviewOnHover
        interactive={false}
        trailing={
          onRemove ? (
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onRemove?.()
              }}
              title="Remove file"
              aria-label="Remove file"
            >
              ✕
            </button>
          ) : undefined
        }
      />
    </div>
  )
}
