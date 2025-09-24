import React, { useMemo, useRef, useState } from 'react'
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

// Local tokenizer for mentions with ranges so we can detect chip boundaries at caret
function getMentionRanges(text: string): Array<{
  type: 'file' | 'dep'
  start: number
  end: number
  raw: string
}> {
  const ranges: Array<{ type: 'file' | 'dep'; start: number; end: number; raw: string }> = []
  if (!text) return ranges

  // Keep patterns aligned with RichText tokenizer
  const fileRe = /@([A-Za-z0-9_\-./]+(?:\.[A-Za-z0-9]+)?)/g
  const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
  const depRe = new RegExp(`#((?:${UUID})|(?:\\d+))(?:\.((?:${UUID})|(?:\\d+)))?`, 'g')

  let m: RegExpExecArray | null
  while ((m = fileRe.exec(text))) {
    ranges.push({ type: 'file', start: m.index, end: m.index + m[0].length, raw: m[0] })
  }
  while ((m = depRe.exec(text))) {
    ranges.push({ type: 'dep', start: m.index, end: m.index + m[0].length, raw: m[0] })
  }

  ranges.sort((a, b) => a.start - b.start)
  return ranges
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
    setEditingRange(null)
  }

  const handleRefSelect = (refDisplay: string) => {
    onRefSelectInternal(refDisplay)
    if (onReferenceSelected) onReferenceSelected(refDisplay)
    setEditingRange(null)
  }

  // Backspace logic: if caret is immediately after a mention chip, switch to editing that mention and delete last char
  const onKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const key = e.key

    if (key === 'Backspace' && renderChipsInInput) {
      const ta = textareaRef.current
      if (ta && ta.selectionStart === ta.selectionEnd) {
        const caret = ta.selectionStart ?? 0
        if (caret > 0) {
          const ranges = getMentionRanges(value)
          // Find a mention whose end is at caret or caret - 1 is a whitespace and mention ends before it
          const prevChar = value[caret - 1]
          const isPrevSpace = prevChar === ' ' || prevChar === '\n' || prevChar === '\t'
          const target = ranges.find((r) => r.end === caret || (isPrevSpace && r.end === caret - 1))
          if (target) {
            e.preventDefault()
            e.stopPropagation()

            // Delete the last character of the mention token (but keep at least the prefix @/#)
            const token = value.slice(target.start, target.end)
            const keepLen = Math.max(1, token.length - 1)
            const newToken = token.slice(0, keepLen)

            const before = value.slice(0, target.start)
            const after = value.slice(target.end) // keep any trailing space intact
            const updated = before + newToken + after
            const newCaret = target.start + newToken.length

            onChange(updated)
            setEditingRange({ start: target.start, end: newCaret })

            // move caret into the token so user can continue editing
            setTimeout(() => {
              const el = textareaRef.current
              if (!el) return
              try {
                el.focus()
                el.setSelectionRange(newCaret, newCaret)
              } catch {}
            }, 0)
            return
          }
        }
      }
    }

    // Accept with Space while a suggestion list is open
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

  const overlayActive = renderChipsInInput

  // Keep overlay scroll in sync with textarea scroll using a lightweight handler
  const onScrollInternal = () => {
    const ta = textareaRef.current
    const content = overlayContentRef.current
    if (!ta || !content) return
    content.style.transform = `translateY(-${ta.scrollTop}px)`
  }

  // Clear editing range when selection moves outside it
  const onSelectInternal = () => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart ?? 0
    const end = ta.selectionEnd ?? start
    if (!editingRange) return
    const outside = end < editingRange.start || start > editingRange.end
    if (outside) setEditingRange(null)
  }

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
        onScroll={onScrollInternal}
        onSelect={onSelectInternal}
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
