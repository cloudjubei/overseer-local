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
    // Temporarily ensure height reflects full content to get scrollHeight
    const prevHeight = el.style.height
    el.style.height = 'auto'
    const computed = window.getComputedStyle(el)
    const lineHeightPx = parseFloat(computed.lineHeight || '0')
    const lineHeight = Number.isFinite(lineHeightPx) && lineHeightPx > 0 ? lineHeightPx : 20
    const lines = Math.max(1, Math.round(el.scrollHeight / lineHeight))
    // Restore height will be set by autoSizeTextarea
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
        ? 'Type your message… Use @ for files and # for stories/features'
        : 'You can compose a message and reference files (@) and stories/features (#) even before configuring. Configure LLM to send.',
    [isConfigured],
  )

  const maxHeightStyle = useMemo(() => {
    if (!chatInputRef.current) return { maxHeight: '30vh' } // Fallback
    const parentHeight = chatInputRef.current.parentElement?.clientHeight || 0
    return { maxHeight: parentHeight * 0.3 }
  }, [chatInputRef.current])

  const showHintsArea = visibleLines <= 3

  const leftHints = useMemo(() => [
    'Use @ for file references',
    'Use # for stories & features',
  ], [])

  const rightHints = useMemo(() => [
    `${modifierSymbol} + Enter to send`,
  ], [modifierSymbol])

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

              {/* Attachments and bottom info area (no action buttons here) */}
              <div className="px-2 py-1.5 border-t border-[var(--border-subtle)]">
                <AttachmentList
                  attachments={pendingAttachments}
                  onRemove={(path) => setPendingAttachments((prev) => prev.filter((p) => p !== path))}
                  disabled={isThinking}
                />

                {showHintsArea && (
                  <div className="mt-2">
                    <div className="grid grid-cols-2 gap-4 text-[12px] text-[var(--text-muted)]">
                      {/* Left column hints */}
                      <div className={`flex flex-col ${leftHints.length > 1 ? 'justify-between' : 'justify-center'} min-h-[40px]`}>
                        {leftHints.length > 1 ? (
                          <>
                            <div className="truncate">{leftHints[0]}</div>
                            <div className="truncate">{leftHints[1]}</div>
                          </>
                        ) : (
                          <div className="truncate">{leftHints[0]}</div>
                        )}
                      </div>

                      {/* Right column hints */}
                      <div className={`flex flex-col items-end ${rightHints.length > 1 ? 'justify-between' : 'justify-center'} min-h-[40px]`}>
                        {rightHints.length > 1 ? (
                          <>
                            <div className="truncate">{rightHints[0]}</div>
                            <div className="truncate">{rightHints[1]}</div>
                          </>
                        ) : (
                          <div className="truncate">{rightHints[0]}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right-side vertical controls */}
            <div className="flex flex-col items-center gap-2 w-10">
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

              <button
                onClick={handleSend}
                className="btn-icon"
                disabled={!canSend || isThinking}
                aria-label="Send message"
              >
                <IconSend className="w-5 h-5" />
              </button>

              {/* Info button with top-left tooltip */}
              <div className="relative">
                <button
                  id="chat-input-info-btn"
                  type="button"
                  onClick={() => setInfoOpen((v) => !v)}
                  className="w-6 h-6 rounded-full border border-[var(--border-subtle)] text-[10px] leading-6 text-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]"
                  aria-haspopup="dialog"
                  aria-expanded={infoOpen}
                  aria-label="Show chat input tips"
                >
                  i
                </button>

                {infoOpen && (
                  <div
                    ref={infoPopoverRef}
                    role="dialog"
                    className="absolute bottom-full right-full mb-2 mr-2 z-10 w-64 rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] shadow-lg p-2 text-[12px] text-[var(--text-primary)]"
                  >
                    <div className="font-medium mb-1 text-[var(--text-secondary)]">Shortcuts & helpers</div>
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
  )
}
