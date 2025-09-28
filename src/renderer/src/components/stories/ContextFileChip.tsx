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
    <div className="flex items-center gap-2 px-2 py-1 rounded-md border bg-surface-raised border-border relative">
      {warn ? (
        <div className="absolute -top-1 -left-1">
          <WarningChip
            title="File not referenced in text"
            tooltip="File not referenced in title/description/rejection"
          />
        </div>
      ) : null}
      <FileDisplay file={file} density="normal" showPreviewOnHover interactive />
      {onRemove && (
        <button type="button" className="btn-ghost text-xs" onClick={onRemove} title="Remove file">
          ✕
        </button>
      )}
    </div>
  )
}
