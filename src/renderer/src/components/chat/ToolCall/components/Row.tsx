import React from 'react'

export function Row({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={['text-xs leading-relaxed', className || ''].join(' ')}>{children}</div>
}
