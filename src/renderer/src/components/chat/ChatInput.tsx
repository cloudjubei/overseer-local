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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatInputRef = useRef<HTMLDivElement>(null)

  const { uploadFile } = useFiles()

  const autoSizeTextarea = () => {
    const el = textareaRef.current
    if (!el || !chatInputRef.current) return

    const parentHeight = chatInputRef.current.parentElement?.clientHeight || 0
    const maxHeight = parentHeight * 0.3

    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = next + 'px'
  }

  useEffect(() => {
    autoSizeTextarea()
    window.addEventListener('resize', autoSizeTextarea)
    return () => {
      window.removeEventListener('resize', autoSizeTextarea)
    }
  }, [input])

  const handleSend = () => {
    if (!input.trim() && pendingAttachments.length === 0) return
    onSend(input, pendingAttachments)
    setInput('')
    setPendingAttachments([])
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

  return (
    <div
      ref={chatInputRef}
      className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]"
    >
      <div className="p-2">
        <div className="relative">
          <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
            <div className="relative p-1">
              <FileMentionsTextarea
                value={input}
                onChange={setInput}
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

            <div className="px-2 py-1.5 border-t border-[var(--border-subtle)]">
              <AttachmentList
                attachments={pendingAttachments}
                onRemove={(path) => setPendingAttachments((prev) => prev.filter((p) => p !== path))}
                disabled={isThinking}
              />
              <div className="flex items-center justify-between gap-2 text-[12px] text-[var(--text-muted)]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="hidden sm:inline truncate">
                    Tip: Use @ for files • Use # for stories and features
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-1 justify-center text-center">
                  <span className="truncate">Cmd/Ctrl+Enter to send • Shift+Enter for newline</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
