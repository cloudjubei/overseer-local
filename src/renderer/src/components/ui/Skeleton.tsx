import React from 'react'

export default function Skeleton({
  className = '',
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return <div className={`ui-skeleton ${className}`} style={style} aria-hidden />
}

export function SkeletonText({
  lines = 3,
  lineClassName = '',
}: {
  lines?: number
  lineClassName?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 rounded ${lineClassName}`} />
      ))}
    </div>
  )
}
