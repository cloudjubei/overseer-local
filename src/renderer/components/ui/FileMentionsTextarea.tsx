import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFilesAutocomplete } from '../../hooks/useFilesAutocomplete'
import { useReferencesAutocomplete } from '../../hooks/useReferencesAutocomplete'
import { useFiles } from '../../contexts/FilesContext'
import { RichText } from './RichText'

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
  // When true, render a chips overlay within the textarea using RichText input variant
  renderChipsInInput?: boolean
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
  renderChipsInInput = false,
}: FileMentionsTextareaProps) {
  const { files } = useFiles()
  const innerRef = useRef<HTMLTextAreaElement>(null)
  const textareaRef = inputRef ?? innerRef
  const mirrorRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const overlayContentRef = useRef<HTMLDivElement>(null)

  const [caretPos, setCaretPos] = useState<number>(0)
  const [editingRange, setEditingRange] = useState<{ start: number; end: number } | null>(null)

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
    // Exit editing mode if we were editing a token
    setEditingRange(null)
  }

  // For references, we now insert/display using the display indices (e.g., 3.2)
  const handleRefSelect = (refDisplay: string) => {
    onRefSelectInternal(refDisplay)
    if (onReferenceSelected) onReferenceSelected(refDisplay)
    // Exit editing mode if we were editing a token
    setEditingRange(null)
  }

  // Keep overlay scroll in sync with textarea scroll (when maxHeight/overflow is used)
  //TODO: fix
  // useEffect(() => {
  //   const ta = textareaRef.current
  //   if (!ta || !overlayContentRef.current) return
  //   function onScroll() {
  //     if (!overlayContentRef.current) return
  //     overlayContentRef.current.style.transform = `translateY(-${ta.scrollTop}px)`
  //   }
  //   ta.addEventListener('scroll', onScroll)
  //   return () => ta.removeEventListener('scroll', onScroll)
  // }, [textareaRef])

  // Track caret for chip editing range logic and autocomplete position updates
  //TODO: fix
  // useEffect(() => {
  //   const handleSelectionChange = () => {
  //     const ta = textareaRef.current
  //     if (!ta) return
  //     if (document.activeElement === ta) {
  //       try {
  //         const pos = ta.selectionStart ?? 0
  //         setCaretPos(pos)
  //         // If caret moved outside the current editingRange, clear it
  //         if (editingRange && (pos < editingRange.start || pos > editingRange.end)) {
  //           setEditingRange(null)
  //         }
  //       } catch {
  //         // ignore
  //       }
  //     }
  //   }
  //   document.addEventListener('selectionchange', handleSelectionChange)
  //   return () => document.removeEventListener('selectionchange', handleSelectionChange)
  // }, [textareaRef, editingRange])

  function findMentionBeforeCaret(
    text: string,
    pos: number,
  ): {
    start: number
    end: number
    raw: string
    prefix: '@' | '#'
    hadTrailingSpace: boolean
  } | null {
    let i = pos - 1
    if (i < 0) return null
    let hadTrailingSpace = false
    // Skip exactly one trailing space/newline if present
    if (text[i] === ' ' || text[i] === '\n' || text[i] === '\t') {
      hadTrailingSpace = true
      i -= 1
    }
    if (i < 0) return null
    // scan back to previous whitespace/newline start
    let j = i
    while (j >= 0 && text[j] !== ' ' && text[j] !== '\n' && text[j] !== '\t') j++
    while (j >= 0 && text[j] !== ' ' && text[j] !== '\n' && text[j] !== '\t') j--
    // Correction: walk back only
    j = i
    while (j >= 0 && text[j] !== ' ' && text[j] !== '\n' && text[j] !== '\t') j--
    const start = j + 1
    const endNoSpace = i + 1
    const raw = text.slice(start, endNoSpace)
    if (!raw) return null
    const first = raw[0]
    if (first === '@' || first === '#') {
      return { start, end: endNoSpace, raw, prefix: first, hadTrailingSpace }
    }
    return null
  }

  const onKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const key = e.key

    //TODO: fix
    // If Backspace pressed at end of a chip, convert chip to editable text and delete last character
    // if (key === 'Backspace') {
    //   const ta = textareaRef.current
    //   if (ta && ta.selectionStart === ta.selectionEnd) {
    //     const pos = ta.selectionStart ?? 0
    //     const mention = findMentionBeforeCaret(value, pos)
    //     if (mention) {
    //       e.preventDefault()
    //       e.stopPropagation()
    //       // Remove last character from the mention token and drop the trailing space if it existed
    //       const newRaw = mention.raw.length > 1 ? mention.raw.slice(0, -1) : mention.raw
    //       const before = value.slice(0, mention.start)
    //       const afterStart = mention.hadTrailingSpace ? pos - 1 : pos
    //       const after = value.slice(afterStart)
    //       const updated = before + newRaw + after
    //       const newCaret = mention.start + newRaw.length
    //       onChange(updated)
    //       setEditingRange({ start: mention.start, end: newCaret })
    //       // Focus and set selection after state update
    //       setTimeout(() => {
    //         const el = textareaRef.current
    //         if (!el) return
    //         el.focus()
    //         try {
    //           el.setSelectionRange(newCaret, newCaret)
    //         } catch {}
    //       }, 0)
    //       return
    //     }
    //   }
    // }

    const isSpace = key === ' ' || key === 'Spacebar' || key === 'Space'
    if (isSpace) {
      if (isFilesOpen && fileMatches.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        handleFileSelect(fileMatches[0])
        // Let parent also see the event after our handling
      } else if (isRefsOpen && refMatches.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        // Pass display index for insertion
        handleRefSelect(refMatches[0].display)
        // Let parent also see the event after our handling
      }
    }

    // Bubble to parent handler if provided
    onKeyDown?.(e)
  }

  const overlayActive = renderChipsInInput

  return (
    <div className="relative">
      {/* Mirror used for caret-based popover positioning */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="absolute top-[-9999px] left-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none"
      />

      {/* Chips overlay (visual only) */}
      {overlayActive && (
        <div
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          <div
            ref={overlayContentRef}
            className="whitespace-pre-wrap break-words px-3 py-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <RichText text={value} variant="input" inputEditRange={editingRange} />
          </div>
        </div>
      )}

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
        style={{
          ...style,
          // Hide the raw text visually when overlay is active, but keep caret visible
          color: overlayActive ? 'transparent' : (style?.color as any),
          caretColor: 'var(--text-primary)',
        }}
        aria-label={ariaLabel}
      />

      {isFilesOpen && filesPosition && (
        <div
          className="fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)] p-1"
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
