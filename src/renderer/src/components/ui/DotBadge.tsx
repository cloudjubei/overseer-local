import React from 'react'

export type DotBadgeProps = {
  className?: string
  colorClass?: string
  title?: string
}

export const DotBadge: React.FC<DotBadgeProps> = ({ className = '', colorClass = 'bg-red-500', title }) => {
  return (
    <span
      className={[
        'inline-block align-middle',
        'w-2.5 h-2.5 rounded-full',
        colorClass,
        // subtle outline ring so it stands out on any bg
        'ring-2 ring-white dark:ring-neutral-900',
        className,
      ].join(' ')}
      title={title}
    />
  )
}

export default DotBadge
