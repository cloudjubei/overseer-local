import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Status } from 'thefactory-tools'

export const STATUS_LABELS = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
}

const STATUS_ORDER: Status[] = ['-', '~', '+', '=', '?']

export function statusKey(s: Status): 'queued' | 'working' | 'done' | 'stuck' | 'onhold' {
  switch (s) {
    case '-':
      return 'queued'
    case '~':
      return 'working'
    case '+':
      return 'done'
    case '?':
      return 'stuck'
    case '=':
      return 'onhold'
  }
}

function mapStatusToSemantic(status: Status | string): { key: string; label: string } {
  switch (status) {
    case '+':
      return { key: 'done', label: 'Done' }
    case '~':
      return { key: 'working', label: 'In Progress' }
    case '-':
      return { key: 'queued', label: 'Pending' }
    case '?':
      return { key: 'stuck', label: 'Blocked' }
    case '=':
      return { key: 'onhold', label: 'Deferred' }
    default:
      return { key: 'queued', label: String(status || '') }
  }
}

function useOutsideClick(refs: React.RefObject<HTMLElement | null>[], onOutside: () => void) {
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      const inside = refs.some((r) => r.current && r.current.contains(t))
      if (!inside) onOutside()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [refs, onOutside])
}

function positionFor(
  anchor: HTMLElement,
  gap = 8,
): { top: number; left: number; minWidth: number; side: 'top' | 'bottom' } {
  const r = anchor.getBoundingClientRect()
  const threshold = 180 // Approximate picker height
  const side = window.innerHeight - r.bottom < threshold ? 'top' : 'bottom'
  let top: number
  if (side === 'bottom') {
    top = r.bottom + window.scrollY + gap
  } else {
    top = r.top + window.scrollY - threshold - gap
  }
  const left = r.left + window.scrollX
  return { top, left, minWidth: r.width, side }
}

type PickerValue = Status | 'all' | 'not-done'

type PickerProps = {
  anchorEl: HTMLElement
  value: PickerValue
  isAllAllowed?: boolean
  includeNotDone?: boolean
  onSelect: (s: PickerValue) => void
  onClose: () => void
}

export function StatusPicker({
  anchorEl,
  value,
  isAllAllowed = false,
  includeNotDone = false,
  onSelect,
  onClose,
}: PickerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{
    top: number
    left: number
    minWidth: number
    side: 'top' | 'bottom'
  } | null>(null)

  useLayoutEffect(() => {
    setCoords(positionFor(anchorEl))
  }, [anchorEl])

  useOutsideClick([panelRef], onClose)

  const [active, setActive] = useState<PickerValue>(value)
  useEffect(() => setActive(value), [value])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!panelRef.current) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      const idx =
        active === 'all' || active === 'not-done'
          ? STATUS_ORDER.length
          : STATUS_ORDER.indexOf(active)
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
      className={`standard-picker standard-picker--${coords.side}`}
      role="menu"
      aria-label="Select status"
      style={{ top: coords.top, left: coords.left, minWidth: Math.max(120, coords.minWidth + 8) }}
    >
      {isAllAllowed && (
        <button
          key={'all'}
          role="menuitemradio"
          aria-checked={value === 'all'}
          className={`standard-picker__item ${'all' === active ? 'is-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onSelect('all')
          }}
        >
          <span className={`status-bullet status-bullet--empty`} aria-hidden />
          <span className="standard-picker__label">All</span>
          {value === 'all' && (
            <span className="standard-picker__check" aria-hidden>
              ✓
            </span>
          )}
        </button>
      )}

      {includeNotDone && (
        <button
          key={'not-done'}
          role="menuitemradio"
          aria-checked={value === 'not-done'}
          className={`standard-picker__item ${'not-done' === active ? 'is-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onSelect('not-done')
          }}
        >
          <span className={`status-bullet status-bullet--queued`} aria-hidden />
          <span className="standard-picker__label">Not done</span>
          {value === 'not-done' && (
            <span className="standard-picker__check" aria-hidden>
              ✓
            </span>
          )}
        </button>
      )}

      {STATUS_ORDER.map((s) => {
        const k = statusKey(s)
        const selected = s === value
        const activeItem = s === active
        return (
          <button
            key={s}
            role="menuitemradio"
            aria-checked={selected}
            className={`standard-picker__item ${activeItem ? 'is-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(s)
            }}
          >
            <span className={`status-bullet status-bullet--${k}`} aria-hidden />
            <span className="standard-picker__label">{STATUS_LABELS[s]}</span>
            {selected && (
              <span className="standard-picker__check" aria-hidden>
                ✓
              </span>
            )}
          </button>
        )
      })}
    </div>,
    document.body,
  )
}

export type StatusControlProps = {
  status: Status | string
  className?: string
  title?: string
  onChange?: (next: Status) => void
}

export default function StatusControl({
  status,
  className = '',
  title,
  onChange,
}: StatusControlProps) {
  const { key, label } = mapStatusToSemantic(status)
  const badgeCls = `badge badge--soft badge--${key}`
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const bulletRef = useRef<HTMLButtonElement>(null)

  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)
  const handleSelect = (s: Status) => {
    onChange?.(s)
    setOpen(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!bulletRef.current) return
      if (document.activeElement === bulletRef.current && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const isEditable = !!onChange

  return (
    <>
      <div
        ref={containerRef}
        className={`status-inline ${className} ${isEditable ? 'editable' : ''} max-w-[140px]`}
      >
        <span
          className={`${badgeCls} ${isEditable ? 'status-badge--editable' : ''}`}
          aria-label={`${label} status`}
          title={title || label}
          onClick={(e) => {
            if (isEditable) {
              e.stopPropagation()
              handleOpen()
            }
          }}
          role={isEditable ? 'button' : undefined}
          tabIndex={isEditable ? 0 : undefined}
        >
          {label}
        </span>
      </div>
      {open && containerRef.current && (
        <StatusPicker
          anchorEl={containerRef.current}
          value={status as Status}
          onSelect={(s) => handleSelect(s as Status)}
          onClose={handleClose}
        />
      )}
    </>
  )
}
