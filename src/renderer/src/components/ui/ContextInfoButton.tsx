import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dialogId = useId()

  // Close on any context change (covers project/story/feature changes)
  useEffect(() => {
    setOpen(false)
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

  // Position the callout when opened; keep within viewport
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const anchor = btnRef.current
    const tip = panelRef.current
    if (!anchor) return
    // Use two-pass measure: first set offscreen to measure size if needed
    const place = () => {
      const a = anchor.getBoundingClientRect()
      const spacing = 8
      const vw = window.innerWidth
      const vh = window.innerHeight
      let top = a.bottom + spacing
      let left = a.left + Math.max(0, a.width / 2 - (tip?.offsetWidth || 0) / 2)
      // Clamp if overflow
      const width = tip?.offsetWidth || 280
      const height = tip?.offsetHeight || 10
      if (left + width > vw) left = Math.max(0, vw - width - 4)
      if (left < 0) left = 4
      if (top + height > vh) {
        // Try above the button
        const altTop = a.top - spacing - height
        top = altTop >= 0 ? altTop : Math.max(4, vh - height - 4)
      }
      setPos({ top: top + window.pageYOffset, left: left + window.pageXOffset })
    }
    // Defer until after panel mounts
    requestAnimationFrame(place)
    const onWin = () => requestAnimationFrame(place)
    window.addEventListener('resize', onWin)
    window.addEventListener('scroll', onWin, true)
    return () => {
      window.removeEventListener('resize', onWin)
      window.removeEventListener('scroll', onWin, true)
    }
  }, [open])

  // Unmount content when closed: achieved by conditional rendering

  // Replace hover tooltip with click-activated callout content
  const ariaLabel = label || 'Chat context information'

  return (
    <>
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

      {open && (
        <div
          ref={panelRef}
          id={dialogId}
          role="dialog"
          aria-label="Chat context"
          style={{
            position: 'absolute',
            top: pos ? pos.top : -99999,
            left: pos ? pos.left : -99999,
            zIndex: 1100, // above header/chat scroll
            maxWidth: 'min(80vw, 360px)',
          }}
          className="rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-xl"
        >
          {/* Arrow: use a small triangle, positioned relative to panel and approximated under the button */}
          <div
            aria-hidden
            style={{ position: 'absolute', top: -6, left: 16, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '6px solid var(--surface-overlay)', filter: 'drop-shadow(0 -1px 0 var(--border-default))' }}
          />
          <div className="p-2 min-w-[200px]">
            {hasAny ? (
              <div className="flex flex-wrap gap-1">
                {deps.map((d) => (
                  <DependencyBullet key={d} dependency={d} interactive notFoundDependencyDisplay={'*DELETED*'} />
                ))}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-secondary)] px-1 py-0.5">No contextual items.</div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
