import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useFiles } from '../../contexts/FilesContext'
import AttachmentList from './AttachmentList'
import FileMentionsTextarea from '../ui/FileMentionsTextarea'

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

  const { uploadFile } = useFiles()

  const autoSizeTextarea = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const max = 200
    const next = Math.min(el.scrollHeight, max)
    el.style.height = next + 'px'
  }

  useEffect(() => {
    autoSizeTextarea()
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

  return (
    <div className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]">
      <div className="p-3">
        <div className="relative flex items-end gap-2">
          <div className="flex-1 bg-[var(--surface-base)] border border-[var(--border-default)] rounded-md focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
            <div className="relative">
              <FileMentionsTextarea
                value={input}
                onChange={setInput}
                placeholder={placeholderText}
                rows={1}
                disabled={isThinking}
                className="w-full resize-none bg-transparent px-3 py-2 outline-none text-[var(--text-primary)]"
                style={{ maxHeight: 200, overflowY: 'auto' }}
                ariaLabel="Message input"
                inputRef={textareaRef}
                onKeyDown={handleTextareaKeyDown}
              />
            </div>

            <div className="px-3 py-1 border-t border-[var(--border-subtle)]">
              <AttachmentList
                attachments={pendingAttachments}
                onRemove={(path) => setPendingAttachments((prev) => prev.filter((p) => p !== path))}
                disabled={isThinking}
              />
              <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary"
                    aria-label="Attach a document"
                    type="button"
                    disabled={isThinking}
                  >
                    Attach
                  </button>
                  <input
                    type="file"
                    accept=".md,.txt,.json,.js,.jsx,.ts,.tsx,.css,.scss,.less,.html,.htm,.xml,.yml,.yaml,.csv,.log,.sh,.bash,.zsh,.bat,.ps1,.py,.rb,.java,.kt,.go,.rs,.c,.h,.cpp,.hpp,.m,.swift,.ini,.conf,.env"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <span className="hidden sm:inline">
                    Tip: Use @ for files • Use # for stories and features
                  </span>
                </div>
                <span>Cmd/Ctrl+Enter to send • Shift+Enter for newline</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSend}
            className="btn"
            disabled={!canSend || isThinking}
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
