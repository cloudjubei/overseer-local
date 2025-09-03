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

function positionFor(anchor: HTMLElement, gap = 8) : { top: number, left: number, minWidth: number, side: 'top' | 'bottom'} {
  const r = anchor.getBoundingClientRect()
  const threshold = 180 // Approximate picker height
  const side = (window.innerHeight - r.bottom < threshold) ? 'top' : 'bottom'
  let top: number
  if (side === 'bottom') {
    top = r.bottom + window.scrollY + gap
  } else {
    top = r.top + window.scrollY - threshold - gap
  }
  const left = r.left + window.scrollX
  return { top, left, minWidth: r.width, side }
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

  useLayoutEffect(() => {
    setCoords(positionFor(anchorEl))
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
      style={{ top: coords.top, left: coords.left, minWidth: Math.max(120, coords.minWidth + 8) }}
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

  const handlePointerDown: React.PointerEventHandler<HTMLButtonElement> = (e) => {
    // Only consider primary button or touch
    if (e.button !== 0 && e.pointerType !== 'touch') return
    longPressTriggered.current = false
    clearPressTimer()
    pressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true
      handleOpen()
    }, LONG_PRESS_MS)
  }

  const endPress = () => {
    clearPressTimer()
  }

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    // If the long press already opened the picker, suppress the normal action
    if (longPressTriggered.current) {
      e.preventDefault()
      e.stopPropagation()
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
          type="button"
          className="btn btn-icon"
          aria-label="Run Agent"
          title="Run Agent"
          onPointerDown={handlePointerDown}
          onPointerUp={endPress}
          onPointerCancel={endPress}
          onPointerLeave={endPress}
          onClick={handleClick}
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
