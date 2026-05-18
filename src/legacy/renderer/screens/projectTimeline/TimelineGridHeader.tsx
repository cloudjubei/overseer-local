import React from 'react'
import type { Unit, Zoom } from './ProjectTimelineTypes'
import { diffInDays, startOfDay } from './timelineDateUtils'

export function TimelineGridHeader({
  units,
  unitCount,
  zoom,
  headerGroups,
  stickyColumnCount,
  stickyLeftWidthPx,
  scrollLeft,
  totalTimelineWidth,
  rowHeaderHeightPx,
}: {
  units: Unit[]
  unitCount: number
  zoom: Zoom
  headerGroups: { label: string; startIdx: number; len: number }[]
  stickyColumnCount: number
  stickyLeftWidthPx: number
  scrollLeft: number
  totalTimelineWidth: number
  rowHeaderHeightPx: number
}) {
  return (
    <div className="shrink-0 w-full overflow-hidden border-b border-default bg-raised">
      <div className="grid text-xs text-muted" style={{ gridTemplateColumns: `repeat(${stickyColumnCount}, auto) ${totalTimelineWidth}px` }}>
        {/* Sticky placeholders come from parent as separate columns; here we only render the scrollable timeline header. */}
        <div style={{ gridColumn: stickyColumnCount + 1 }} className="relative" />
      </div>

      {/* Actual header content: one absolute layer that scrolls horizontally */}
      <div className="relative" style={{ height: rowHeaderHeightPx }}>
        <div
          className="absolute top-0 left-0 h-full"
          style={{
            width: totalTimelineWidth,
            transform: `translateX(${-scrollLeft}px)`,
            willChange: 'transform',
          }}
        >
          {/* Grouping row */}
          <div className="absolute top-0 left-0 w-full flex h-6 border-b border-subtle">
            {headerGroups.map((g, idx) => (
              <div
                key={idx}
                className="flex-none px-2 py-1 font-semibold text-[11px] uppercase tracking-wider overflow-hidden text-ellipsis whitespace-nowrap"
                style={{
                  width: `${(g.len / unitCount) * 100}%`,
                  borderLeft: idx > 0 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                {g.label}
              </div>
            ))}
          </div>

          {/* Individual unit columns */}
          <div className="absolute top-6 left-0 w-full flex h-8">
            {units.map((u, i) => {
              const isCurrentDay = zoom === 'day' && diffInDays(u.start, startOfDay(new Date())) === 0
              return (
                <div
                  key={u.key}
                  className={`flex-none flex flex-col items-center justify-center border-subtle ${isCurrentDay ? 'bg-accent-primary/10 text-accent-primary font-bold' : ''}`}
                  style={{
                    width: `${(1 / unitCount) * 100}%`,
                    borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div className="text-[11px] leading-tight">{u.labelTop}</div>
                  {u.labelBottom && <div className="text-[9px] opacity-75">{u.labelBottom}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
