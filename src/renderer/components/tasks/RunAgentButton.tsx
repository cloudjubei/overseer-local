import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AgentType } from'packages/factory-ts/src/types'
import { Button } from '../ui/Button'
import { IconPlay } from '../ui/Icons'

const AGENTS_ORDER: AgentType[] = ['speccer', 'planner', 'contexter', 'tester', 'developer']
const AGENTS_LABELS: Record<AgentType, string> = {
  'speccer': 'Speccer',
  'planner': 'Planner',
  'contexter': 'Contexter',
  'tester': 'Tester',
  'developer': 'Developer',
}

function useOutsideClick(refs: React.RefObject<HTMLElement>[], onOutside: () => void) {
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      const inside = refs.some(r => r.current && r.current.contains(t))
      if (!inside) onOutside()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [refs, onOutside])
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }

function computePosition(anchor: HTMLElement, panel: HTMLElement | null, gap = 8) : { top: number, left: number, minWidth: number, side: 'top' | 'bottom'} {
  const ar = anchor.getBoundingClientRect()
  const scrollX = window.scrollX || window.pageXOffset
  const scrollY = window.scrollY || window.pageYOffset
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight

  // Measure panel if available; provide fallbacks
  const panelW = panel ? panel.offsetWidth : Math.max(160, ar.width)
  const panelH = panel ? panel.offsetHeight : 180

  // Decide side based on available space
  const spaceBelow = viewportH - ar.bottom
  const side: 'top' | 'bottom' = (spaceBelow < panelH + gap) ? 'top' : 'bottom'

  let top: number
  if (side === 'bottom') {
    top = ar.bottom + scrollY + gap
  } else {
    top = ar.top + scrollY - panelH - gap
  }

  // Prefer left-aligned to anchor, but clamp inside viewport with padding
  let left = ar.left + scrollX
  const padding = 8
  const maxLeft = scrollX + viewportW - panelW - padding
  const minLeft = scrollX + padding
  left = clamp(left, minLeft, maxLeft)

  // Also clamp top within viewport
  const minTop = scrollY + padding
  const maxTop = scrollY + viewportH - panelH - padding
  top = clamp(top, minTop, maxTop)

  return { top, left, minWidth: ar.width, side }
}

type PickerProps = {
  anchorEl: HTMLElement
  value?: AgentType
  onSelect: (s: AgentType) => void
  onClose: () => void
}

