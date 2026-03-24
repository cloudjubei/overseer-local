import React, { useEffect, useLayoutEffect, useRef, useState, useId, JSX } from 'react'
import { createPortal } from 'react-dom'

export type TooltipProps = {
  children: React.ReactNode
  content: React.ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  allowedPlacements?: ('top' | 'bottom' | 'left' | 'right')[]
  /**
   * For side placements ('left'/'right') controls vertical alignment.
   * - 'center': vertically centered to anchor (default, legacy behavior)
   * - 'start': align tooltip top to anchor top (keeps header stable when content height shrinks/grows)
   * - 'end': align tooltip bottom to anchor bottom
   */
  sideAlign?: 'center' | 'start' | 'end'
  delayMs?: number
  disabled?: boolean
  /**
   * Visual style for the tooltip container.
   * - 'default': tooltip draws its own surface (bg/border/shadow/padding) via CSS.
   * - 'bare': tooltip container is chrome-less so the content can render its own card.
   */
  variant?: 'default' | 'bare'
  anchorAs?: keyof JSX.IntrinsicElements
  anchorClassName?: string
  anchorStyle?: React.CSSProperties
  anchorRef?: React.RefObject<HTMLElement | null>
  disableClickToggle?: boolean
  anchorTabIndex?: number
  zIndex?: number
  /**
   * Extra time (ms) to keep the tooltip open after mouse leaves.
   * Useful when content resizes under the cursor (e.g. toggling views).
   */
  closeDelayMs?: number
}

