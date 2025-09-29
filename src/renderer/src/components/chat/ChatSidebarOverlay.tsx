import React, { useRef, useState, useEffect } from 'react'
import ChatSidebar from './ChatSidebar'
import type { ChatContext } from 'thefactory-tools'

export default function ChatSidebarOverlay({
  isOpen,
  context,
  chatContextTitle,
  initialWidth = 380,
}: {
  isOpen: boolean
  context: ChatContext
  chatContextTitle: string
  initialWidth?: number
}) {
  const [width, setWidth] = useState<number>(initialWidth)
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    // Clean up in case overlay unmounts while resizing
    return () => {
      window.removeEventListener('pointermove', onResizeMove as any)
      window.removeEventListener('pointerup', onResizeEnd as any)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isOpen) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    resizingRef.current = { startX: e.clientX, startWidth: width }
    window.addEventListener('pointermove', onResizeMove)
    window.addEventListener('pointerup', onResizeEnd)
  }

  const onResizeMove = (e: PointerEvent) => {
    if (!resizingRef.current) return
    const { startX, startWidth } = resizingRef.current
    const dx = e.clientX - startX
    // handle is on the left edge; moving left increases width
    const next = startWidth - dx
    const clamped = Math.max(280, Math.min(720, next))
    setWidth(clamped)
  }

  const onResizeEnd = (_e: PointerEvent) => {
    resizingRef.current = null
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeEnd)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-[1100] border-l border-border bg-surface-base shadow-xl"
      style={{ width }}
      role="complementary"
      aria-label="Chat"
    >
      {/* Resize handle on the left edge */}
      <div
        onPointerDown={onResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--border-subtle)]"
        aria-label="Resize chat sidebar"
        role="separator"
        aria-orientation="vertical"
      />
      <div className="absolute inset-0 overflow-hidden">
        <ChatSidebar context={context} chatContextTitle={chatContextTitle} />
      </div>
    </div>
  )
}
