import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFilesAutocomplete } from '../../hooks/useFilesAutocomplete'
import { useReferencesAutocomplete } from '../../hooks/useReferencesAutocomplete'
import { useFiles } from '../../contexts/FilesContext'

export type FileMentionsTextareaProps = {
  id?: string
  value: string
  disableAutocomplete?: boolean
  onChange: (val: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  ariaLabel?: string
  onFileMentionSelected?: (path: string) => void
  onReferenceSelected?: (ref: string) => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>
  onSelect?: React.ReactEventHandler<HTMLTextAreaElement>
  onMouseUp?: React.MouseEventHandler<HTMLTextAreaElement>
  onFocus?: React.FocusEventHandler<HTMLTextAreaElement>
}

export default function FileMentionsTextarea({
  id,
  value,
  disableAutocomplete,
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
  onSelect,
  onMouseUp,
  onFocus,
}: FileMentionsTextareaProps) {
  const { files } = useFiles()
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const textareaRef = inputRef ?? innerRef
  const mirrorRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Guard against undefined 'files' during initial loads or heavy operations
  const filesList = useMemo(() => {
    if (disableAutocomplete) return []
    return (files ?? []).map((f) => f.relativePath!)
  }, [files, disableAutocomplete])

  // No-op input/setInput when autocomplete is disabled so hooks do zero work.
  const acInput = disableAutocomplete ? '' : value
  const acSetInput = disableAutocomplete ? (() => {}) : onChange
  const acTextareaRef = disableAutocomplete ? innerRef : textareaRef

  const {
    isOpen: isFilesOpen,
    matches: fileMatches,
    position: filesPosition,
    onSelect: onFileSelectInternal,
  } = useFilesAutocomplete({
    filesList,
    input: acInput,
    setInput: acSetInput,
    textareaRef: acTextareaRef,
    mirrorRef,
  })

  const {
    isOpen: isRefsOpen,
    matches: refMatches,
    position: refsPosition,
    onSelect: onRefSelectInternal,
  } = useReferencesAutocomplete({
    input: acInput,
    setInput: acSetInput,
    textareaRef: acTextareaRef,
    mirrorRef,
  })

  const [filesDropdownLeft, setFilesDropdownLeft] = useState<number | null>(null)
  const [filesDropdownMaxWidth, setFilesDropdownMaxWidth] = useState<number | null>(null)
  const filesDropdownRef = useRef<HTMLDivElement | null>(null)

  const [refsDropdownLeft, setRefsDropdownLeft] = useState<number | null>(null)
  const [refsDropdownMaxWidth, setRefsDropdownMaxWidth] = useState<number | null>(null)
  const refsDropdownRef = useRef<HTMLDivElement | null>(null)

  const PADDING = 8
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

  useEffect(() => {
    if (!isFilesOpen || !filesPosition) {
      setFilesDropdownLeft(null)
      setFilesDropdownMaxWidth(null)
      return
    }
    const parent = containerRef.current?.getBoundingClientRect()
    if (!parent) return

    const estWidth = 260
    const left = clamp(
      filesPosition.left,
      parent.left + PADDING,
      parent.right - estWidth - PADDING,
    )
    setFilesDropdownLeft(left)
    setFilesDropdownMaxWidth(Math.max(0, parent.width - PADDING * 2))
  }, [isFilesOpen, filesPosition])

  useLayoutEffect(() => {
    if (!isFilesOpen) return
    const parent = containerRef.current?.getBoundingClientRect()
    const node = filesDropdownRef.current
    if (!parent || !node) return

    const realWidth = node.offsetWidth || 260
    const newLeft = clamp(
      (filesDropdownLeft ?? parent.left + PADDING),
      parent.left + PADDING,
      parent.right - realWidth - PADDING,
    )
    if (newLeft !== filesDropdownLeft) setFilesDropdownLeft(newLeft)
    const newMax = Math.max(0, parent.width - PADDING * 2)
    if (newMax !== filesDropdownMaxWidth) setFilesDropdownMaxWidth(newMax)
  }, [isFilesOpen, fileMatches.length])

  useEffect(() => {
    if (!isFilesOpen) return
    const onResize = () => {
      const parent = containerRef.current?.getBoundingClientRect()
      const node = filesDropdownRef.current
      if (!parent) return
      const width = node?.offsetWidth || 260
      const newLeft = clamp(
        filesDropdownLeft ?? parent.left + PADDING,
        parent.left + PADDING,
        parent.right - width - PADDING,
      )
      setFilesDropdownLeft(newLeft)
      setFilesDropdownMaxWidth(Math.max(0, parent.width - PADDING * 2))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isFilesOpen, filesDropdownLeft])

  useEffect(() => {
    if (!isRefsOpen || !refsPosition) {
      setRefsDropdownLeft(null)
      setRefsDropdownMaxWidth(null)
      return
    }
    const parent = containerRef.current?.getBoundingClientRect()
    if (!parent) return

    const estWidth = 260
    const left = clamp(
      refsPosition.left,
      parent.left + PADDING,
      parent.right - estWidth - PADDING,
    )
    setRefsDropdownLeft(left)
    setRefsDropdownMaxWidth(Math.max(0, parent.width - PADDING * 2))
  }, [isRefsOpen, refsPosition])

  useLayoutEffect(() => {
    if (!isRefsOpen) return
    const parent = containerRef.current?.getBoundingClientRect()
    const node = refsDropdownRef.current
    if (!parent || !node) return

    const realWidth = node.offsetWidth || 260
    const newLeft = clamp(
      (refsDropdownLeft ?? parent.left + PADDING),
      parent.left + PADDING,
      parent.right - realWidth - PADDING,
    )
    if (newLeft !== refsDropdownLeft) setRefsDropdownLeft(newLeft)
    const newMax = Math.max(0, parent.width - PADDING * 2)
    if (newMax !== refsDropdownMaxWidth) setRefsDropdownMaxWidth(newMax)
  }, [isRefsOpen, refMatches.length])

  useEffect(() => {
    if (!isRefsOpen) return
    const onResize = () => {
      const parent = containerRef.current?.getBoundingClientRect()
      const node = refsDropdownRef.current
      if (!parent) return
      const width = node?.offsetWidth || 260
      const newLeft = clamp(
        refsDropdownLeft ?? parent.left + PADDING,
        parent.left + PADDING,
        parent.right - width - PADDING,
      )
      setRefsDropdownLeft(newLeft)
      setRefsDropdownMaxWidth(Math.max(0, parent.width - PADDING * 2))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [isRefsOpen, refsDropdownLeft])

  const handleFileSelect = (path: string) => {
    onFileSelectInternal(path)
    if (onFileMentionSelected) onFileMentionSelected(path)
  }

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

    onKeyDown?.(e)
  }

  return (
    <div className="relative" ref={containerRef}>
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
        onSelect={onSelect}
        onMouseUp={onMouseUp}
        onFocus={onFocus}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={className}
        style={style}
        aria-label={ariaLabel}
      />

      {isFilesOpen && filesPosition && (
        <div
          ref={filesDropdownRef}
          className="fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)] p-1"
          style={{
            left: `${(filesDropdownLeft ?? filesPosition.left)}px`,
            top: `${filesPosition.top}px`,
            transform: 'translateY(-100%)',
            maxWidth: filesDropdownMaxWidth ? `${filesDropdownMaxWidth}px` : undefined,
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
          ref={refsDropdownRef}
          className="fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)]"
          style={{
            left: `${(refsDropdownLeft ?? refsPosition.left)}px`,
            top: `${refsPosition.top}px`,
            transform: 'translateY(-100%)',
            maxWidth: refsDropdownMaxWidth ? `${refsDropdownMaxWidth}px` : undefined,
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
