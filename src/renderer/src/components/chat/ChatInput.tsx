import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useFiles } from '../../contexts/FilesContext'
import AttachmentList from './AttachmentList'
import FileMentionsTextarea from '../ui/FileMentionsTextarea'
import { IconAttach, IconSend } from '../ui/Icons'

interface ChatInputProps {
  onSend: (message: string, attachments: string[]) => void
  isThinking: boolean
  isConfigured: boolean
}

export default function ChatInput({ onSend, isThinking, isConfigured }: ChatInputProps) {
  const [input, setInput] = useState<string>('')
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([])
  const [visibleLines, setVisibleLines] = useState<number>(1)
  const [infoOpen, setInfoOpen] = useState<boolean>(false)

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
    if (!el || !chatInputRef.current) return

    const parentHeight = chatInputRef.current.parentElement?.clientHeight || 0
    const maxHeight = parentHeight * 0.3

    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = next + 'px'

    computeVisibleLines()
  }

  useEffect(() => {
    autoSizeTextarea()
    window.addEventListener('resize', autoSizeTextarea)
    return () => {
      window.removeEventListener('resize', autoSizeTextarea)
    }
  }, [input])

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

  const handleSend = () => {
    if (!input.trim() && pendingAttachments.length === 0) return
    onSend(input, pendingAttachments)
    setInput('')
    setPendingAttachments([])
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
        setPendingAttachments((prev) => Array.from(new Set([...prev, newPath])))
      }
    }
    reader.readAsText(file)
  }

  const handleTextareaKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = (input.trim().length > 0 || pendingAttachments.length > 0) && isConfigured

  const placeholderText = useMemo(
    () =>
      isConfigured
        ? 'Type your message…'
        : 'You can compose a message and reference files (@) and stories/features (#) even before configuring. Configure LLM to send.',
    [isConfigured],
  )

  const maxHeightStyle = useMemo(() => {
    if (!chatInputRef.current) return { maxHeight: '30vh' } // Fallback
    const parentHeight = chatInputRef.current.parentElement?.clientHeight || 0
    return { maxHeight: parentHeight * 0.3 }
  }, [chatInputRef.current])

  const showHintsArea = visibleLines <= 3

  const leftHints = useMemo(() => ['Use @ for file references', 'Use # for stories & features'], [])

  const rightHints = useMemo(() => [`${modifierSymbol} + Enter to send`], [modifierSymbol])

  // Precompute grid content slots (top-left, top-right, bottom-left, bottom-right)
  const renderHintsGrid = () => {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-x-4 text-[12px] text-[var(--text-muted)]">
        {/* Left side */}
        {leftHints.length <= 1 ? (
          <div className="col-start-1 row-span-2 self-center truncate">{leftHints[0]}</div>
        ) : (
          <>
            <div className="col-start-1 row-start-1 truncate">{leftHints[0]}</div>
            <div className="col-start-1 row-start-2 truncate">{leftHints[1]}</div>
          </>
        )}

        {/* Right side */}
        {rightHints.length <= 1 ? (
          <div className="col-start-2 row-span-2 self-center text-right truncate">
            {rightHints[0]}
          </div>
        ) : (
          <>
            <div className="col-start-2 row-start-1 text-right truncate">{rightHints[0]}</div>
            <div className="col-start-2 row-start-2 text-right truncate">{rightHints[1]}</div>
          </>
        )}
      </div>
    )
  }

  return (
    <div
      ref={chatInputRef}
      className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]"
    >
      <div className="p-2">
        <div className="relative">
          <div className="flex gap-2">
            {/* Main input box */}
            <div className="flex-1 bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
              <div className="relative p-1">
                <FileMentionsTextarea
                  value={input}
                  onChange={(val) => {
                    setInput(val)
                  }}
                  placeholder={placeholderText}
                  rows={1}
                  disabled={isThinking}
                  className="w-full resize-none bg-transparent px-2 py-1 outline-none text-[var(--text-primary)]"
                  style={{ ...maxHeightStyle, overflowY: 'auto' }}
                  ariaLabel="Message input"
                  inputRef={textareaRef}
                  onKeyDown={handleTextareaKeyDown}
                />
              </div>

              {/* Attachments and bottom info area (hints) */}
              <div className="px-2 py-1.5 border-t border-[var(--border-subtle)]">
                <AttachmentList
                  attachments={pendingAttachments}
                  onRemove={(path) =>
                    setPendingAttachments((prev) => prev.filter((p) => p !== path))
                  }
                  disabled={isThinking}
                />

                {/* Hints area with fade and collapse animation */}
                <div
                  className="overflow-hidden transition-all duration-200 ease-out"
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
            <div className="relative w-10">
              {/* Attach (top) */}
              <div className="absolute top-0 left-0 right-0 flex items-start justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-icon"
                  aria-label="Attach a document"
                  type="button"
                  disabled={isThinking}
                >
                  <IconAttach className="w-5 h-5" />
                </button>
                <input
                  type="file"
                  accept=".md,.txt,.json,.js,.jsx,.ts,.tsx,.css,.scss,.less,.html,.htm,.xml,.yml,.yaml,.csv,.log,.sh,.bash,.zsh,.bat,.ps1,.py,.rb,.java,.kt,.go,.rs,.c,.h,.cpp,.hpp,.m,.swift,.ini,.conf,.env"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>

              {/* Send (middle) */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
                <button
                  onClick={handleSend}
                  className="btn-icon"
                  disabled={!canSend || isThinking}
                  aria-label="Send message"
                >
                  <IconSend className="w-5 h-5" />
                </button>
              </div>

              {/* Info (bottom) */}
              <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center">
                <div className="relative">
                  <button
                    id="chat-input-info-btn"
                    type="button"
                    onClick={() => setInfoOpen((v) => !v)}
                    className={[
                      'inline-flex items-center justify-center w-6 h-6 rounded-full',
                      'border border-pink-500 text-pink-600 bg-transparent',
                      'hover:bg-pink-50 dark:hover:bg-pink-900/20',
                      'focus:outline-none focus:ring-2 focus:ring-pink-500/50',
                      'no-drag',
                    ].join(' ')}
                    aria-haspopup="dialog"
                    aria-expanded={infoOpen}
                    aria-label="Show chat input tips"
                    title="Chat input tips"
                  >
                    <span className="text-[11px] font-semibold">i</span>
                  </button>

                  {infoOpen && (
                    <div
                      ref={infoPopoverRef}
                      role="dialog"
                      className="absolute bottom-full right-full mb-2 mr-2 z-10 w-64 rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] shadow-lg p-2 text-[12px] text-[var(--text-primary)]"
                    >
                      <div className="font-medium mb-1 text-[var(--text-secondary)]">
                        Shortcuts & helpers
                      </div>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Use @ for file references</li>
                        <li>Use # for stories & features</li>
                        <li>{modifierSymbol} + Enter to send</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
