import React from 'react'

export interface ResizeHandleProps {
  orientation: 'horizontal' | 'vertical'
  onResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void
  /**
   * For vertical orientation, X tracks the mouse cursor along the height of the divider.
   * For horizontal orientation, X tracks the mouse cursor along the width of the divider.
   */
  handlePos?: number
  onMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void
  className?: string
  style?: React.CSSProperties
  /** Default width/height size of the hoverable hit box. Default is 6. */
  hitBoxSize?: number
  /** Offset for positioning the divider in relation to the center container */
  offset?: number
}

export function ResizeHandle({
  orientation,
  onResizeStart,
  handlePos,
  onMouseMove,
  className = '',
  style,
  hitBoxSize = 6,
  offset = 0,
}: ResizeHandleProps) {
  const isHorizontal = orientation === 'horizontal'

  // If a positioning class isn't explicitly provided, default to relative
  const hasPositioning =
    className.includes('absolute') ||
    className.includes('fixed') ||
    className.includes('relative') ||
    className.includes('sticky')

  return (
    <div
      className={`${hasPositioning ? '' : 'relative '}group shrink-0 ${
        isHorizontal ? 'cursor-row-resize' : 'cursor-col-resize'
      } ${className}`}
      style={{
        ...style,
        ...(isHorizontal
          ? { height: hitBoxSize }
          : { width: hitBoxSize }),
      }}
      role="separator"
      aria-orientation={orientation}
      aria-label={`Resize ${orientation}ly`}
      onPointerDown={onResizeStart}
      onMouseMove={onMouseMove}
    >
      {/* Invisible/visible border line centered in the hit box */}
      <div
        className={`absolute ${
          isHorizontal
            ? 'inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-neutral-200 dark:bg-neutral-800'
            : 'inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-neutral-200 dark:bg-neutral-800'
        }`}
      />

      {/* Floating Cyan/Teal drag indicator */}
      <div
        className="absolute z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          ...(isHorizontal
            ? {
                width: 48,
                height: 8,
                left: handlePos !== undefined ? handlePos - 24 : `calc(50% - 24px + ${offset}px)`,
                top: '50%',
                transform: 'translateY(-50%)',
              }
            : {
                width: 16,
                height: 48,
                left: '50%',
                transform: 'translateX(-50%)',
                top: handlePos !== undefined ? handlePos - 24 : `calc(50% - 24px + ${offset}px)`,
              }),
        }}
        aria-hidden
      >
        <div className="h-full w-full rounded bg-teal-500/20 border border-teal-500 shadow">
          <div className="h-full w-full flex items-center justify-center gap-[3px]">
            {isHorizontal ? (
              // Horizontal bars inside a horizontal resizer
              <div className="w-[24px] h-[2px] rounded-sm bg-teal-600" />
            ) : (
              // Vertical bars inside a vertical resizer
              <>
                <div className="w-[2px] h-[24px] rounded-sm bg-teal-600" />
                <div className="w-[2px] h-[24px] rounded-sm bg-teal-600" />
                <div className="w-[2px] h-[24px] rounded-sm bg-teal-600" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
