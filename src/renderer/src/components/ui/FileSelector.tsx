import React from 'react'
import { FileSelector as FileSelectorPackage } from 'thefactory-ui/web'
import { useFiles } from '../../contexts/FilesContext'

// Local connected wrapper around `thefactory-ui`'s decoupled `FileSelector`.
//
// The package primitive doesn't fetch — the consumer supplies `files`. Here
// we pull the project file list from overseer-local's `FilesContext` so every
// existing `@renderer/components/ui/FileSelector` import keeps working
// without a per-call-site refactor.
//
// Prop drift handled here:
//   - Local `selected: string[]` → package `initialSelected: string[]`.
//     The local prop was reactive (a useEffect re-synced local state when
//     it changed); the package treats it as one-shot. Only call site today
//     (FeatureForm) mounts the selector on demand and unmounts on confirm,
//     so the reactive sync was never exercised in practice.

export type FileSelectorProps = {
  /** Initial selection (matches against `file.relativePath`). */
  selected?: string[]
  onConfirm: (paths: string[]) => void
  onCancel?: () => void
  allowMultiple?: boolean
  title?: string
}

export const FileSelector: React.FC<FileSelectorProps> = ({
  selected,
  onConfirm,
  onCancel,
  allowMultiple = true,
  title,
}) => {
  const { files } = useFiles()
  return (
    <FileSelectorPackage
      files={files}
      initialSelected={selected}
      onConfirm={onConfirm}
      onCancel={onCancel}
      allowMultiple={allowMultiple}
      title={title}
    />
  )
}

export default FileSelector
