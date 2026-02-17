import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react'
import { useFiles } from '../../contexts/FilesContext'
import AttachmentList from './AttachmentList'
import FileMentionsTextarea from '../ui/FileMentionsTextarea'
import { IconAttach, IconSend } from '../ui/icons/Icons'
import Tooltip from '../ui/Tooltip'

interface ChatInputProps {
  value: string
  attachments: string[]
  onChange: (val: string) => void
  onChangeAttachments: (next: string[]) => void

  selectionStart?: number
  selectionEnd?: number
  onSelectionChange?: (next: { selectionStart?: number; selectionEnd?: number }) => void

  onSend: (message: string, attachments: string[]) => void
  onAbort: () => void
  isThinking: boolean
  isConfigured: boolean

  // Suggested quick-reply actions from the last assistant response.
  suggestedActions?: string[]

  // Optional: parent can request focus restoration on context change.
  autoFocus?: boolean

  // Optional: key that changes when the input context changes (e.g. switching chats).
  // Used to apply one-time caret restoration (move to end) without clobbering typing selection.
  restoreKey?: string
}

const MAX_INPUT_HEIGHT_PX = 250

export default function ChatInput({
  value,
  attachments,
  onChange,
  onChangeAttachments,
  selectionStart,
  selectionEnd,
  onSelectionChange,
  onSend,
  onAbort,
  isThinking,
  isConfigured,
  suggestedActions,
  autoFocus,
  restoreKey,
}: ChatInputProps) {
  // Defensive defaults in case a caller ever mis-wires props.
  const safeValue = value ?? ''
  const safeAttachments = attachments ?? []

  const [visibleLines, setVisibleLines] = useState<number>(1)
  const [infoOpen, setInfoOpen] = useState<boolean>(false)
  const [flashBlocked, setFlashBlocked] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLDivElement>(null)
  const infoPopoverRef = useRef<HTMLDivElement>(null)

  const { uploadFile } = useFiles()

  const isMac = useMemo(() => {
    const nav = typeof navigator !== 'undefined' ? navigator : ({} as any)
    const platform = (nav.platform || '').toLowerCase()
    const ua = (nav.userAgent || '').toLowerCase()
    return platform.includes('mac') || ua.includes('mac')
  }, [])

  const modifierSymbol = isMac ? '⌘' : 'Ctrl'

  const computeVisibleLines = () => {
    const el = textareaRef.current
    if (!el) return
    const prevHeight = el.style.height
    el.style.height = 'auto'
    const computed = window.getComputedStyle(el)
    const lineHeightPx = parseFloat(computed.lineHeight || '0')
    const lineHeight = Number.isFinite(lineHeightPx) && lineHeightPx > 0 ? lineHeightPx : 20
    const lines = Math.max(1, Math.round(el.scrollHeight / lineHeight))
    el.style.height = prevHeight
    if (lines !== visibleLines) setVisibleLines(lines)
  }

  const autoSizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return

    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, MAX_INPUT_HEIGHT_PX)
    el.style.height = next + 'px'

    computeVisibleLines()
  }

  useEffect(() => {
    autoSizeTextarea()
    window.addEventListener('resize', autoSizeTextarea)
    return () => {
      window.removeEventListener('resize', autoSizeTextarea)
    }
    // NOTE: this intentionally re-runs on value changes (auto-size), but does not touch selection.
  }, [safeValue])

  // Restore focus on context change if requested.
  useEffect(() => {
    if (!autoFocus) return
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [autoFocus])

  // Track restoreKey changes to apply a one-time caret-to-end.
  const lastRestoreKeyRef = useRef<string | undefined>(restoreKey)
  const shouldMoveCaretToEndRef = useRef<boolean>(false)
  useEffect(() => {
    if (restoreKey === undefined) return
    if (lastRestoreKeyRef.current !== restoreKey) {
      lastRestoreKeyRef.current = restoreKey
      shouldMoveCaretToEndRef.current = true
    }
  }, [restoreKey])

  // Restore selection ONLY when parent explicitly provides selection OR when switching context.
  // Crucially: do NOT depend on `safeValue`, otherwise typing will re-apply stale selection
  // and cause caret jumps.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return

    // If requested, keep focus on the input as context changes.
    if (autoFocus) {
      try {
        el.focus()
      } catch {
        // ignore
      }
    }

    const len = el.value?.length ?? 0
    const hasSelection = typeof selectionStart === 'number' || typeof selectionEnd === 'number'

    // 1) If parent provides explicit selection, always honor it.
    if (hasSelection) {
      const rawStart =
        typeof selectionStart === 'number'
          ? selectionStart
          : typeof selectionEnd === 'number'
            ? selectionEnd
            : len
      const rawEnd =
        typeof selectionEnd === 'number'
          ? selectionEnd
          : typeof selectionStart === 'number'
            ? selectionStart
            : rawStart

      const start = Math.max(0, Math.min(rawStart, len))
      const end = Math.max(0, Math.min(rawEnd, len))

      try {
        el.setSelectionRange(start, end)
      } catch {
        // ignore
      }
      return
    }

    // 2) Otherwise only move caret to end once after a context switch/restore.
    if (shouldMoveCaretToEndRef.current) {
      shouldMoveCaretToEndRef.current = false
      try {
        el.setSelectionRange(len, len)
      } catch {
        // ignore
      }
    }
  }, [selectionStart, selectionEnd, autoFocus, restoreKey])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!infoOpen) return
      const pop = infoPopoverRef.current
      const btn = document.getElementById('chat-input-info-btn')
      if (pop && (pop === e.target || pop.contains(e.target as Node))) return
      if (btn && (btn === e.target || btn.contains(e.target as Node))) return
      setInfoOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [infoOpen])

  const triggerBlockedFlash = () => {
    setFlashBlocked(true)
    window.setTimeout(() => setFlashBlocked(false), 300)
  }

  const emitSelection = () => {
    const el = textareaRef.current
    if (!el) return
    if (!onSelectionChange) return
    onSelectionChange({ selectionStart: el.selectionStart ?? undefined, selectionEnd: el.selectionEnd ?? undefined })
  }

  const handleSend = () => {
    if (isThinking) {
      triggerBlockedFlash()
      return
    }
    if (!safeValue.trim() && safeAttachments.length === 0) return
    onSend(safeValue, safeAttachments)
    onChange('')
    onChangeAttachments([])
    // reset caret stored in parent
    if (onSelectionChange) onSelectionChange({ selectionStart: 0, selectionEnd: 0 })

    setInfoOpen(false)
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.focus()
      }
    })
  }

  const handleSuggestedAction = (action: string) => {
    if (isThinking || !isConfigured) return
    onSend(action, [])
    onChange('')
    onChangeAttachments([])
    if (onSelectionChange) onSelectionChange({ selectionStart: 0, selectionEnd: 0 })
    setInfoOpen(false)
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.focus()
      }
    })
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const content = event.target?.result as string
      const newPath = await uploadFile(file.name, content)
      if (newPath) {
        onChangeAttachments(Array.from(new Set([...(safeAttachments || []), newPath])))
      }
    }
    reader.readAsText(file)
  }

  const handleTextareaKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (isThinking) {
        triggerBlockedFlash()
        return
      }
      handleSend()
    }
  }

  const canSend = (safeValue.trim().length > 0 || safeAttachments.length > 0) && isConfigured

  const placeholderText = useMemo(
    () =>
      isConfigured
        ? 'Type your message…'
        : 'You can compose a message and reference files (@) and stories/features (#) even before configuring. Configure LLM to send.',
    [isConfigured],
  )

  const maxHeightStyle = useMemo(() => {
    return { maxHeight: MAX_INPUT_HEIGHT_PX }
  }, [])

  const showHintsArea = visibleLines <= 3

  const leftHints = useMemo(() => ['Use @ for file references', 'Use # for stories & features'], [])

  const rightHints = useMemo(() => [`${modifierSymbol} + Enter to send`], [modifierSymbol])

  const showSuggestedActions =
    !isThinking &&
    isConfigured &&
    Array.isArray(suggestedActions) &&
    suggestedActions.length > 0

  const renderHintsGrid = () => {
    return (
      <div className='grid grid-cols-2 grid-rows-2 gap-x-4 text-[12px] text-[var(--text-muted)]'>
        {leftHints.length <= 1 ? (
          <div className='col-start-1 row-span-2 self-center truncate'>{leftHints[0]}</div>
        ) : (
          <>
            <div className='col-start-1 row-start-1 truncate'>{leftHints[0]}</div>
            <div className='col-start-1 row-start-2 truncate'>{leftHints[1]}</div>
          </>
        )}

        {rightHints.length <= 1 ? (
          <div className='col-start-2 row-span-2 self-center text-right truncate'>
            {rightHints[0]}
          </div>
        ) : (
          <>
            <div className='col-start-2 row-start-1 text-right truncate'>{rightHints[0]}</div>
            <div className='col-start-2 row-start-2 text-right truncate'>{rightHints[1]}</div>
          </>
        )}
      </div>
    )
  }

  return (
    <div
      ref={chatInputRef}
      className='flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]'
    >
      {/* Suggested actions chips */}
      {showSuggestedActions && (
        <div
          className='flex gap-2 px-3 py-2 overflow-x-auto border-b border-[var(--border-subtle)]'
          role='group'
          aria-label='Suggested replies'
        >
          {suggestedActions!.map((action, idx) => (
            <button
              key={idx}
              type='button'
              onClick={() => handleSuggestedAction(action)}
              className={[
                'flex-shrink-0 px-3 py-1.5 rounded-full text-[13px] leading-tight',
                'border border-[var(--border-default)] bg-[var(--surface-base)]',
                'text-[var(--text-secondary)]',
                'hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]',
                'hover:border-[var(--accent-primary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]',
                'transition-colors duration-150',
              ].join(' ')}
              title={action}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      <div className='p-2'>
        <div className='relative'>
          <div className='flex gap-2'>
            {/* Main input box */}
            <div
              className={[
                'flex-1 bg-[var(--surface-base)] border rounded-md focus-within:ring-2',
                'border-[var(--border-default)] focus-within:ring-[var(--focus-ring)]',
                flashBlocked ? 'border-red-500 ring-2 ring-red-500/60' : '',
              ].join(' ')}
            >
              <div className='relative p-1'>
                <FileMentionsTextarea
                  value={safeValue}
                  onChange={(val) => {
                    onChange(val)
                  }}
                  placeholder={placeholderText}
                  rows={1}
                  // Allow typing while thinking
                  disabled={false}
                  className='w-full resize-none bg-transparent px-2 py-1 outline-none text-[var(--text-primary)]'
                  style={{ ...maxHeightStyle, overflowY: 'auto' }}
                  ariaLabel='Message input'
                  inputRef={textareaRef}
                  onKeyDown={(e) => {
                    handleTextareaKeyDown(e)
                  }}
                  // Keep selection synced for caret persistence
                  onSelect={() => emitSelection()}
                  onKeyUp={() => emitSelection()}
                  onMouseUp={() => emitSelection()}
                  onFocus={() => emitSelection()}
                />
              </div>

              {/* Attachments and bottom info area (hints) */}
              <div className='px-2 py-1.5 border-t border-[var(--border-subtle)]'>
                <AttachmentList
                  attachments={safeAttachments}
                  onRemove={(path) => onChangeAttachments((safeAttachments || []).filter((p) => p !== path))}
                  disabled={false}
                />

                <div
                  className='overflow-hidden transition-all duration-200 ease-out'
                  style={{
                    maxHeight: showHintsArea ? 80 : 0,
                    opacity: showHintsArea ? 1 : 0,
                    marginTop: showHintsArea ? 8 : 0,
                  }}
                  aria-hidden={!showHintsArea}
                >
                  {renderHintsGrid()}
                </div>
              </div>
            </div>

            {/* Right-side vertical controls anchored top/middle/bottom */}
            <div className='relative w-10'>
              {/* Attach (top) */}
              <div className='absolute top-0 left-0 right-0 flex items-start justify-center'>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className='btn-icon'
                  aria-label='Attach Files'
                  title='Attach Files'
                  type='button'
                  disabled={false}
                >
                  <IconAttach className='w-5 h-5' />
                </button>
                <input
                  type='file'
                  accept='.md,.txt,.json,.js,.jsx,.ts,.tsx,.css,.scss,.less,.html,.htm,.xml,.yml,.yaml,.csv,.log,.sh,.bash,.zsh,.bat,.ps1,.py,.rb,.java,.kt,.go,.rs,.c,.h,.cpp,.hpp,.m,.swift,.ini,.conf,.env'
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>

              {/* Middle: Send or Stop */}
              <div className='absolute left-0 right-0 top-1/2 -translate-y-1/2 flex items-center justify-center'>
                {!isThinking ? (
                  <button
                    onClick={handleSend}
                    className='btn-icon'
                    disabled={!canSend}
                    aria-label='Send message'
                    title='Send'
                  >
                    <IconSend className='w-5 h-5' />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const should = window.confirm(
                        'Stop the assistant? This will cancel the current response.',
                      )
                      if (!should) return
                      onAbort()
                    }}
                    className='relative btn-icon'
                    aria-label='Stop response'
                    title='Stop'
                  >
                    {/* Spinner ring */}
                    <span
                      className='absolute inset-0 m-auto block w-7 h-7 rounded-full border-2 border-[var(--text-muted)] border-t-transparent animate-spin'
                      aria-hidden
                    />
                    {/* Stop glyph using a small square */}
                    <span className='relative z-10 block w-3.5 h-3.5 bg-[var(--text-primary)] rounded-[2px]' />
                  </button>
                )}
              </div>

              {/* Info (bottom) */}
              <div className='absolute bottom-0 left-0 right-0 flex items-end justify-center'>
                <Tooltip
                  content={
                    <div className='p-2'>
                      <div className='font-medium mb-1 text-[var(--text-secondary)]'>
                        Shortcuts & helpers
                      </div>
                      <ul className='list-disc pl-5 space-y-1 text-sm'>
                        <li>Use @ for file references</li>
                        <li>Use # for stories & features</li>
                        <li>{modifierSymbol} + Enter to send</li>
                      </ul>
                    </div>
                  }
                  placement='top'
                >
                  <button
                    id='chat-input-info-btn'
                    type='button'
                    className={[
                      'inline-flex items-center justify-center w-6 h-6 rounded-full',
                      'border border-pink-500 text-pink-600 bg-transparent',
                      'hover:bg-pink-50 dark:hover:bg-pink-900/20',
                      'focus:outline-none focus:ring-2 focus:ring-pink-500/50',
                      'no-drag',
                    ].join(' ')}
                  >
                    <span className='text-[11px] font-semibold'>i</span>
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
