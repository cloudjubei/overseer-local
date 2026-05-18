import { useMemo } from 'react'
import { ContextFileChip as ContextFileChipBase } from 'thefactory-ui/web'
import { useFiles } from '../../contexts/FilesContext'
import { inferFileType } from 'thefactory-tools/utils'

/**
 * Desktop wrapper around the shared `ContextFileChip`. Resolves the bare
 * `path` against `useFiles().filesByPath` so the preview tooltip reflects
 * the actual file metadata; falls back to a synthetic shape (using
 * `inferFileType` for the mime hint) when the file isn't in the project
 * snapshot (e.g. deleted between turns).
 */
export default function ContextFileChip({
  path,
  onRemove,
  warn,
}: {
  path: string
  onRemove?: () => void
  warn?: boolean
}) {
  const { filesByPath } = useFiles()

  const file = useMemo(() => {
    const found = filesByPath[path]
    if (found) return found
    const parts = path.split('/')
    const name = parts[parts.length - 1] || path
    return {
      name,
      absolutePath: path,
      relativePath: path,
      type: inferFileType(path),
      size: 0,
      ctime: 0,
      mtime: 0,
    }
  }, [path, filesByPath])

  return <ContextFileChipBase file={file} onRemove={onRemove} warn={warn} />
}
