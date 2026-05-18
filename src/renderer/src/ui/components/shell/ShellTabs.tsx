import type { ReactNode } from 'react'

export type TabKey = string

export type TabDef<K extends TabKey> = {
  key: K
  label: string
}

export type ShellTabsProps<K extends TabKey> = {
  tabs: ReadonlyArray<TabDef<K>>
  active: K
  onSelect: (key: K) => void
  rightSlot?: ReactNode
}

/**
 * Minimal horizontal tab bar used by the authed shell to switch between
 * per-project screens (stories, chat, …). No routing yet — pure UI state.
 */
export default function ShellTabs<K extends TabKey>({
  tabs,
  active,
  onSelect,
  rightSlot,
}: ShellTabsProps<K>) {
  return (
    <nav
      className="flex items-center gap-1 px-4 border-b shrink-0"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-base)' }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            aria-current={isActive ? 'page' : undefined}
            className="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: isActive ? 'var(--color-brand-600)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {tab.label}
          </button>
        )
      })}
      {rightSlot && <div className="ml-auto flex items-center">{rightSlot}</div>}
    </nav>
  )
}
