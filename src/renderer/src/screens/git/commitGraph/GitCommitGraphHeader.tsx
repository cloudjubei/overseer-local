import React from 'react'

export default function GitCommitGraphHeader({
  title,
  width,
  minWidth = 50,
  maxWidth = 500,
  onResize,
  flex1,
}: {
  title: string
  width?: number
  minWidth?: number
  maxWidth?: number
  onResize?: (w: number) => void
  flex1?: boolean
}) {
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onResize || !width) return
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const onMove = (ev: PointerEvent) =>
      onResize(Math.max(minWidth, Math.min(maxWidth, startW + ev.clientX - startX)))
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className={`relative px-2 py-1 flex items-center border-r border-neutral-200 dark:border-neutral-800
        text-xs font-semibold text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/50
        ${flex1 ? 'flex-1 min-w-0' : 'flex-shrink-0'}`}
      style={!flex1 && width ? { width } : undefined}
    >
      <span className="truncate">{title}</span>
      {!flex1 && onResize && (
        <div
          onPointerDown={handlePointerDown}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-500/50"
          style={{ right: -1, zIndex: 10 }}
        />
      )}
    </div>
  )
}
