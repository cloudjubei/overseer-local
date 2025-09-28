import React, { useEffect, useLayoutEffect, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'

export type TooltipProps = {
  children: React.ReactElement
  content: React.ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delayMs?: number
  disabled?: boolean
}

export default function Tooltip({ content, placement = 'right' }: TooltipProps) {
  const [open, _] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const timerRef = useRef<number | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const tooltipId = useId()

  // const child = React.Children.only(children)

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    },
    [],
  )

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

    const calcPos = (pl: string) => {
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

    // let bestPlacement = placement
    let pos = calcPos(placement)

    if (!fits(pos)) {
      let opposite: 'top' | 'bottom' | 'left' | 'right'
      if (placement === 'right') opposite = 'left'
      else if (placement === 'left') opposite = 'right'
      else if (placement === 'top') opposite = 'bottom'
      else opposite = 'top'

      const oppPos = calcPos(opposite)
      if (fits(oppPos)) {
        // bestPlacement = opposite
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

  //TODO: FIX this + cloneElement below
  // const show = () => {
  //   if (disabled) return
  //   if (timerRef.current) window.clearTimeout(timerRef.current)
  //   timerRef.current = window.setTimeout(() => setOpen(true), delayMs) as any
  // }
  // const hide = () => {
  //   if (timerRef.current) window.clearTimeout(timerRef.current)
  //   setOpen(false)
  // }

  return (
    <>
      {/* {React.cloneElement(child, {
        ref: (el: HTMLElement) => {
          const anyChild: any = child as any
          if (typeof anyChild.ref === 'function') anyChild.ref(el)
          else if (anyChild.ref) (anyChild.ref as any).current = el
          anchorRef.current = el
        },
        onMouseEnter: (e: any) => {
          child.props.onMouseEnter?.(e)
          show()
        },
        onMouseLeave: (e: any) => {
          child.props.onMouseLeave?.(e)
          hide()
        },
        onFocus: (e: any) => {
          child.props.onFocus?.(e)
          show()
        },
        onBlur: (e: any) => {
          child.props.onBlur?.(e)
          hide()
        },
        onKeyDown: (e: any) => {
          child.props.onKeyDown?.(e)
          if (e.key === 'Escape') {
            hide()
          }
        },
        'aria-describedby': open ? tooltipId : undefined,
      })} */}
      {open &&
        position &&
        createPortal(
          <div
            className="ui-tooltip"
            role="tooltip"
            id={tooltipId}
            ref={tooltipRef}
            style={{ position: 'absolute', top: position.top, left: position.left }}
          >
            <div className="ui-tooltip__content">{content}</div>
          </div>,
          document.body,
        )}
    </>
  )
}
