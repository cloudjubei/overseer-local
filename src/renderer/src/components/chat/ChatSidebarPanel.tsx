import React, { useMemo, useRef, useState, useEffect } from 'react'
import ChatSidebar from './ChatSidebar'
import type { ChatContext } from 'thefactory-tools'
import { IconChevron, IconChat } from '../ui/icons/Icons'

export default function ChatSidebarPanel({
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
  const [collapsed, setCollapsed] = useState(true)

  if (!isOpen) return null

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

  const [width, setWidth] = useState<number>(() => {
    const maxByViewport = Math.floor(window.innerWidth * 0.5)
    return Math.max(MIN_W, Math.min(maxByViewport, initialWidth))
  })
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onResizeMove)
      window.removeEventListener('pointerup', onResizeEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    const clamped = Math.max(MIN_W, Math.min(maxByViewport, next))
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

  if (collapsed) {
    return (
      <aside
        className="chat-collapsed-panel z-30 h-full bg-white dark:bg-neutral-900 border-l dark:border-neutral-800 collapsed"
        style={{ width: COLLAPSED_W }}
      >
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
      </aside>
    )
  }

  const outerStyle: React.CSSProperties = {
    width: effectiveWidth,
    transition: `width ${transitionInOut}`,
    background: 'var(--surface-base)',
    position: 'relative',
    overflow: 'visible',
  }

  const innerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
  }

  return (
    <div
      className="h-full border-l dark:border-neutral-800"
      style={outerStyle}
      role="complementary"
      aria-label="Chat sidebar"
    >
      <div
        onPointerDown={onResizeStart}
        className="absolute left-0 top-0 bottom-0 w-5 cursor-col-resize group"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat sidebar"
        style={{ zIndex: 10 }}
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

      <div style={innerStyle}>
        <ChatSidebar
          context={context}
          chatContextTitle={chatContextTitle}
          isCollapsible
          showLeftBorder={false}
          onCollapse={() => setCollapsed(true)}
        />
      </div>
    </div>
  )
}
