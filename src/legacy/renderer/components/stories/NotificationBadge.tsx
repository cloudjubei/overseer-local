import React from 'react'

export interface NotificationBadgeProps {
  className?: string
  text: string
  tooltipLabel?: string
  isInformative?: boolean
  /** Optional explicit color override. Defaults to red; when isInformative=true defaults to blue. */
  color?: 'red' | 'blue' | 'green' | 'orange'
  colorClass?: string
}

export const getBadgeColorClass = (
  color?: 'red' | 'blue' | 'green' | 'orange',
  isInformative: boolean = false
) => {
  return color
    ? color === 'green'
      ? 'bg-green-500'
      : color === 'orange'
      ? 'bg-orange-500'
      : color === 'blue'
      ? 'bg-blue-500'
      : 'bg-red-500'
    : isInformative
    ? 'bg-blue-500'
    : 'bg-red-500'
}

/*
  iOS-like notification badge
  - Round (becomes pill for 2+ digits)
  - High-contrast background (red for alerts, blue for informative)
  - White text, centered
  - Small ring to separate from background
*/
const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  className = '',
  text,
  tooltipLabel,
  isInformative = false,
  color,
  colorClass,
}) => {
  const bg = colorClass || getBadgeColorClass(color, isInformative)
  const title = tooltipLabel || text

  return (
    <span
      className={[
        'inline-flex items-center justify-center select-none',
        // sizing: min width equals height; expands with content
        'h-5 min-w-5 px-1.5',
        // shape
        'rounded-full',
        // typography — line-height:0 lets flexbox own vertical centering
        'text-[11px] font-semibold text-white',
        // color
        bg,
        // separation (makes it "pop" when on a similar background)
        'ring-2 ring-white dark:ring-neutral-900',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      title={title}
      aria-label={title}
    >
      {text}
    </span>
  )
}

export default NotificationBadge
