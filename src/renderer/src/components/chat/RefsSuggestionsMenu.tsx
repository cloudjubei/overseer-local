export interface MenuPosition {
  left: number
  top: number
}

interface RefItem {
  ref: string
  display: string
  title: string
  type: string
}

export default function RefsSuggestionsMenu({
  matches,
  position,
  onSelect,
}: {
  matches: RefItem[]
  position: MenuPosition
  onSelect: (ref: string) => void
}) {
  return (
    <div
      className="fixed z-[var(--z-dropdown,1000)] min-w-[260px] max-h-[220px] overflow-auto rounded-md border border-[var(--border-default)] bg-[var(--surface-overlay)] shadow-[var(--shadow-3)]"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        transform: 'translateY(-100%)',
      }}
      role="listbox"
      aria-label="References suggestions"
    >
      {matches.map((item, idx) => (
        <div
          key={idx}
          className="px-3 py-2 cursor-pointer hover:bg-[color-mix(in_srgb,var(--accent-primary)_8%,transparent)] text-[var(--text-primary)]"
          role="option"
          onClick={() => onSelect(item.ref)}
        >
          #{item.display} - {item.title} ({item.type})
        </div>
      ))}
    </div>
  )
}
