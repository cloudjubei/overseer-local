import React from 'react'

export interface NotificationBadgeProps {
  className?: string
  text: string
  tooltipLabel?: string
  isInformative?: boolean
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
}) => {
  const bg = isInformative ? 'bg-blue-500' : 'bg-red-500'
  const title = tooltipLabel || text

  return (
    <span
      className={[
        'inline-flex items-center justify-center select-none',
        // sizing: min width equals height; expands with content
        'h-5 min-w-5 px-1.5',
        // shape
        'rounded-full',
        // typography
        'text-[11px] leading-none font-semibold text-white',
        // color
        bg,
        // subtle outline to pop on dark/light backgrounds
        'ring-2 ring-white dark:ring-neutral-900',
        className,
      ].join(' ')}
      title={title}
      aria-label={title}
      role="status"
    >
      {text}
    </span>
  )
}

export default NotificationBadge
