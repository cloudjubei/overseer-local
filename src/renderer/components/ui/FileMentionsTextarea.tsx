import React, { useMemo, useRef } from 'react'
import { useFilesAutocomplete } from '../../hooks/useFilesAutocomplete'
import { useReferencesAutocomplete } from '../../hooks/useReferencesAutocomplete'
import { useFiles } from '../../contexts/FilesContext'

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
  onReferenceSelected?: (ref: string) => void
  // Optional external ref to control focus/caret from parent
  inputRef?: React.RefObject<HTMLTextAreaElement>
  // Optional key handler (e.g., Cmd/Ctrl+Enter to submit from parent)
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>
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
  onReferenceSelected,
  inputRef,
  onKeyDown,
}: FileMentionsTextareaProps) {
  const { files } = useFiles()
  const innerRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = inputRef ?? innerRef
  const mirrorRef = useRef<HTMLDivElement>(null)

  const filesList = useMemo(() => files.map((f) => f.relativePath!), [files])

  const {
    isOpen: isFilesOpen,
    matches: fileMatches,
    position: filesPosition,
    onSelect: onFileSelectInternal,
  } = useFilesAutocomplete({
    filesList,
    input: value,
    setInput: onChange,
    textareaRef,
    mirrorRef,
  })

  const {
    isOpen: isRefsOpen,
    matches: refMatches,
    position: refsPosition,
    onSelect: onRefSelectInternal,
  } = useReferencesAutocomplete({
    input: value,
    setInput: onChange,
    textareaRef,
    mirrorRef,
  })

  const handleFileSelect = (path: string) => {
    onFileSelectInternal(path)
    if (onFileMentionSelected) onFileMentionSelected(path)
  }

  // For references, we now insert/display using the display indices (e.g., 3.2)
  const handleRefSelect = (refDisplay: string) => {
    onRefSelectInternal(refDisplay)
    if (onReferenceSelected) onReferenceSelected(refDisplay)
  }

  const onKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const key = e.key
    const isSpace = key === ' ' || key === 'Spacebar' || key === 'Space'
    if (isSpace) {
      if (isFilesOpen && fileMatches.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        handleFileSelect(fileMatches[0])
      } else if (isRefsOpen && refMatches.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        handleRefSelect(refMatches[0].display)
      }
    }

    // Bubble to parent handler if provided
    onKeyDown?.(e)
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
        onKeyDown={onKeyDownInternal}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={className}
        style={style}
        aria-label={ariaLabel}
      />

      {isFilesOpen && filesPosition && (
        <div
          className="fixed z-[var(--z-dropdown,1000)] min-w={[260]}px max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)] p-1"
          style={{
            left: `${filesPosition.left}px`,
            top: `${filesPosition.top}px`,
            transform: 'translateY(-100%)',
          }}
          role="listbox"
          aria-label="Files suggestions"
        >
          {fileMatches.map((path, idx) => (
            <div
              key={idx}
              role="option"
              className="px-3 py-2 cursor-pointer hover:bg-[color-mix(in_srgb,var(--accent-primary)_8%,transparent)] text-[var(--text-primary)] text-sm"
              onClick={() => handleFileSelect(path)}
            >
              {path}
            </div>
          ))}
        </div>
      )}

      {isRefsOpen && refsPosition && (
        <div
          className="fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)]"
          style={{
            left: `${refsPosition.left}px`,
            top: `${refsPosition.top}px`,
            transform: 'translateY(-100%)',
          }}
          role="listbox"
          aria-label="References suggestions"
        >
          {refMatches.map((item, idx) => (
            <div
              key={idx}
              className="px-3 py-2 cursor-pointer hover:bg-[color-mix(in_srgb,var(--accent-primary)_8%,transparent)] text-[var(--text-primary)]"
              role="option"
              onClick={() => handleRefSelect(item.display)}
            >
              #{item.display} - {item.title} ({item.type})
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
