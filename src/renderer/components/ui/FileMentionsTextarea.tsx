import React, { useMemo, useRef } from 'react'
import useFiles, { inferFileType } from '../../hooks/useFiles'
import { useFilesAutocomplete } from '../../hooks/useFilesAutocomplete'
import FileDisplay from './FileDisplay'

export type FileMentionsTextareaProps = {
  id?: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  ariaLabel?: string
  onFileMentionSelected?: (path: string) => void
}

export default function FileMentionsTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
  className,
  style,
  ariaLabel,
  onFileMentionSelected,
}: FileMentionsTextareaProps) {
  const { files, filesByPath } = useFiles()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)

  const filesList = useMemo(() => files.map((f) => f.path), [files])

  const { isOpen, matches, position, onSelect } = useFilesAutocomplete({
    filesList,
    input: value,
    setInput: onChange,
    textareaRef,
    mirrorRef,
  })

  const handleSelect = (path: string) => {
    onSelect(path)
    if (onFileMentionSelected) onFileMentionSelected(path)
  }

  return (
    <div className="relative">
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="absolute top-[-9999px] left-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none"
      />
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={className}
        style={style}
        aria-label={ariaLabel}
      />

      {isOpen && position && (
        <div
          className="fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)] p-1"
          style={{ left: `${position.left}px`, top: `${position.top}px`, transform: 'translateY(-100%)' }}
          role="listbox"
          aria-label="Files suggestions"
        >
          {matches.map((path, idx) => {
            const meta = filesByPath[path]
            const name = meta?.name || (path.split('/').pop() || path)
            const type = meta?.type || inferFileType(path)
            const size = meta?.size ?? undefined
            const mtime = meta?.mtime ?? undefined
            return (
              <div key={idx} role="option" className="px-1 py-0.5">
                <FileDisplay
                  file={{ name, path, type, size, mtime }}
                  density="compact"
                  interactive
                  showPreviewOnHover
                  onClick={() => handleSelect(path)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
