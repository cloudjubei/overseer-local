import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Status } from 'src/types/tasks'

const STATUS_ORDER: Status[] = ['-', '~', '+', '=', '?']
const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
}

function statusKey(s: Status): 'done' | 'working' | 'queued' | 'stuck' | 'onhold' {
  switch (s) {
    case '+': return 'done'
    case '~': return 'working'
    case '-': return 'queued'
    case '?': return 'stuck'
    case '=': return 'onhold'
  }
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

function positionFor(anchor: HTMLElement, side: 'bottom' | 'top' = 'bottom', gap = 8) {
  const r = anchor.getBoundingClientRect()
  const top = side === 'bottom' ? r.bottom + window.scrollY + gap : r.top + window.scrollY - gap
  const left = r.left + window.scrollX
  return { top, left, minWidth: r.width }
}

type PickerProps = {
  anchorEl: HTMLElement
  value: Status
  onSelect: (s: Status) => void
  onClose: () => void
}

function StatusPicker({ anchorEl, value, onSelect, onClose }: PickerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; minWidth: number } | null>(null)

  useLayoutEffect(() => {
    setCoords(positionFor(anchorEl))
  }, [anchorEl])

  useOutsideClick([panelRef], onClose)

  // Keyboard navigation
  const [active, setActive] = useState<Status>(value)
  useEffect(() => setActive(value), [value])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!panelRef.current) return
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      const idx = STATUS_ORDER.indexOf(active)
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]
        setActive(next)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const next = STATUS_ORDER[(idx - 1 + STATUS_ORDER.length) % STATUS_ORDER.length]
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
      className="status-picker"
      role="menu"
      aria-label="Select status"
      style={{ top: coords.top, left: coords.left, minWidth: Math.max(140, coords.minWidth + 8) }}
    >
      {STATUS_ORDER.map((s) => {
        const k = statusKey(s)
        const selected = s === value
        const activeItem = s === active
        return (
          <button
            key={s}
            role="menuitemradio"
            aria-checked={selected}
            className={`status-picker__item ${activeItem ? 'is-active' : ''}`}
            onClick={() => onSelect(s)}
          >
            <span className={`status-bullet status-bullet--${k}`} aria-hidden />
            <span className="status-picker__label">{STATUS_LABELS[s]}</span>
            {selected && <span className="status-picker__check" aria-hidden>✓</span>}
          </button>
        )
      })}
    </div>,
    document.body
  )
}

type BulletProps = {
  status: Status
  onChange: (next: Status) => void
  className?: string
  title?: string
}

export default function StatusBullet({ status, onChange, className = '', title }: BulletProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const label = STATUS_LABELS[status]

  const onOpen = () => setOpen(true)
  const onClose = () => setOpen(false)

  const onSelect = (s: Status) => {
    onChange(s)
    setOpen(false)
  }

  const k = useMemo(() => statusKey(status), [status])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!btnRef.current) return
      if (document.activeElement === btnRef.current && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`status-bullet-btn u-focus-ring ${className}`}
        aria-haspopup="menu"
        aria-expanded={open || undefined}
        aria-label={`Change status (currently ${label})`}
        title={title || `Change status: ${label}`}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className={`status-bullet status-bullet--${k}`} aria-hidden></span>
        <span className="status-bullet__edit" aria-hidden>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </span>
      </button>
      {open && btnRef.current && (
        <StatusPicker anchorEl={btnRef.current} value={status} onSelect={onSelect} onClose={onClose} />
      )}
    </>
  )
}
