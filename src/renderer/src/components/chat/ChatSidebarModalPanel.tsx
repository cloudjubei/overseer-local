import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ChatSidebar from './ChatSidebar'
import type { ChatContext } from 'thefactory-tools'
import { IconChevron, IconChat } from '../ui/icons/Icons'

export default function ChatSidebarModalPanel({
  isOpen = true,
  context,
  chatContextTitle,
  initialWidth = 380,
  onWidthChange,
}: {
  isOpen?: boolean
  context: ChatContext
  chatContextTitle: string
  initialWidth?: number
  onWidthChange?: (width: number, isFinal: boolean) => void
}) {
  // Early return BEFORE any hooks to keep hook order consistent across renders
  if (!isOpen) return null

  const [collapsed, setCollapsed] = useState(true)

  // Resolve metrics from CSS
  const getMetricPx = (name: string, fallback: number) => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name)
      const n = parseInt(v.trim().replace('px', ''), 10)
      return Number.isFinite(n) && n > 0 ? n : fallback
    } catch {
      return fallback
    }
  }
  const MIN_W = getMetricPx('--sidebar-w', 260)
  const COLLAPSED_W = getMetricPx('--sidebar-w-collapsed', 64)

  const [modalContainer, setModalContainer] = useState<HTMLElement | null>(null)
  const [modalPanel, setModalPanel] = useState<HTMLElement | null>(null)
  const [panelRect, setPanelRect] = useState<{ top: number; right: number; height: number } | null>(
    null,
  )

  const [width, setWidth] = useState<number>(() => {
    const maxByViewport = Math.floor(window.innerWidth * 0.5)
    return Math.max(MIN_W, Math.min(maxByViewport, initialWidth))
  })
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // Find modal anchors so we can render next to the dialog
  useEffect(() => {
    const container = document.querySelector<HTMLElement>('.tf-modal-container')
    const panel = document.querySelector<HTMLElement>('.tf-modal-panel')
    setModalContainer(container)
    setModalPanel(panel)
    return () => {
      setModalContainer(null)
      setModalPanel(null)
    }
  }, [])

  // Track modal panel geometry
  useEffect(() => {
    if (!modalPanel) return
    const updateRect = () => {
      const r = modalPanel.getBoundingClientRect()
      setPanelRect({ top: r.top, right: r.right, height: r.height })
    }
    const ro = new ResizeObserver(() => updateRect())
    updateRect()
    ro.observe(modalPanel)
    window.addEventListener('resize', updateRect)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateRect)
    }
  }, [modalPanel])

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onResizeMove)
      window.removeEventListener('pointerup', onResizeEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableNextToModal = useMemo(() => {
    if (!panelRect) return undefined
    return Math.max(0, window.innerWidth - panelRect.right)
  }, [panelRect])

  useEffect(() => {
    const maxByViewport = Math.floor(window.innerWidth * 0.5)
    const maxByContext = availableNextToModal
      ? Math.min(maxByViewport, availableNextToModal)
      : maxByViewport
    setWidth((w) => Math.max(MIN_W, Math.min(maxByContext, w)))
  }, [availableNextToModal, MIN_W])

  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (collapsed) return
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
    const next = startWidth - dx
    const maxByViewport = Math.floor(window.innerWidth * 0.5)
    const maxByContext = availableNextToModal
      ? Math.min(maxByViewport, availableNextToModal)
      : maxByViewport
    const clamped = Math.max(MIN_W, Math.min(maxByContext, next))
    setWidth(clamped)
    onWidthChange?.(clamped, false)
  }

  const onResizeEnd = (_e: PointerEvent) => {
    resizingRef.current = null
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeEnd)
    onWidthChange?.(width, true)
  }

  const transitionInOut = '200ms cubic-bezier(0.2, 0.8, 0.2, 1)'
  const effectiveWidth = collapsed ? COLLAPSED_W : width

  if (!modalContainer) return null

  if (collapsed) {
    let style: React.CSSProperties = {
      position: 'absolute',
      width: COLLAPSED_W,
      borderRadius: 'var(--radius-3)',
    }
    style = panelRect
      ? {
          ...style,
          top: panelRect.top,
          left: Math.min(panelRect.right, window.innerWidth),
          height: panelRect.height,
        }
      : {
          ...style,
          top: 0,
          right: 0,
          bottom: 0,
        }

    return createPortal(
      <aside className="chat-collapsed-panel z-[5] bg-surface-base" style={style}>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="btn-secondary btn-icon top"
          aria-label={'Expand chat sidebar'}
          title={'Expand chat sidebar'}
        >
          <IconChevron className="w-4 h-4" style={{ transform: 'rotate(180deg)' }} />
        </button>
        <button
          className="btn-secondary btn-icon center"
          onClick={() => setCollapsed(false)}
          aria-label="Open chat"
        >
          <IconChat className="w-5 h-5" />
        </button>
        <div className="bottom"></div>
      </aside>,
      modalContainer,
    )
  }
  let style: React.CSSProperties = {
    transition: `width ${transitionInOut}`,
    borderTopLeftRadius: 'var(--radius-3)',
    borderBottomLeftRadius: 'var(--radius-3)',
  }

  style = panelRect
    ? {
        ...style,
        top: panelRect.top,
        left: Math.min(panelRect.right, window.innerWidth),
        height: panelRect.height,
        width: Math.min(effectiveWidth, availableNextToModal || effectiveWidth),
      }
    : {
        ...style,
        top: 0,
        right: 0,
        bottom: 0,
        width: effectiveWidth,
      }

  return createPortal(
    <div
      className="absolute z-[5] bg-surface-base overflow-hidden"
      style={style}
      role="complementary"
      aria-label="Chat"
    >
      <div
        onPointerDown={onResizeStart}
        className="absolute left-0 top-0 bottom-0 w-5 cursor-col-resize group"
        aria-label="Resize chat sidebar"
        role="separator"
        aria-orientation="vertical"
      >
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-start"
          style={{ width: 34, height: 56 }}
          aria-hidden
        >
          <div className="h-full w-[14px] rounded-r-md bg-teal-500/20 border border-teal-500 shadow-md">
            <div className="h-full w-full flex flex-row items-center justify-center gap-[3px]">
              <div className="w-[2px] h-[30px] rounded-sm bg-teal-600" />
              <div className="w-[2px] h-[30px] rounded-sm bg-teal-600" />
              <div className="w-[2px] h-[30px] rounded-sm bg-teal-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 overflow-hidden">
        <ChatSidebar
          context={context}
          chatContextTitle={chatContextTitle}
          isCollapsible
          showLeftBorder={false}
          onCollapse={() => setCollapsed(true)}
        />
      </div>
    </div>,
    modalContainer,
  )
}