export function AgentTypePicker({ anchorEl, value = 'developer', onSelect, onClose }: PickerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; minWidth: number; side: 'top' | 'bottom' } | null>(null)

  // Position after mount and on resize/scroll
  useLayoutEffect(() => {
    const update = () => {
      setCoords(computePosition(anchorEl, panelRef.current))
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchorEl])

  useOutsideClick([panelRef], onClose)

  const [active, setActive] = useState<AgentType>(value)
  useEffect(() => setActive(value), [value])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!panelRef.current) return
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      const idx = AGENTS_ORDER.indexOf(active)
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        const next = AGENTS_ORDER[(idx + 1) % AGENTS_ORDER.length]
        setActive(next)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const next = AGENTS_ORDER[(idx - 1 + AGENTS_ORDER.length) % AGENTS_ORDER.length]
        setActive(next)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onSelect(active)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, onClose, onSelect])

  if (!coords) return null

  return createPortal(
    <div
      ref={panelRef}
      className={`standard-picker standard-picker--${coords.side}`}
      role="menu"
      aria-label="Select Agent"
      style={{ top: coords.top, left: coords.left, minWidth: Math.max(120, coords.minWidth + 8), position: 'absolute' }}
      onClick={(e) => { e.stopPropagation() }}
      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); (e.nativeEvent as any).stopImmediatePropagation?.() }}
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); (e.nativeEvent as any).stopImmediatePropagation?.() }}
    >
      {AGENTS_ORDER.map((s) => {
        return (
          <button
            key={s}
            role="menuitemradio"
            className='standard-picker__item'
            onClick={(e) => { e.stopPropagation(); onSelect(s) }}
          >
            <span className="standard-picker__label">{AGENTS_LABELS[s]}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )
}

export type RunAgentButtonProps = {
  className?: string
  onClick: (next: AgentType) => void
}

export default function RunAgentButton({ className = '', onClick }: RunAgentButtonProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const pressTimer = useRef<number | null>(null)
  const longPressTriggered = useRef(false)
  const LONG_PRESS_MS = 500

  const clearPressTimer = () => {
    if (pressTimer.current != null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)
  const handleSelect = (t: AgentType) => {
    onClick(t)
    setOpen(false)
  }

  const startPress = (e: any) => {
    // Prevent propagation and any default drag/select behavior
    e.stopPropagation()
    e.preventDefault()
    e.nativeEvent?.stopImmediatePropagation?.()
    // Capture to the button to avoid drag on parent while holding
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) } catch {}
    // Only consider primary button or touch
    if (e.button !== undefined && e.button !== 0 && e.pointerType !== 'touch') return
    longPressTriggered.current = false
    clearPressTimer()
    pressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true
      handleOpen()
    }, LONG_PRESS_MS)
  }

  const handlePointerDown: React.PointerEventHandler<HTMLButtonElement> = (e) => {
    startPress(e)
  }
  const handlePointerDownCapture: React.PointerEventHandler<HTMLButtonElement> = (e) => {
    // Intercept as early as possible
    e.stopPropagation()
    e.preventDefault()
    ;(e.nativeEvent as any).stopImmediatePropagation?.()
  }
  const handleMouseDown: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    startPress(e)
  }
  const handleMouseDownCapture: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.stopPropagation(); e.preventDefault(); (e.nativeEvent as any).stopImmediatePropagation?.()
  }
  const handleTouchStart: React.TouchEventHandler<HTMLButtonElement> = (e) => {
    // Touch start also needs to be suppressed
    e.stopPropagation(); e.preventDefault();
  }

  const handlePointerMove: React.PointerEventHandler<HTMLButtonElement> = (e) => {
    // Prevent drag gestures bubbling to parent while holding
    if (pressTimer.current != null || open || longPressTriggered.current) {
      e.stopPropagation(); e.preventDefault(); (e.nativeEvent as any).stopImmediatePropagation?.()
    }
  }
  const handleMouseMove: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (pressTimer.current != null || open || longPressTriggered.current) {
      e.stopPropagation(); e.preventDefault(); (e.nativeEvent as any).stopImmediatePropagation?.()
    }
  }
  const handleTouchMove: React.TouchEventHandler<HTMLButtonElement> = (e) => {
    if (pressTimer.current != null || open || longPressTriggered.current) {
      e.stopPropagation(); e.preventDefault()
    }
  }

  const endPress: React.PointerEventHandler<HTMLButtonElement> = (e) => {
    // Release capture and clear timer
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId) } catch {}
    clearPressTimer()
    // Also stop bubbling of the ending event to avoid drag conclusions
    e.stopPropagation(); (e.nativeEvent as any).stopImmediatePropagation?.()
  }

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    // If the long press already opened the picker, suppress the normal action
    if (longPressTriggered.current) {
      e.preventDefault()
      e.stopPropagation()
      ;(e.nativeEvent as any).stopImmediatePropagation?.()
      longPressTriggered.current = false
      return
    }
    // Normal click runs the developer agent
    e.stopPropagation()
    onClick('developer')
  }

  useEffect(() => {
    return () => clearPressTimer()
  }, [])

  return (
    <>
      <div ref={containerRef} className={className}>
        <Button
          ref={buttonRef}
          type="button"
          className="btn btn-icon"
          aria-label="Run Agent"
          title="Run Agent"
          style={{ touchAction: 'none', userSelect: 'none' }}
          onPointerDownCapture={handlePointerDownCapture}
          onPointerDown={handlePointerDown}
          onMouseDownCapture={handleMouseDownCapture}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onPointerMove={handlePointerMove}
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onPointerUp={endPress}
          onPointerCancel={endPress}
          onPointerLeave={endPress}
          onClick={handleClick}
          onDragStart={(e: any) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent?.stopImmediatePropagation?.() }}
          onContextMenu={(e: any) => { if (open) { e.preventDefault(); e.stopPropagation() } }}
          draggable={false}
        >
          <IconPlay />
        </Button>
      </div>
      {open && containerRef.current && (
        <AgentTypePicker anchorEl={containerRef.current} onSelect={handleSelect} onClose={handleClose} />
      )}
    </>
  )
}
