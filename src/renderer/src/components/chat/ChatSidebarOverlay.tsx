import React, { useRef, useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import ChatSidebar from './ChatSidebar'
import type { ChatContext } from 'thefactory-tools'
import { useAppSettings } from '@renderer/contexts/AppSettingsContext'

export default function ChatSidebarOverlay({
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
  // Called during resize (continuous) and on release (final)
  onWidthChange?: (width: number, isFinal: boolean) => void
}) {
  const { appSettings } = useAppSettings()
  const collapsed = appSettings.userPreferences.chatSidebarCollapsed

  // Resolve min/collapsed width from CSS vars to mirror main sidebar
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

  // Track modal container/panel (for popups). If present we render adjacent to the modal.
  const [modalContainer, setModalContainer] = useState<HTMLElement | null>(null)
  const [modalPanel, setModalPanel] = useState<HTMLElement | null>(null)

  // Panel geometry used for positioning when inside modal
  const [panelRect, setPanelRect] = useState<{ top: number; right: number; height: number } | null>(
    null,
  )

  // Width state/resize handling for the expanded state
  const [width, setWidth] = useState<number>(() => {
    const maxByViewport = Math.floor(window.innerWidth * 0.5)
    return Math.max(MIN_W, Math.min(maxByViewport, initialWidth))
  })
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // Find modal anchors so we can render flush-right to the popup
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

  // Observe size/position changes of the modal panel
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
    const available = Math.max(0, window.innerWidth - panelRect.right)
    return available
  }, [panelRect])

  // Clamp current width into constraints when environment changes
  useEffect(() => {
    const maxByViewport = Math.floor(window.innerWidth * 0.5)
    const maxByContext = availableNextToModal
      ? Math.min(maxByViewport, availableNextToModal)
      : maxByViewport
    setWidth((w) => Math.max(MIN_W, Math.min(maxByContext, w)))
  }, [availableNextToModal, MIN_W])

  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only allow resize when expanded
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
    // handle is on the left edge; moving left increases width (dx negative => wider)
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

  // If consumer explicitly closes it (legacy prop), render nothing
  if (!isOpen) return null

  const transitionInOut = '200ms cubic-bezier(0.2, 0.8, 0.2, 1)'

  const isModal = !!modalContainer
  const effectiveWidth = collapsed ? COLLAPSED_W : width

  // ===========================
  // Modal/popup behavior: attach next to the modal panel; show a slim bar when collapsed.
  // ===========================
  if (isModal) {
    const baseClass =
      'absolute z-[5] border-l border-border bg-surface-base will-change-transform overflow-hidden'
    const roundedLeft: React.CSSProperties = collapsed
      ? {}
      : { borderTopLeftRadius: 'var(--radius-3)', borderBottomLeftRadius: 'var(--radius-3)' }

    const style: React.CSSProperties = panelRect
      ? {
          top: panelRect.top,
          left: Math.min(panelRect.right, window.innerWidth), // no gap
          height: panelRect.height,
          width: Math.min(effectiveWidth, availableNextToModal || effectiveWidth),
          transition: `width ${transitionInOut}`,
          ...roundedLeft,
        }
      : {
          top: 0,
          right: 0,
          bottom: 0,
          width: effectiveWidth,
          transition: `width ${transitionInOut}`,
          ...roundedLeft,
        }

    return createPortal(
      <div className={baseClass} style={style} role="complementary" aria-label="Chat">
        {/* Minimal resize handle for modal (keep unobtrusive) */}
        {!collapsed && (
          <div
            onPointerDown={onResizeStart}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--border-subtle)]"
            aria-label="Resize chat sidebar"
            role="separator"
            aria-orientation="vertical"
          />
        )}
        <div className="absolute inset-0 overflow-hidden">
          <ChatSidebar context={context} chatContextTitle={chatContextTitle} />
        </div>
      </div>,
      modalContainer!,
    )
  }

  // ===========================
  // Normal screens: PUSH layout by occupying width in flex row
  // ===========================

  // Outer container participates in layout; width animates between collapsed and expanded width
  const outerStyle: React.CSSProperties = {
    width: effectiveWidth,
    transition: `width ${transitionInOut}`,
    borderLeft: '1px solid var(--border-border, var(--border-default))',
    background: 'var(--surface-base)',
    position: 'relative',
    overflow: 'visible', // Allow handle to overflow
  }

  // Inner area
  const innerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
  }

  return (
    <div style={outerStyle} role="complementary" aria-label="Chat sidebar">
      {/* Visible drag handle centered on left edge (normal screens only) */}
      {!collapsed && (
        <div
          onPointerDown={onResizeStart}
          className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize group"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat sidebar"
          style={{ zIndex: 10 }}
        >
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center"
            style={{ width: 22, height: 44 }}
            aria-hidden
          >
            <div
              className="h-full w-[6px] rounded-md bg-[var(--surface-raised)] border border-[var(--border-default)] shadow-sm group-hover:bg-[color-mix(in_srgb,_var(--accent-primary)_16%,_var(--surface-raised))]"
            >
              <div className="w-[2px] h-[60%] mx-auto my-[20%] rounded bg-[var(--border-subtle)]" />
            </div>
          </div>
        </div>
      )}

      <div style={innerStyle}>
        <ChatSidebar context={context} chatContextTitle={chatContextTitle} />
      </div>
    </div>
  )
}
