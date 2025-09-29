import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
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

  // Track modal container/panel
  const [modalContainer, setModalContainer] = useState<HTMLElement | null>(null)
  const [modalPanel, setModalPanel] = useState<HTMLElement | null>(null)

  // Panel geometry used for positioning when inside modal
  const [panelRect, setPanelRect] = useState<{ top: number; right: number; height: number } | null>(
    null,
  )

  // Find modal anchors when open
  useEffect(() => {
    if (!isOpen) return
    const container = document.querySelector<HTMLElement>('.tf-modal-container')
    const panel = document.querySelector<HTMLElement>('.tf-modal-panel')
    setModalContainer(container)
    setModalPanel(panel)
  }, [isOpen])

  // Observe size/position changes of the modal panel
  useEffect(() => {
    if (!isOpen || !modalPanel) return

    const ro = new ResizeObserver(() => {
      const rect = modalPanel.getBoundingClientRect()
      setPanelRect({ top: rect.top, right: rect.right, height: rect.height })
    })

    // Initial measure
    const rect = modalPanel.getBoundingClientRect()
    setPanelRect({ top: rect.top, right: rect.right, height: rect.height })

    ro.observe(modalPanel)

    const onWinResize = () => {
      const r = modalPanel.getBoundingClientRect()
      setPanelRect({ top: r.top, right: r.right, height: r.height })
    }
    window.addEventListener('resize', onWinResize)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onWinResize)
    }
  }, [isOpen, modalPanel])

  // Clean up any global listeners from resize drag
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onResizeMove as any)
      window.removeEventListener('pointerup', onResizeEnd as any)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calculate available width next to modal (if any)
  const availableNextToModal = useMemo(() => {
    if (!panelRect) return undefined
    const margin = 8 // small gap to the right of modal
    const available = Math.max(0, window.innerWidth - panelRect.right - margin)
    return available
  }, [panelRect])

  useEffect(() => {
    if (!availableNextToModal) return
    // Clamp current width into available space
    setWidth((w) => Math.max(280, Math.min(Math.min(720, availableNextToModal), w)))
  }, [availableNextToModal])

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
    const maxByContext = availableNextToModal ? Math.min(720, availableNextToModal) : 720
    const clamped = Math.max(280, Math.min(maxByContext, next))
    setWidth(clamped)
  }

  const onResizeEnd = (_e: PointerEvent) => {
    resizingRef.current = null
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeEnd)
  }

  if (!isOpen) return null

  const SidebarContent = (
    <div
      className={
        // When inside modal container, we use lower z so the modal panel stays on top.
        // When global (no modal), we use a high z to appear above content.
        (modalContainer
          ? 'absolute z-[5] border-l border-border bg-surface-base shadow-xl'
          : 'fixed z-[1100] border-l border-border bg-surface-base shadow-xl') + ' will-change-transform'
      }
      style={
        modalContainer && panelRect
          ? {
              top: panelRect.top,
              left: Math.min(panelRect.right + 8, window.innerWidth),
              height: panelRect.height,
              width: Math.min(width, availableNextToModal || width),
              transition: 'transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 160ms',
              transform: 'translateX(0)'
            }
          : {
              top: 0,
              right: 0,
              bottom: 0,
              width,
            }
      }
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

  // If we have a modal container, render inside it so we can sit between the overlay and panel
  if (modalContainer) {
    return createPortal(SidebarContent, modalContainer)
  }

  // Fallback: fixed to the viewport right edge
  return SidebarContent
}
