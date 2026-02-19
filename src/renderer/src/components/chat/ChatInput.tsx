import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFiles } from '../../contexts/FilesContext'
import AttachmentList from './AttachmentList'
import FileMentionsTextarea from '../ui/FileMentionsTextarea'
import { IconAttach, IconSend } from '../ui/icons/Icons'
import Tooltip from '../ui/Tooltip'

type SendReason = 'user' | 'suggested_action'

interface ChatInputProps {
  value: string
  attachments: string[]
  onChange: (val: string) => void
  onChangeAttachments: (next: string[]) => void

  selectionStart?: number
  selectionEnd?: number
  onSelectionChange?: (next: { selectionStart?: number; selectionEnd?: number }) => void

  onSend: (message: string, attachments: string[], meta?: { reason?: SendReason }) => void
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

  // Controls whether the input should clear itself after certain actions.
  clearOnSend?: boolean
  clearOnSuggestedAction?: boolean
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
  clearOnSend = false,
  clearOnSuggestedAction = false,
}: ChatInputProps) {
  const safeValue = value ?? ''
  const safeAttachments = attachments ?? []

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

  // --- Autosize ---
  const autosizeRafRef = useRef<number | null>(null)

  const autoSizeTextareaNow = useCallback(() => {
    const el = textareaRef.current
    if (!el) return

    // More robust than '0px': let the browser compute a natural height first.
    // This handles wrap changes when width changes.
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, MAX_INPUT_HEIGHT_PX)
    el.style.height = next + 'px'
  }, [])

  const requestAutosize = useCallback(() => {
    if (autosizeRafRef.current) return
    autosizeRafRef.current = requestAnimationFrame(() => {
      autosizeRafRef.current = null
      autoSizeTextareaNow()
    })
  }, [autoSizeTextareaNow])

  // Autosize on value changes (once per frame)
  useEffect(() => {
    requestAutosize()
  }, [safeValue, requestAutosize])

  // Autosize when layout-affecting UI changes (e.g. suggested actions bar mounts/unmounts,
  // attachments wrap, etc.). These can change line-wrapping without changing `value`.
  useEffect(() => {
    requestAutosize()
  }, [
    requestAutosize,
    safeAttachments.length,
    Array.isArray(suggestedActions) ? suggestedActions.length : 0,
  ])

  // Autosize when textarea width changes (sidebar resize, suggested actions appear, etc.)
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return

    let prevWidth = el.clientWidth

    const ro = new ResizeObserver(() => {
      const nextWidth = el.clientWidth
      if (nextWidth !== prevWidth) {
        prevWidth = nextWidth
        requestAutosize()
      }
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [requestAutosize])

  // Bind resize listener once
  useEffect(() => {
    const onResize = () => requestAutosize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [requestAutosize])

  // --- Focus and caret restoration ---
  // Only restore focus + caret when the context (restoreKey) actually changes.
  // During normal typing the browser manages the caret natively.
  const lastRestoreKeyRef = useRef<string | undefined>(restoreKey)

  useLayoutEffect(() => {
    // Only fire on mount or when restoreKey changes.
    if (restoreKey === undefined) return
    if (lastRestoreKeyRef.current === restoreKey) return
    lastRestoreKeyRef.current = restoreKey

    const el = textareaRef.current
    if (!el) return

    if (autoFocus) {
      try {
        el.focus()
      } catch {
        /* ignore */
      }
    }

    const len = el.value?.length ?? 0
    const hasSelection = typeof selectionStart === 'number' || typeof selectionEnd === 'number'

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
        /* ignore */
      }
    } else {
      try {
        el.setSelectionRange(len, len)
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreKey])

  // Also restore focus when autoFocus toggles on (e.g. nonce bump).
  useEffect(() => {
    if (!autoFocus) return
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [autoFocus])

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

  // --- Selection emission ---
  // We only emit selection to the parent on specific user gestures (select, mouseUp, blur).
  // We do NOT schedule rAF per keystroke. This avoids the round-trip that causes
  // stale selection to flow back as props and call setSelectionRange mid-typing.
  const emitSelectionNow = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    if (!onSelectionChange) return
    onSelectionChange({
      selectionStart: el.selectionStart ?? undefined,
      selectionEnd: el.selectionEnd ?? undefined,
    })
  }, [onSelectionChange])

  useEffect(() => {
    return () => {
      if (autosizeRafRef.current) cancelAnimationFrame(autosizeRafRef.current)
    }
  }, [])

  const clearInput = () => {
    onChange('')
    onChangeAttachments([])
    if (onSelectionChange) onSelectionChange({ selectionStart: 0, selectionEnd: 0 })
  }

  const handleSend = () => {
    if (isThinking) {
      triggerBlockedFlash()
      return
    }
    if (!safeValue.trim() && safeAttachments.length === 0) return

    onSend(safeValue, safeAttachments, { reason: 'user' })

    if (clearOnSend) clearInput()

    setInfoOpen(false)
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        requestAutosize()
      }
    })
  }

  const handleSuggestedAction = (action: string) => {
    if (isThinking || !isConfigured) return
    onSend(action, [], { reason: 'suggested_action' })

    if (clearOnSuggestedAction) clearInput()

    setInfoOpen(false)
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        requestAutosize()
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
                  disableAutocomplete={false}
                  onChange={(val) => {
                    onChange(val)
                    requestAutosize()
                  }}
                  placeholder={placeholderText}
                  rows={1}
                  disabled={false}
                  className='w-full resize-none bg-transparent px-2 py-1 outline-none text-[var(--text-primary)]'
                  style={{ ...maxHeightStyle, overflowY: 'auto' }}
                  ariaLabel='Message input'
                  inputRef={textareaRef}
                  onKeyDown={(e) => {
                    handleTextareaKeyDown(e)
                  }}
                  onSelect={() => emitSelectionNow()}
                  onMouseUp={() => emitSelectionNow()}
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
                    maxHeight: 80,
                    opacity: 1,
                    marginTop: 8,
                  }}
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
                      const should = window.confirm('Stop the assistant? This will cancel the current response.')
                      if (!should) return
                      onAbort()
                    }}
                    className='relative btn-icon'
                    aria-label='Stop response'
                    title='Stop'
                  >
                    <span
                      className='absolute inset-0 m-auto block w-7 h-7 rounded-full border-2 border-[var(--text-muted)] border-t-transparent animate-spin'
                      aria-hidden
                    />
                    <span className='relative z-10 block w-3.5 h-3.5 bg-[var(--text-primary)] rounded-[2px]' />
                  </button>
                )}
              </div>

              {/* Info (bottom) */}
              <div className='absolute bottom-0 left-0 right-0 flex items-end justify-center'>
                <Tooltip
                  content={
                    <div className='p-2'>
                      <div className='font-medium mb-1 text-[var(--text-secondary)]'>Shortcuts & helpers</div>
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
