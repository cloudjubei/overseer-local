import React from 'react'
import FileDisplay from '../ui/FileDisplay'
import WarningChip from './WarningChip'
import { FileMeta } from 'thefactory-tools'
import { inferFileType } from 'thefactory-tools/utils'
import { useFiles } from '../../contexts/FilesContext'

export default function ContextFileChip({
  path,
  onRemove,
  warn,
}: {
  path: string
  onRemove?: () => void
  warn?: boolean
}) {
  const { files } = useFiles()

  const file: FileMeta = React.useMemo(() => {
    const foundFile = files.find((f) => f.relativePath === path)
    if (foundFile) {
      return foundFile
    }

    // Fallback for when file is not found in the project's file list
    const parts = path.split('/')
    const name = parts[parts.length - 1] || path
    return { name, absolutePath: path, relativePath: path, type: inferFileType(path), size: 0, ctime: 0, mtime: 0 }
  }, [path, files])

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
