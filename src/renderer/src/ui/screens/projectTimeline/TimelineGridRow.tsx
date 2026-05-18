import React from 'react'
import type {
  HoverInfo,
  RowDefinition,
  RowItem,
  TimelineLabel,
  Unit,
  Zoom,
} from './ProjectTimelineTypes'
import { diffInDays, getUnitIndex, startOfDay } from './timelineDateUtils'
import { storyColorStyles } from './timelineItemUtils'

const CELL_PADDING_PX = 8

const TimelineItem = React.memo(function TimelineItem({
  item,
  labels,
  openEdit,
  onHover,
  onLeave,
  onClickStory,
  onClickFeature,
}: {
  item: RowItem
  labels: TimelineLabel[]
  openEdit: (l: TimelineLabel) => void
  onHover: (info: HoverInfo) => void
  onLeave: () => void
  onClickStory: (storyId: string) => void
  onClickFeature: (storyId: string, featureId: string) => void
}) {
  const isGlobal = item.scope === '__global__'

  if (item.kind === 'label') {
    return (
      <button
        type="button"
        className="w-full flex items-center gap-2 text-left"
        onClick={() => {
          const l = labels.find((x) => x.id === item.id)
          if (l) openEdit(l)
        }}
        title="Click to edit"
      >
        <span
          className={`shrink-0 w-2.5 h-2.5 rotate-45 border ${
            isGlobal ? 'bg-purple-200 border-purple-500' : 'bg-emerald-200 border-emerald-500'
          }`}
        />
        <span className="text-[11px] text-(--text-secondary) truncate">{item.title}</span>
      </button>
    )
  }

  const style = storyColorStyles(item.kind === 'feature' ? item.storyId : item.id)
  const onClick =
    item.kind === 'story'
      ? () => onClickStory(item.id)
      : () => onClickFeature(item.storyId!, item.id)

  return (
    <button
      type="button"
      className="w-full max-w-full text-left"
      onClick={onClick}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        if (item.kind === 'story') {
          onHover({ kind: 'story', storyId: item.id, rect })
        } else {
          onHover({ kind: 'feature', storyId: item.storyId!, featureId: item.id, rect })
        }
      }}
      onMouseLeave={onLeave}
      title={item.title}
    >
      <div
        className="px-2 py-1 rounded text-[11px] font-medium border shadow-sm truncate"
        style={{ ...style, maxWidth: '100%' }}
      >
        {item.title}
      </div>
    </button>
  )
})

const TimelineCell = React.memo(function TimelineCell({
  items,
  isCurrentDay,
  labels,
  openEdit,
  onHover,
  onLeave,
  onClickStory,
  onClickFeature,
}: {
  items: RowItem[]
  isCurrentDay: boolean
  labels: TimelineLabel[]
  openEdit: (l: TimelineLabel) => void
  onHover: (info: HoverInfo) => void
  onLeave: () => void
  onClickStory: (storyId: string) => void
  onClickFeature: (storyId: string, featureId: string) => void
}) {
  return (
    <div
      data-current-day={isCurrentDay ? 'true' : 'false'}
      className="h-full overflow-auto"
      style={{ padding: CELL_PADDING_PX }}
    >
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <TimelineItem
            key={item.id}
            item={item}
            labels={labels}
            openEdit={openEdit}
            onHover={onHover}
            onLeave={onLeave}
            onClickStory={onClickStory}
            onClickFeature={onClickFeature}
          />
        ))}
      </div>
    </div>
  )
})

export const TimelineGridRow = React.memo(function TimelineGridRow({
  row,
  units,
  unitCount,
  startAligned,
  zoom,
  labels,
  openEdit,
  onHover,
  onLeave,
  onClickStory,
  onClickFeature,
  timelineWidthPx,
  rowHeightPx,
  columnWidthPx,
}: {
  row: RowDefinition
  units: Unit[]
  unitCount: number
  startAligned: Date
  zoom: Zoom
  labels: TimelineLabel[]
  openEdit: (l: TimelineLabel) => void
  onHover: (info: HoverInfo) => void
  onLeave: () => void
  onClickStory: (storyId: string) => void
  onClickFeature: (storyId: string, featureId: string) => void
  timelineWidthPx: number
  rowHeightPx: number
  columnWidthPx: number
}) {
  const buckets = React.useMemo(() => {
    const byIdx: RowItem[][] = Array.from({ length: unitCount }, () => [])
    for (const item of row.items) {
      const idx = getUnitIndex(zoom, startAligned, unitCount, item.timestamp)
      byIdx[idx].push(item)
    }
    return byIdx
  }, [row.items, zoom, startAligned, unitCount])

  return (
    <div
      className="relative border-b"
      style={{ height: rowHeightPx, borderColor: 'var(--border-subtle)' }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 h-full flex" style={{ width: timelineWidthPx }}>
          {units.map((u, i) => {
            const isCurrentDay = zoom === 'day' && diffInDays(u.start, startOfDay(new Date())) === 0
            return (
              <div
                key={u.key}
                className="flex-none h-full"
                style={{
                  width: columnWidthPx,
                  borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                  background: isCurrentDay
                    ? 'color-mix(in srgb, var(--accent-primary) 3%, transparent)'
                    : undefined,
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Cells */}
      <div className="absolute top-0 left-0 h-full flex" style={{ width: timelineWidthPx }}>
        {buckets.map((items, i) => {
          const isCurrentDay =
            zoom === 'day' && diffInDays(units[i].start, startOfDay(new Date())) === 0
          return (
            <div
              key={i}
              className="flex-none h-full"
              style={{
                width: columnWidthPx,
                borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <TimelineCell
                items={items}
                isCurrentDay={isCurrentDay}
                labels={labels}
                openEdit={openEdit}
                onHover={onHover}
                onLeave={onLeave}
                onClickStory={onClickStory}
                onClickFeature={onClickFeature}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
})
