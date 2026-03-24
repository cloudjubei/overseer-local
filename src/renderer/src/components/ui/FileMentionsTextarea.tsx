import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFilesAutocomplete } from '../../hooks/useFilesAutocomplete'
import { useReferencesAutocomplete } from '../../hooks/useReferencesAutocomplete'
import { useFiles } from '../../contexts/FilesContext'
import { IconFolder } from './icons/Icons'
import { renderFileSuggestionIcon } from '../chat/fileSuggestionIcons'
import { PathDisplay } from './PathDisplay'
import { RichText } from './RichText'

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

  // --- Inline overlay rendering (for "custom render within the input box") ---
  // We render a styled overlay above the textarea content, while keeping the real textarea text
  // invisible (but caret + selection remain native). This mirrors the StoryCreate-style behavior.
  const [isFocused, setIsFocused] = useState(false)
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)

  // Guard against undefined 'files' during initial loads or heavy operations
  const filesList = useMemo(() => {
    if (disableAutocomplete) return []
    const filePaths = (files ?? []).map((f) => f.relativePath!).filter(Boolean)

    // Folder support: infer folder paths from file paths.
    const folderSet = new Set<string>()
    for (const p of filePaths) {
      const parts = p.split('/').filter(Boolean)
      // Add each directory prefix: a/b/c.txt -> a, a/b
      for (let i = 0; i < parts.length - 1; i++) {
        folderSet.add(parts.slice(0, i + 1).join('/'))
      }
    }

    return [...filePaths, ...Array.from(folderSet)]
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

  const getContainerBounds = () => {
    // Prefer the actual input container for horizontal clamping.
    // Fall back to viewport when bounds are not available.
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) return rect
    return {
      left: 0,
      right: window.innerWidth,
      width: window.innerWidth,
    } as DOMRect
  }

  useEffect(() => {
    if (!isFilesOpen || !filesPosition) {
      setFilesDropdownLeft(null)
      setFilesDropdownMaxWidth(null)
      return
    }
    const parent = getContainerBounds()

    // Clamp to the input container so suggestions never get pushed off to the right.
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
    const parent = getContainerBounds()
    const node = filesDropdownRef.current
    if (!node) return

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
      const parent = getContainerBounds()
      const node = filesDropdownRef.current
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
    const parent = getContainerBounds()

    // Clamp to the input container so suggestions never get pushed off to the right.
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
    const parent = getContainerBounds()
    const node = refsDropdownRef.current
    if (!node) return

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
      const parent = getContainerBounds()
      const node = refsDropdownRef.current
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

  const updateSelectionFromEl = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? start
    setSelection({ start, end })
  }

  const onKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const key = e.key
    const isEnter = key === 'Enter'

    // Accept the top suggestion on Enter (not Space).
    // This prevents accidental selection when the user just wants to type a space.
    if (isEnter && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
      if (isFilesOpen && fileMatches.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        handleFileSelect(fileMatches[0])
        return
      }

      if (isRefsOpen && refMatches.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        handleRefSelect(refMatches[0].display)
        return
      }
    }

    onKeyDown?.(e)
  }

  return (
    <div className='relative' ref={containerRef}>
      <div
        ref={mirrorRef}
        aria-hidden='true'
        className='absolute top-[-9999px] left-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none'
      />

      {/* Overlay: render styled mentions inline within the input box. */}
      <div
        aria-hidden='true'
        className='file-mentions-overlay'
        style={{ display: disableAutocomplete ? 'none' : undefined }}
      >
        {/* Preserve line wrapping + sizing by matching textarea typography and padding via inherited className/style. */}
        <span className='file-mentions-overlay__content'>
          <RichText text={value} variant='input' inputEditRange={isFocused ? selection : null} />
          {/* Ensure last line height is respected when value ends with a newline */}
          {value?.endsWith('\n') ? '\n' : null}
        </span>
      </div>

      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDownInternal}
        onSelect={(e) => {
          updateSelectionFromEl(e.currentTarget)
          onSelect?.(e)
        }}
        onMouseUp={(e) => {
          updateSelectionFromEl(e.currentTarget)
          onMouseUp?.(e)
        }}
        onFocus={(e) => {
          setIsFocused(true)
          updateSelectionFromEl(e.currentTarget)
          onFocus?.(e)
        }}
        onBlur={() => {
          setIsFocused(false)
        }}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={['file-mentions-textarea', className].filter(Boolean).join(' ')}
        style={style}
        aria-label={ariaLabel}
      />

      {isFilesOpen && filesPosition && (
        <div
          ref={filesDropdownRef}
          className='fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)] p-1'
          style={{
            left: `${(filesDropdownLeft ?? filesPosition.left)}px`,
            top: `${filesPosition.top}px`,
            transform: 'translateY(-100%)',
            maxWidth: filesDropdownMaxWidth ? `${filesDropdownMaxWidth}px` : undefined,
          }}
          role='listbox'
          aria-label='Files suggestions'
        >
          {fileMatches.map((path, idx) => {
            const isFolder = !path.includes('.')
            return (
              <div
                key={idx}
                role='option'
                className='px-3 py-2 cursor-pointer hover:bg-[color-mix(in_srgb,var(--accent-primary)_8%,transparent)] text-[var(--text-primary)] text-sm flex items-center gap-2'
                onClick={() => handleFileSelect(path)}
              >
                <span className='inline-flex items-center justify-center w-4 h-4 opacity-90'>
                  {isFolder ? (
                    <IconFolder className='w-4 h-4' />
                  ) : (
                    renderFileSuggestionIcon({ path, kind: 'file' }, 'w-4 h-4')
                  )}
                </span>
                <div className='min-w-0 flex-1'>
                  <PathDisplay path={path} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isRefsOpen && refsPosition && (
        <div
          ref={refsDropdownRef}
          className='fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)]'
          style={{
            left: `${(refsDropdownLeft ?? refsPosition.left)}px`,
            top: `${refsPosition.top}px`,
            transform: 'translateY(-100%)',
            maxWidth: refsDropdownMaxWidth ? `${refsDropdownMaxWidth}px` : undefined,
          }}
          role='listbox'
          aria-label='References suggestions'
        >
          {refMatches.map((item, idx) => (
            <div
              key={idx}
              className='px-3 py-2 cursor-pointer hover:bg-[color-mix(in_srgb,var(--accent-primary)_8%,transparent)] text-[var(--text-primary)]'
              role='option'
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
