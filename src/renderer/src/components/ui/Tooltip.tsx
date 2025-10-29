import React, { useEffect, useLayoutEffect, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'

export type TooltipProps = {
  children: React.ReactNode
  content: React.ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delayMs?: number
  disabled?: boolean
  // New: allow customizing anchor element and behavior
  anchorAs?: keyof JSX.IntrinsicElements
  anchorClassName?: string
  anchorStyle?: React.CSSProperties
  disableClickToggle?: boolean
  anchorTabIndex?: number
  // New: allow overriding the tooltip portal z-index so it can layer above overlays
  zIndex?: number
}

export default function Tooltip({
  children,
  content,
  placement = 'right',
  delayMs = 300,
  disabled = false,
  anchorAs = 'span',
  anchorClassName,
  anchorStyle,
  disableClickToggle = false,
  anchorTabIndex,
  zIndex,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [maxWidth, setMaxWidth] = useState<number | undefined>(undefined)
  const [effectivePlacement, setEffectivePlacement] = useState<'top' | 'bottom' | 'left' | 'right'>(placement)
  const timerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const tooltipId = useId()

  const CLOSE_DELAY = 160 // small delay to allow cursor to move between anchor and tooltip without flicker

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current)
      removeOutsideHandlers()
    }
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
    if (pinned && !immediate) return // do not auto-hide when pinned
    clearOpenTimer()
    clearHideTimer()
    if (immediate) {
      setOpen(false)
      setPinned(false)
      return
    }
    hideTimerRef.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY) as any
  }

  // Outside click / Escape to close when open (clears pin)
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

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      setMaxWidth(undefined)
      setEffectivePlacement(placement)
      return
    }
    if (!anchorRef.current) return
    setPosition({ top: -9999, left: -9999 })
  }, [open, placement])

  useLayoutEffect(() => {
    if (!open || !position || position.top !== -9999 || !tooltipRef.current || !anchorRef.current)
      return

    const tip = tooltipRef.current
    const tipRect = tip.getBoundingClientRect()
    const anchor = anchorRef.current
    const anchorRect = anchor.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const spacing = 8

    const calcPos = (pl: 'top' | 'bottom' | 'left' | 'right') => {
      let t = 0,
        l = 0
      switch (pl) {
        case 'right':
          t = anchorRect.top + anchorRect.height / 2 - tipRect.height / 2
          l = anchorRect.right + spacing
          break
        case 'left':
          t = anchorRect.top + anchorRect.height / 2 - tipRect.height / 2
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
      const available = pl === 'right' ? viewportWidth - (anchorRect.right + spacing) : anchorRect.left - spacing
      return available >= Math.min(tipRect.width, viewportWidth * 0.6)
    }
    const fitsVert = (pl: 'top' | 'bottom') => {
      const available = pl === 'bottom' ? viewportHeight - (anchorRect.bottom + spacing) : anchorRect.top - spacing
      return available >= Math.min(tipRect.height, viewportHeight * 0.6)
    }

    // Determine best placement without overlapping anchor; try preferred, then others
    const order: ('top' | 'bottom' | 'left' | 'right')[] = (() => {
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

    for (const pl of order) {
      if ((pl === 'left' || pl === 'right') && fitsSide(pl)) {
        chosen = pl
        break
      }
      if ((pl === 'top' || pl === 'bottom') && fitsVert(pl)) {
        chosen = pl
        break
      }
    }

    const pos = calcPos(chosen)

    // Constrain max width/height so we never cover the anchor and keep tooltip on the chosen side
    let availableWidth = viewportWidth
    let availableHeight = viewportHeight
    if (chosen === 'right') availableWidth = Math.max(120, viewportWidth - (anchorRect.right + spacing) - 4)
    else if (chosen === 'left') availableWidth = Math.max(120, anchorRect.left - spacing - 4)
    else if (chosen === 'top' || chosen === 'bottom') availableWidth = Math.max(160, Math.min(viewportWidth - 16, 480))

    if (chosen === 'top') availableHeight = Math.max(120, anchorRect.top - spacing - 4)
    else if (chosen === 'bottom') availableHeight = Math.max(120, viewportHeight - (anchorRect.bottom + spacing) - 4)

    // Clamp position to viewport for safety
    const clampedTop = Math.max(0, Math.min(pos.top, viewportHeight - tipRect.height))
    const clampedLeft = Math.max(0, Math.min(pos.left, viewportWidth - tipRect.width))

    setEffectivePlacement(chosen)
    setMaxWidth(Math.floor(availableWidth))
    setPosition({
      top: clampedTop + window.pageYOffset,
      left: clampedLeft + window.pageXOffset,
    })
  }, [open, position, placement])

  // Keep position updated if window resizes while open
  useEffect(() => {
    if (!open) return
    const handle = () => setPosition({ top: -9999, left: -9999 })
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [open])

  const AnchorTag: any = anchorAs as any

  return (
    <>
      <AnchorTag
        ref={anchorRef as any}
        onMouseEnter={() => show()}
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
            className="ui-tooltip"
            role="tooltip"
            id={tooltipId}
            ref={tooltipRef}
            onMouseEnter={() => show(true)}
            onMouseLeave={() => hide()}
            style={{ position: 'absolute', top: position.top, left: position.left, zIndex: zIndex, maxWidth: maxWidth }}
            data-placement={effectivePlacement}
          >
            <div className="ui-tooltip__content">{content}</div>
          </div>,
          document.body,
        )}
    </>
  )
}
