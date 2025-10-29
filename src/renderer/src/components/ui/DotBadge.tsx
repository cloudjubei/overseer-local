import React from 'react'

export type DotBadgeProps = {
  className?: string
  color?: 'red' | 'blue' | 'green'
  title?: string
}

const colorClass = (c: 'red' | 'blue' | 'green') => {
  switch (c) {
    case 'blue':
      return 'bg-blue-500'
    case 'green':
      return 'bg-green-500'
    case 'red':
    default:
      return 'bg-red-500'
  }
}

export const DotBadge: React.FC<DotBadgeProps> = ({ className = '', color = 'red', title }) => {
  return (
    <span
      className={[
        'inline-block align-middle',
        'w-2.5 h-2.5 rounded-full',
        colorClass(color),
        // subtle outline ring so it stands out on any bg
        'ring-2 ring-white dark:ring-neutral-900',
        className,
      ].join(' ')}
      title={title}
      aria-label={title}
      role="status"
    />
  )
}

export default DotBadge
