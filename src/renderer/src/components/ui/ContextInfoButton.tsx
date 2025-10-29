import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChatContext } from 'thefactory-tools'
import DependencyBullet from '../stories/DependencyBullet'

function collectDependencies(context: ChatContext): { deps: string[]; hasAny: boolean } {
  const deps: string[] = []
  // Story contexts
  if ((context as any).storyId) {
    deps.push((context as any).storyId)
  }
  // Feature contexts
  if ((context as any).featureId && (context as any).storyId) {
    deps.push(`${(context as any).storyId}.${(context as any).featureId}`)
  }
  return { deps, hasAny: deps.length > 0 }
}

export default function ContextInfoButton({
  context,
  label,
  className,
}: {
  context: ChatContext
  label?: string
  className?: string
}) {
  const { deps, hasAny } = useMemo(() => collectDependencies(context), [context])

  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(
    null,
  )
  const [arrowLeft, setArrowLeft] = useState<number>(16)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dialogId = useId()

  // Close on any context change (covers project/story/feature changes) and on unmount
  useEffect(() => {
    setOpen(false)
    return () => setOpen(false)
  }, [context])

  // Close on hash (route) change
  useEffect(() => {
    const onHash = () => setOpen(false)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Outside click and Esc handling
  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current && btnRef.current.contains(t)) return
      if (panelRef.current && panelRef.current.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Position the callout when opened; keep within viewport and anchor to the button
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const anchor = btnRef.current
    if (!anchor) return

    const place = () => {
      const a = anchor.getBoundingClientRect()
      const tip = panelRef.current
      const spacing = 8
      const vw = window.innerWidth
      const vh = window.innerHeight

      const width = tip?.offsetWidth || 280
      const height = tip?.offsetHeight || 10

      // Prefer bottom placement, fallback to top if needed
      let placement: 'top' | 'bottom' = 'bottom'
      let top = a.bottom + spacing
      let left = a.left + a.width / 2 - width / 2

      // Clamp horizontally first
      if (left + width > vw) left = Math.max(4, vw - width - 4)
      if (left < 0) left = 4

      // If bottom overflows, try top
      if (top + height > vh) {
        const altTop = a.top - spacing - height
        if (altTop >= 0) {
          placement = 'top'
          top = altTop
        } else {
          // Clamp within viewport if neither fits fully
          top = Math.max(4, Math.min(vh - height - 4, top))
        }
      }

      // Account for page scroll for absolute positioning in portal
      const finalTop = top + window.pageYOffset
      const finalLeft = left + window.pageXOffset

      setPos({ top: finalTop, left: finalLeft, placement })

      // Compute arrow position relative to panel left, centered under the button
      const anchorCenter = a.left + a.width / 2 + window.pageXOffset
      const rel = anchorCenter - finalLeft
      const arrowW = 12 // triangle base width
      const margin = 10
      const clampedRel = Math.max(margin + arrowW / 2, Math.min(width - margin - arrowW / 2, rel))
      setArrowLeft(clampedRel - arrowW / 2)
    }

    // Defer until after panel mounts and on resize/scroll
    requestAnimationFrame(place)
    const onWin = () => requestAnimationFrame(place)
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    return () => {
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
    }
  }, [open])

  const ariaLabel = label || 'Chat context information'

  // Render button in place
  const button = (
    <button
      type="button"
      ref={btnRef}
      className={[
        'inline-flex items-center justify-center w-6 h-6 rounded-full',
        'border border-blue-500 text-blue-600 bg-transparent',
        'hover:bg-blue-50 dark:hover:bg-blue-900/20',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
        'no-drag',
        className || '',
      ].join(' ')}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? dialogId : undefined}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setOpen((v) => !v)
        }
        if (e.key === 'Escape') setOpen(false)
      }}
    >
      <span className="text-[11px] font-semibold">i</span>
    </button>
  )

  // Render callout via portal to ensure absolute positioning is anchored to viewport
  const panel =
    open && pos
      ? createPortal(
          <div
            ref={panelRef}
            id={dialogId}
            role="dialog"
            aria-label="Chat context"
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              zIndex: 1100, // above header/chat scroll
              maxWidth: 'min(80vw, 360px)',
              // Ensure nested tooltips render above this panel
              // @ts-ignore - CSS variable custom property
              ['--z-tooltip' as any]: 2000,
            }}
            className="rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-xl"
          >
            {/* Arrow */}
            {pos.placement === 'bottom' ? (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: -6,
                  left: arrowLeft,
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderBottom: '6px solid var(--surface-overlay)',
                  filter: 'drop-shadow(0 -1px 0 var(--border-default))',
                }}
              />
            ) : (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  bottom: -6,
                  left: arrowLeft,
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '6px solid var(--surface-overlay)',
                  filter: 'drop-shadow(0 1px 0 var(--border-default))',
                }}
              />
            )}
            <div className="p-2 min-w-[200px]">
              {hasAny ? (
                <div className="flex flex-wrap gap-1">
                  {deps.map((d) => (
                    <DependencyBullet
                      key={d}
                      dependency={d}
                      interactive
                      notFoundDependencyDisplay={'*DELETED*'}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--text-secondary)] px-1 py-0.5">
                  No contextual items.
                </div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      {button}
      {panel}
    </>
  )
}
