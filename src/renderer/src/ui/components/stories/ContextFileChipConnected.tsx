import { useMemo } from 'react'
import { ContextFileChip as ContextFileChipBase, type UikitFileMeta } from 'thefactory-ui/web'
import { useFiles } from 'thefactory-ui/headless'

export type ContextFileChipConnectedProps = {
  path: string
  onRemove?: () => void
  warn?: boolean
}

/**
 * Web wrapper around the shared `ContextFileChip`. Resolves the bare
 * `path` against `FilesContext.files` (when available) so the chip can
 * show the same metadata as the rest of web's file UI; falls back to a
 * minimal `{name, relativePath, absolutePath}` triple when the file
 * isn't in the project's file list (deleted / not yet ingested).
 */
export default function ContextFileChipConnected({ path, onRemove, warn }: ContextFileChipConnectedProps) {
  const { files } = useFiles()
  const file = useMemo<UikitFileMeta>(() => {
    const exact = files.find(
      (f) => f.relativePath === path || f.absolutePath === path,
    )
    if (exact) return exact
    const name = path.split('/').pop() || path
    return { name, absolutePath: path, relativePath: path }
  }, [files, path])

  return <ContextFileChipBase file={file} onRemove={onRemove} warn={warn} />
}
