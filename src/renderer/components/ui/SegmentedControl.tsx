import * as React from 'react'

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export type SegmentedOption = {
  value: string
  label: string
  icon?: React.ReactNode
}

export type SegmentedSize = 'sm' | 'md'

type Props = {
  options: SegmentedOption[]
  value: string
  onChange: (value: string) => void
  size?: SegmentedSize
  ariaLabel?: string
  className?: string
}

export default function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel = 'View switch',
  className,
}: Props) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const groupRef = React.useRef<HTMLDivElement>(null)

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = options.length
    let next = index
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      next = (index + 1) % count
      onChange(options[next].value)
      focusIndex(next)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      next = (index - 1 + count) % count
      onChange(options[next].value)
      focusIndex(next)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(options[0].value)
      focusIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(options[count - 1].value)
      focusIndex(count - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onChange(options[index].value)
    }
  }

  const focusIndex = (i: number) => {
    const el = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[i]
    el?.focus()
  }

  return (
    <div
      ref={groupRef}
      className={cx('segmented', `segmented--${size}`, className)}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((opt, i) => {
        const active = i === selectedIndex
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={cx('segmented__option', active && 'is-active')}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {opt.icon && (
              <span className="segmented__icon" aria-hidden="true">
                {opt.icon}
              </span>
            )}
            <span className="segmented__label">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