export default function Tooltip({
  children,
  content,
  placement = 'right',
  allowedPlacements,
  sideAlign = 'center',
  delayMs = 300,
  disabled = false,
  variant = 'default',
  anchorAs = 'span',
  anchorClassName,
  anchorStyle,
  anchorRef: externalAnchorRef,
  disableClickToggle = false,
  anchorTabIndex,
  zIndex,
  closeDelayMs,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [maxWidth, setMaxWidth] = useState<number | undefined>(undefined)
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined)
  const [effectivePlacement, setEffectivePlacement] = useState<'top' | 'bottom' | 'left' | 'right'>(
    placement,
  )
  const timerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const internalAnchorRef = useRef<HTMLElement | null>(null)
  const anchorRef = externalAnchorRef || internalAnchorRef
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const tooltipId = useId()

  // We need to measure multiple times:
  // - pass 0 measures natural size
  // - we set maxHeight/maxWidth
  // - pass 1+ measures with constraints applied so clamping is correct
  const measurePassRef = useRef<0 | 1 | 2>(0)

  // Changing content size after open (e.g. toggling Inline->Split) should re-measure.
  const sizeObserverRef = useRef<ResizeObserver | null>(null)

  // Mouse position tracking (used for a best-effort stay-open-on-resize).
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null)

  // The committed top position after initial placement. Used to lock the top edge
  // so that when content grows/shrinks the card only expands downward (or shrinks
  // upward from the bottom), keeping the top stable under the user's cursor.
  const committedTopRef = useRef<number | null>(null)

  // Ref mirror of `position` so the ResizeObserver callback can read the current
  // value without needing to be re-created every time position changes.
  const positionRef = useRef<{ top: number; left: number } | null>(null)

  // Tracks the RAF scheduled when we defer measurement because the parent tooltip
  // is still measuring offscreen. Must be cancelled on close / re-run.
  const deferredMeasureRafRef = useRef<number | null>(null)

  const cancelDeferredMeasure = () => {
    if (deferredMeasureRafRef.current != null) {
      window.cancelAnimationFrame(deferredMeasureRafRef.current)
      deferredMeasureRafRef.current = null
    }
  }

  const DEFAULT_CLOSE_DELAY = 160
  const CLOSE_DELAY = closeDelayMs ?? DEFAULT_CLOSE_DELAY

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
      cancelDeferredMeasure()
      removeOutsideHandlers()
      if (sizeObserverRef.current) sizeObserverRef.current.disconnect()
      sizeObserverRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearOpenTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const show = (immediate = false) => {
    if (disabled) return
    clearHideTimer()
    if (immediate) {
      clearOpenTimer()
      setOpen(true)
      return
    }
    clearOpenTimer()
    timerRef.current = window.setTimeout(() => setOpen(true), delayMs) as any
  }
  const hide = (immediate = false) => {
    if (pinned && !immediate) return
    clearOpenTimer()
    clearHideTimer()
    if (immediate) {
      setOpen(false)
      setPinned(false)
      return
    }
    hideTimerRef.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY) as any
  }

  const onDocMouseDown = (e: MouseEvent) => {
    if (!open) return
    const t = e.target as Node
    if (anchorRef.current && anchorRef.current.contains(t)) return
    if (tooltipRef.current && tooltipRef.current.contains(t)) return
    setPinned(false)
    hide(true)
  }
  const onDocKeyDown = (e: KeyboardEvent) => {
    if (!open) return
    if (e.key === 'Escape') {
      setPinned(false)
      hide(true)
    }
  }
  const addOutsideHandlers = () => {
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onDocKeyDown)
  }
  const removeOutsideHandlers = () => {
    document.removeEventListener('mousedown', onDocMouseDown)
    document.removeEventListener('keydown', onDocKeyDown)
  }

  useEffect(() => {
    if (open) addOutsideHandlers()
    else removeOutsideHandlers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Track pointer location globally while open. This avoids relying on React
  // onMouseMove which may not fire during a click-triggered resize.
  useEffect(() => {
    if (!open) return

    const onPointerMove = (e: PointerEvent) => {
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }

    const onMouseMove = (e: MouseEvent) => {
      lastMouseRef.current = { x: e.clientX, y: e.clientY }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('mousemove', onMouseMove, { passive: true })

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [open])

  const requestMeasure = () => {
    measurePassRef.current = 0
    setPosition({ top: -9999, left: -9999 })
  }

  // On open: trigger initial measurement, then proactively trigger 1-2 more measurements
  // on upcoming frames so expensive content clamps before any user scroll.
  useLayoutEffect(() => {
    if (!open) {
      cancelDeferredMeasure()
      setPosition(null)
      setMaxWidth(undefined)
      setMaxHeight(undefined)
      setEffectivePlacement(placement)
      measurePassRef.current = 0
      committedTopRef.current = null
      return
    }
    if (!anchorRef.current) return

    requestMeasure()

    let raf1: number | null = null
    let raf2: number | null = null
    raf1 = window.requestAnimationFrame(() => {
      if (!open) return
      requestMeasure()
      raf2 = window.requestAnimationFrame(() => {
        if (!open) return
        requestMeasure()
      })
    })

    return () => {
      if (raf1 != null) window.cancelAnimationFrame(raf1)
      if (raf2 != null) window.cancelAnimationFrame(raf2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placement, anchorRef])

  // Observe tooltip content size changes (e.g. toggle inline/split) and re-measure.
  useEffect(() => {
    if (!open) return
    if (!tooltipRef.current) return

    if (sizeObserverRef.current) sizeObserverRef.current.disconnect()

    const obs = new ResizeObserver(() => {
      if (!tooltipRef.current) return

      // Avoid infinite loops: only react once we have a real position.
      const currentPos = positionRef.current
      if (!currentPos || currentPos.top <= -5000) return

      const tip = tooltipRef.current
      const viewportHeight = window.innerHeight
      const spacing = 8
      const lockedTop = committedTopRef.current

      if (lockedTop !== null) {
        // Content changed height (e.g. accordion open/close). Keep the committed top
        // locked so the card grows downward. Only shift it up if we'd overflow the
        // viewport bottom — but never above the cursor, so the card stays under it.
        const newHeight = tip.getBoundingClientRect().height
        let newTop = lockedTop
        const bottomOverflow = lockedTop + newHeight + spacing - viewportHeight
        if (bottomOverflow > 0) {
          newTop = lockedTop - bottomOverflow
          const m = lastMouseRef.current
          if (m) newTop = Math.min(newTop, m.y - 4)
          newTop = Math.max(spacing, newTop)
        }
        
        positionRef.current = { top: newTop, left: currentPos.left }
        setPosition({ top: newTop, left: currentPos.left })
      } else {
        // No committed top yet — fall back to full remeasure.
        requestMeasure()
      }

      // Best-effort: if pointer is still inside new bounds, keep open.
      const m = lastMouseRef.current
      if (m) {
        const r = tip.getBoundingClientRect()
        const inside = m.x >= r.left && m.x <= r.right && m.y >= r.top && m.y <= r.bottom
        if (inside) {
          clearHideTimer()
          show(true)
        }
      }
    })

    obs.observe(tooltipRef.current)
    sizeObserverRef.current = obs

    return () => {
      obs.disconnect()
      if (sizeObserverRef.current === obs) sizeObserverRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useLayoutEffect(() => {
    if (!open || !position || position.top > -5000 || !tooltipRef.current || !anchorRef.current)
      return

    const tip = tooltipRef.current
    const tipRect = tip.getBoundingClientRect()
    const anchor = anchorRef.current
    const anchorRect = anchor.getBoundingClientRect()

    // If the anchor is currently hidden offscreen because it is inside a parent tooltip
    // that is also measuring, we must defer our own measurement until the parent finishes.
    if (anchorRect.top < -5000 || anchorRect.left < -5000) {
      if (measurePassRef.current < 20) {
        measurePassRef.current = (measurePassRef.current + 1) as any
        const nextTop = position.top === -9999 ? -9998 : -9999
        cancelDeferredMeasure()
        deferredMeasureRafRef.current = window.requestAnimationFrame(() => {
          deferredMeasureRafRef.current = null
          setPosition({ top: nextTop, left: nextTop })
        })
      }
      return
    }

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const spacing = 8

    const calcSideTop = () => {
      switch (sideAlign) {
        case 'start':
          return anchorRect.top
        case 'end':
          return anchorRect.bottom - tipRect.height
        case 'center':
        default:
          return anchorRect.top + anchorRect.height / 2 - tipRect.height / 2
      }
    }

    const calcPos = (pl: 'top' | 'bottom' | 'left' | 'right') => {
      let t = 0,
        l = 0
      switch (pl) {
        case 'right':
          t = calcSideTop()
          l = anchorRect.right + spacing
          break
        case 'left':
          t = calcSideTop()
          l = anchorRect.left - spacing - tipRect.width
          break
        case 'top':
          t = anchorRect.top - spacing - tipRect.height
          l = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2
          break
        case 'bottom':
          t = anchorRect.bottom + spacing
          l = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2
          break
      }
      return { top: t, left: l }
    }

    const fitsSide = (pl: 'left' | 'right') => {
      const available =
        pl === 'right' ? viewportWidth - (anchorRect.right + spacing) : anchorRect.left - spacing
      return available >= Math.min(tipRect.width, viewportWidth * 0.6)
    }
    const fitsVert = (pl: 'top' | 'bottom') => {
      const available =
        pl === 'bottom' ? viewportHeight - (anchorRect.bottom + spacing) : anchorRect.top - spacing
      return available >= Math.min(tipRect.height, viewportHeight * 0.6)
    }

    const order: ('top' | 'bottom' | 'left' | 'right')[] =
      allowedPlacements ||
      (() => {
        switch (placement) {
          case 'left':
            return ['left', 'right', 'top', 'bottom']
          case 'top':
            return ['top', 'bottom', 'right', 'left']
          case 'bottom':
            return ['bottom', 'top', 'right', 'left']
          case 'right':
          default:
            return ['right', 'left', 'top', 'bottom']
        }
      })()

    let chosen: 'top' | 'bottom' | 'left' | 'right' = placement

    let found = false
    for (const pl of order) {
      if ((pl === 'left' || pl === 'right') && fitsSide(pl)) {
        chosen = pl
        found = true
        break
      }
      if ((pl === 'top' || pl === 'bottom') && fitsVert(pl)) {
        chosen = pl
        found = true
        break
      }
    }

    if (!found) {
      let maxSpace = -1
      for (const pl of order) {
        const space =
          pl === 'left' ? anchorRect.left
          : pl === 'right' ? viewportWidth - anchorRect.right
          : pl === 'top' ? anchorRect.top
          : viewportHeight - anchorRect.bottom

        if (space > maxSpace) {
          maxSpace = space
          chosen = pl
        }
      }
    }

    const pos = calcPos(chosen)

    let availableWidth = viewportWidth
    if (chosen === 'right')
      availableWidth = Math.max(120, viewportWidth - (anchorRect.right + spacing) - 4)
    else if (chosen === 'left') availableWidth = Math.max(120, anchorRect.left - spacing - 4)
    else if (chosen === 'top' || chosen === 'bottom')
      availableWidth = Math.max(160, Math.min(viewportWidth - 16, 480))

    let availHeight: number
    if (chosen === 'top') {
      availHeight = Math.max(120, anchorRect.top - spacing - 4)
    } else if (chosen === 'bottom') {
      availHeight = Math.max(120, viewportHeight - (anchorRect.bottom + spacing) - 4)
    } else {
      availHeight = Math.max(120, viewportHeight - spacing * 2)
    }

    const clampHeight =
      maxHeight != null
        ? Math.min(tipRect.height, maxHeight)
        : Math.min(tipRect.height, availHeight)
    
    // We must use the minimum between tipRect.width and availableWidth to avoid pushing it offscreen
    // when calculating the actual rendered footprint.
    const clampWidth = Math.min(tipRect.width, availableWidth)

    let clampedTop = Math.max(spacing, Math.min(pos.top, viewportHeight - clampHeight - spacing))
    let clampedLeft = Math.max(spacing, Math.min(pos.left, viewportWidth - clampWidth - spacing))

    // Anti-overlap strictness: ensure the tooltip never slides over its anchor
    if (chosen === 'right') {
      clampedLeft = Math.max(anchorRect.right + spacing, clampedLeft)
    } else if (chosen === 'left') {
      clampedLeft = Math.min(anchorRect.left - spacing - clampWidth, clampedLeft)
    } else if (chosen === 'bottom') {
      clampedTop = Math.max(anchorRect.bottom + spacing, clampedTop)
    } else if (chosen === 'top') {
      clampedTop = Math.min(anchorRect.top - spacing - clampHeight, clampedTop)
    }

    // Final safety bounds: if anti-overlap pushed it offscreen entirely, pull it back in.
    clampedTop = Math.max(spacing, Math.min(clampedTop, viewportHeight - clampHeight - spacing))
    clampedLeft = Math.max(spacing, Math.min(clampedLeft, viewportWidth - clampWidth - spacing))

    setEffectivePlacement(chosen)
    setMaxWidth(Math.floor(availableWidth))
    setMaxHeight(Math.floor(availHeight))
    const settled = measurePassRef.current >= 2
    const nextPos = settled
      ? { top: clampedTop, left: clampedLeft }
      : { top: -9999, left: -9999 }

    if (!settled) {
      measurePassRef.current = (measurePassRef.current + 1) as any
    } else {
      // Placement has settled — commit the top so the ResizeObserver can lock it.
      committedTopRef.current = clampedTop
      positionRef.current = { top: clampedTop, left: clampedLeft }
    }

    setPosition(nextPos)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position, placement, maxHeight, sideAlign])

  useEffect(() => {
    if (!open) return

    let rafId: number | null = null
    const requestReposition = () => {
      if (rafId != null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        requestMeasure()
      })
    }

    const isFromInside = (e: Event, el: HTMLElement | null) => {
      if (!el) return false
      const anyE: any = e as any
      if (typeof anyE.composedPath === 'function') {
        const path = anyE.composedPath() as EventTarget[]
        return path.includes(el)
      }
      const t = e.target as Node | null
      return !!(t && el.contains(t))
    }

    const handleScrollCapture = (e: Event) => {
      if (isFromInside(e, tooltipRef.current)) return
      if (isFromInside(e, anchorRef.current)) return
      requestReposition()
    }

    const handleResize = () => requestReposition()

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScrollCapture, true)

    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScrollCapture, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorRef])

  const AnchorTag: any = anchorAs as any
  const tooltipClassName = variant === 'bare' ? 'ui-tooltip ui-tooltip--bare' : 'ui-tooltip'

  return (
    <>
      <AnchorTag
        ref={anchorRef as any}
        onMouseEnter={(e: any) => {
          if (typeof e?.clientX === 'number' && typeof e?.clientY === 'number') {
            lastMouseRef.current = { x: e.clientX, y: e.clientY }
          }
          show()
        }}
        onMouseLeave={() => hide()}
        onFocus={() => show(true)}
        onBlur={() => hide(true)}
        onKeyDown={(e: any) => {
          if (e.key === 'Escape') {
            setPinned(false)
            hide(true)
          }
          if (!disableClickToggle && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setPinned((prev) => {
              const next = !prev
              setOpen(next || open)
              if (!next && !open) setOpen(false)
              return next
            })
          }
        }}
        onClick={() => {
          if (disabled || disableClickToggle) return
          setPinned((prev) => {
            const next = !prev
            setOpen(next || open)
            if (!next && !open) setOpen(false)
            return next
          })
        }}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open ? true : undefined}
        className={anchorClassName}
        style={anchorStyle}
        tabIndex={anchorTabIndex}
      >
        {children}
      </AnchorTag>
      {open &&
        !disabled &&
        position &&
        createPortal(
          <div
            className={tooltipClassName}
            role='tooltip'
            id={tooltipId}
            ref={tooltipRef}
            onMouseEnter={() => show(true)}
            onMouseLeave={() => hide()}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              zIndex: zIndex,
              maxWidth: maxWidth,
              maxHeight: maxHeight,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            data-placement={effectivePlacement}
          >
            <div
              className='ui-tooltip__content'
              style={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              {content}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
