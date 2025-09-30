import React, { useEffect, useLayoutEffect, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'

export type TooltipProps = {
  children: React.ReactNode
  content: React.ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delayMs?: number
  disabled?: boolean
}

export default function Tooltip({
  children,
  content,
  placement = 'right',
  delayMs = 300,
  disabled = false,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const timerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const tooltipId = useId()

  const CLOSE_DELAY = 120 // small delay to allow cursor to move between anchor and tooltip without flicker

  // Ensure we always have a concrete element to attach events/refs to.
  // If children is not a single valid React element (e.g., text, fragment, array), wrap it in a span.
  const baseChild =
    React.isValidElement(children) && children.type !== React.Fragment
      ? (children as React.ReactElement)
      : React.createElement('span', null, children)

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
    clearOpenTimer()
    clearHideTimer()
    if (immediate) {
      setOpen(false)
      return
    }
    hideTimerRef.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY) as any
  }

  // Outside click / Escape to close when open via click
  const onDocMouseDown = (e: MouseEvent) => {
    if (!open) return
    const t = e.target as Node
    if (anchorRef.current && anchorRef.current.contains(t)) return
    if (tooltipRef.current && tooltipRef.current.contains(t)) return
    hide(true)
  }
  const onDocKeyDown = (e: KeyboardEvent) => {
    if (!open) return
    if (e.key === 'Escape') hide(true)
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
    // cleanup handled by unmount or when open changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
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

    const fits = (p: { top: number; left: number }) => {
      return (
        p.left >= 0 &&
        p.top >= 0 &&
        p.left + tipRect.width <= viewportWidth &&
        p.top + tipRect.height <= viewportHeight
      )
    }

    let pos = calcPos(placement)

    if (!fits(pos)) {
      let opposite: 'top' | 'bottom' | 'left' | 'right'
      if (placement === 'right') opposite = 'left'
      else if (placement === 'left') opposite = 'right'
      else if (placement === 'top') opposite = 'bottom'
      else opposite = 'top'

      const oppPos = calcPos(opposite)
      if (fits(oppPos)) {
        pos = oppPos
      }
    }

    // Clamp to viewport
    pos.top = Math.max(0, Math.min(pos.top, viewportHeight - tipRect.height))
    pos.left = Math.max(0, Math.min(pos.left, viewportWidth - tipRect.width))

    setPosition({
      top: pos.top + window.pageYOffset,
      left: pos.left + window.pageXOffset,
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

  return (
    <>
      {React.cloneElement(baseChild, {
        ref: (el: HTMLElement) => {
          const anyChild: any = baseChild as any
          if (typeof anyChild.ref === 'function') anyChild.ref(el)
          else if (anyChild.ref) (anyChild.ref as any).current = el
          anchorRef.current = el
        },
        onMouseEnter: (e: any) => {
          ;(baseChild.props as any)?.onMouseEnter?.(e)
          show()
        },
        onMouseLeave: (e: any) => {
          ;(baseChild.props as any)?.onMouseLeave?.(e)
          hide()
        },
        onFocus: (e: any) => {
          ;(baseChild.props as any)?.onFocus?.(e)
          show(true) // show immediately on focus for accessibility
        },
        onBlur: (e: any) => {
          ;(baseChild.props as any)?.onBlur?.(e)
          hide(true)
        },
        onKeyDown: (e: any) => {
          ;(baseChild.props as any)?.onKeyDown?.(e)
          if (e.key === 'Escape') hide(true)
        },
        onClick: (e: any) => {
          if (disabled) return
          // Toggle tooltip immediately on click
          setOpen((v) => !v)
        },
        'aria-describedby': open ? tooltipId : undefined,
        'aria-expanded': open ? true : undefined,
      })}
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
            style={{ position: 'absolute', top: position.top, left: position.left }}
          >
            <div className="ui-tooltip__content">{content}</div>
          </div>,
          document.body,
        )}
    </>
  )
}
