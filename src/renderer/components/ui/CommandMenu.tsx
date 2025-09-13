import React, { useEffect, useMemo, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { useNavigator } from '../../navigation/Navigator'
import { useShortcuts } from '../../hooks/useShortcuts'
import { useAppSettings } from '../../contexts/AppSettingsContext'

export type CommandMenuApi = {
  open: () => void
  close: () => void
  isOpen: () => boolean
}

export const UI_IMPROVEMENTS_TASK_ID = 'f67e8921-b197-40c9-9154-e95db8f27deb'

const commandsBase = (nav: ReturnType<typeof useNavigator>) => [
  {
    id: 'add-ui-feature',
    label: 'Add Feature to UI Improvements',
    run: () => nav.openModal({ type: 'feature-create', taskId: UI_IMPROVEMENTS_TASK_ID }),
  },
  { id: 'new-task', label: 'New Task', run: () => nav.openModal({ type: 'task-create' }) },
  { id: 'go-home', label: 'Go to Home', run: () => nav.navigateView('Home') },
  { id: 'go-files', label: 'Go to Files', run: () => nav.navigateView('Files') },
  { id: 'go-chat', label: 'Go to Chat', run: () => nav.navigateView('Chat') },
  { id: 'go-agents', label: 'Go to Agents', run: () => nav.navigateView('Agents') },
  { id: 'go-settings', label: 'Go to Settings', run: () => nav.navigateView('Settings') },
]

export default function CommandMenu() {
  const nav = useNavigator()
  const { register, prettyCombo } = useShortcuts()
  const { appSettings } = useAppSettings()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Start with no selection so the first Down selects the top and the first Up selects the bottom
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const itemRefs = useRef<Array<HTMLLIElement | null>>([])
  const items = useMemo(() => commandsBase(nav), [nav])
  const listboxId = useId()

  const combos = appSettings.userPreferences.shortcuts

  useEffect(() => {
    return register({
      id: 'command-menu',
      comboKeys: combos.commandMenu,
      handler: () => {
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      },
      description: 'Open command menu',
      scope: 'global',
    })
  }, [register, combos.commandMenu])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return items
    return items.filter((x) => x.label.toLowerCase().includes(q))
  }, [items, query])

  // Reset or clamp selected index when query or open state changes
  useEffect(() => {
    if (!open) return
    if (filtered.length === 0) {
      setSelectedIndex(-1)
    } else {
      // If nothing is selected yet, keep it as none selected.
      // If an item is selected, clamp it within the new range [0, length-1].
      setSelectedIndex((prev) => {
        if (prev < 0) return -1
        return Math.max(0, Math.min(prev, filtered.length - 1))
      })
    }
  }, [query, filtered.length, open])

  // Ensure the active item stays in view while navigating
  useEffect(() => {
    if (!open) return
    if (selectedIndex < 0 || selectedIndex >= filtered.length) return
    const el = itemRefs.current[selectedIndex] || null
    if (el) {
      try {
        el.scrollIntoView({ block: 'nearest' })
      } catch {
        // ignore if not supported
      }
    }
  }, [selectedIndex, filtered.length, open])

  const moveSelection = (delta: number) => {
    if (filtered.length === 0) return
    setSelectedIndex((prev) => {
      // First navigation behavior:
      // - If nothing is selected and pressing Down: select 0 (top)
      // - If nothing is selected and pressing Up: select last (bottom)
      if (prev < 0) {
        return delta > 0 ? 0 : filtered.length - 1
      }
      const next = (prev + delta + filtered.length) % filtered.length
      return next
    })
  }

  const runSelected = () => {
    if (selectedIndex >= 0 && selectedIndex < filtered.length) {
      const cmd = filtered[selectedIndex]
      cmd.run()
      setOpen(false)
    }
  }

  const kbdHint = useMemo(() => {
    const str = prettyCombo(combos.commandMenu)
    return str.replace('⌘+', '⌘') // Use compact glyph form on mac preference
  }, [prettyCombo, combos.commandMenu])

  // Map command ids to shortcut combos from settings to avoid hardcoded placeholders
  const idToCombo: Record<string, string> = {
    'command-menu': combos.commandMenu,
    help: combos.help,
    'add-ui-feature': combos.addUiFeature,
    'new-task': combos.newTask,
  }

  if (!open) return null
  return createPortal(
    <div className="cmd-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
      <div className="cmd" onClick={(e) => e.stopPropagation()}>
        <div className="cmd__input">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Command menu search"
            aria-controls={listboxId}
            aria-activedescendant={
              selectedIndex >= 0 && selectedIndex < filtered.length
                ? `${listboxId}-option-${selectedIndex}`
                : undefined
            }
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                moveSelection(1)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                moveSelection(-1)
              } else if (e.key === 'Enter') {
                e.preventDefault()
                runSelected()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setOpen(false)
              }
            }}
          />
          <kbd className="kbd">{kbdHint}</kbd>
        </div>
        <ul className="cmd__list" role="listbox" id={listboxId} ref={listRef}>
          {filtered.map((cmd, i) => {
            const active = i === selectedIndex
            const comboStr = idToCombo[cmd.id as keyof typeof idToCombo]
            return (
              <li
                key={cmd.id}
                id={`${listboxId}-option-${i}`}
                className={`cmd__item ${active ? 'is-active' : ''}`}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setSelectedIndex(i)}
                ref={(el) => (itemRefs.current[i] = el)}
              >
                <button
                  type="button"
                  onClick={() => {
                    cmd.run()
                    setOpen(false)
                  }}
                >
                  <span>{cmd.label}</span>
                  {comboStr ? <span className="cmd__shortcut">{prettyCombo(comboStr)}</span> : null}
                </button>
              </li>
            )
          })}
          {filtered.length === 0 && (
            <li className="cmd__empty" aria-live="polite">
              No commands found
            </li>
          )}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
