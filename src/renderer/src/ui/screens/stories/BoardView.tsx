import { useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import type { GetStoryResponse } from 'thefactory-ui/headless/api'
import { StatusControl, STATUS_OPTIONS, type StoryStatus as Status } from 'thefactory-ui/web'

const DND_MIME = 'application/x-thefactory-story-id'

export type BoardViewProps = {
  stories: GetStoryResponse[]
  storyDisplayIndex: (id: string) => number | undefined
  onEdit: (storyId: string) => void
  /** Status change wired to the parent's `updateStory`. Required because dropping a card on another column triggers it. */
  onChangeStoryStatus: (storyId: string, status: Status) => void
}

export default function BoardView({
  stories,
  storyDisplayIndex,
  onEdit,
  onChangeStoryStatus,
}: BoardViewProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<Status | null>(null)

  const columns = useMemo(() => {
    const groups = new Map<Status, GetStoryResponse[]>()
    for (const opt of STATUS_OPTIONS) groups.set(opt.value, [])
    for (const s of stories) groups.get(s.status)?.push(s)
    return STATUS_OPTIONS.map((opt) => ({ ...opt, stories: groups.get(opt.value) ?? [] }))
  }, [stories])

  const onCardDragStart = (storyId: string) => (e: DragEvent<HTMLLIElement>) => {
    e.dataTransfer.setData(DND_MIME, storyId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(storyId)
  }

  const onCardDragEnd = () => {
    setDraggingId(null)
    setDragOverStatus(null)
  }

  const onColumnDragOver = (status: Status) => (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(DND_MIME) && draggingId === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverStatus !== status) setDragOverStatus(status)
  }

  const onColumnDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Only clear when the cursor leaves the column outer box, not when crossing
    // into a child (which fires `dragleave` on the parent).
    if (e.currentTarget === e.target) setDragOverStatus(null)
  }

  const onColumnDrop = (status: Status) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const storyId = e.dataTransfer.getData(DND_MIME) || draggingId
    setDraggingId(null)
    setDragOverStatus(null)
    if (!storyId) return
    const story = stories.find((s) => s.id === storyId)
    if (!story || story.status === status) return
    onChangeStoryStatus(storyId, status)
  }

  return (
    // `h-full` (not `flex-1`) because the wrapper in `StoriesListView` isn't
    // a flex container — it just sets `flex-1 min-h-0 overflow-hidden`.
    // `h-full` percent-resolves against that wrapper's height, which the
    // parent flex column does give it (it's a flex item with definite size).
    // Columns are direct children of this flex row, sized by `shrink-0 w-72`
    // and stretched to the row's height via the default `align-items:
    // stretch` — that gives the column body's `flex-1 min-h-0 overflow-y-
    // auto` something concrete to clamp against.
    <div className="h-full w-full flex flex-row gap-3 p-3 overflow-x-auto overflow-y-hidden">
      {columns.map((col) => (
        <div
          key={col.value}
          className="flex flex-col rounded-lg border border-(--border-subtle) shrink-0 w-72 transition-colors min-h-0"
          style={{
            background:
              dragOverStatus === col.value
                ? 'color-mix(in srgb, var(--accent-primary) 8%, transparent)'
                : undefined,
          }}
          onDragOver={onColumnDragOver(col.value)}
          onDragLeave={onColumnDragLeave}
          onDrop={onColumnDrop(col.value)}
          aria-label={`${col.label} column`}
        >
          <header className="flex items-center justify-between px-2 py-2 shrink-0 border-b border-(--border-subtle)">
            <StatusControl status={col.value} />
            <span className="text-xs tabular-nums opacity-60">{col.stories.length}</span>
          </header>
          {col.stories.length === 0 ? (
            <p className="text-xs opacity-60 px-2 py-2">No stories</p>
          ) : (
            <ul className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto p-2">
              {col.stories.map((story) => (
                <BoardCard
                  key={story.id}
                  story={story}
                  displayIndex={storyDisplayIndex(story.id)}
                  isDragging={draggingId === story.id}
                  onDragStart={onCardDragStart(story.id)}
                  onDragEnd={onCardDragEnd}
                  onEdit={() => onEdit(story.id)}
                  onChangeStatus={(next) => onChangeStoryStatus(story.id, next)}
                />
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

type BoardCardProps = {
  story: GetStoryResponse
  displayIndex: number | undefined
  isDragging: boolean
  onDragStart: (e: DragEvent<HTMLLIElement>) => void
  onDragEnd: () => void
  onEdit: () => void
  onChangeStatus: (next: Status) => void
}

function BoardCard({
  story,
  displayIndex,
  isDragging,
  onDragStart,
  onDragEnd,
  onEdit,
  onChangeStatus,
}: BoardCardProps) {
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-grabbed={isDragging}
      className={[
        'rounded border border-(--border-subtle) bg-(--surface-raised) text-sm',
        'hover:bg-(--surface-hover) cursor-grab active:cursor-grabbing',
        isDragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <button type="button" onClick={onEdit} className="w-full text-left px-2 py-1.5">
        <div className="flex items-baseline gap-2 min-w-0">
          {displayIndex !== undefined && (
            <span className="opacity-50 tabular-nums shrink-0">#{displayIndex}</span>
          )}
          <span className="truncate">{story.title}</span>
        </div>
      </button>
      <div className="px-2 pb-1.5 flex items-center justify-between gap-2">
        <StatusControl status={story.status} onChange={onChangeStatus} />
        <span className="text-[10px] tabular-nums opacity-60">
          {story.features.length} {story.features.length === 1 ? 'feature' : 'features'}
        </span>
      </div>
    </li>
  )
}
