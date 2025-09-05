import React, { useEffect, useMemo, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { useNavigator } from '../../navigation/Navigator';
import { useShortcuts, comboMatcher } from '../../hooks/useShortcuts';
import { useAppSettings } from '../../hooks/useAppSettings';

export type CommandMenuApi = {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
};

const UI_IMPROVEMENTS_TASK_ID = 'f9eef18e-818e-427d-82ab-8d990bb199c4';

const commandsBase = (
  nav: ReturnType<typeof useNavigator>
) => [
  { id: 'add-ui-feature', label: 'Add Feature to UI Improvements', shortcut: 'Cmd/Ctrl+Shift+F', run: () => nav.openModal({ type: 'feature-create', taskId: UI_IMPROVEMENTS_TASK_ID }) },
  { id: 'new-task', label: 'New Task', shortcut: 'Cmd/Ctrl+N', run: () => nav.openModal({ type: 'task-create' }) },
  { id: 'go-home', label: 'Go to Home', run: () => nav.navigateView('Home') },
  { id: 'go-files', label: 'Go to Files', run: () => nav.navigateView('Files') },
  { id: 'go-chat', label: 'Go to Chat', run: () => nav.navigateView('Chat') },
  { id: 'go-agents', label: 'Go to Agents', run: () => nav.navigateView('Agents') },
  { id: 'go-settings', label: 'Go to Settings', run: () => nav.navigateView('Settings') },
];

export default function CommandMenu() {
  const nav = useNavigator();
  const { register } = useShortcuts();
  const { appSettings } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const items = useMemo(() => commandsBase(nav), [nav]);
  const listboxId = useId();

  const combos = appSettings.userPreferences.shortcuts;

  useEffect(() => {
    return register({ id: 'command-menu', keys: comboMatcher(combos.commandMenu), handler: () => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }, description: 'Open command menu', scope: 'global' });
  }, [register, combos.commandMenu]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((x) => x.label.toLowerCase().includes(q));
  }, [items, query]);

  // Reset or clamp selected index when query or open state changes
  useEffect(() => {
    if (!open) return;
    if (filtered.length === 0) {
      setSelectedIndex(-1);
    } else {
      // Ensure selectedIndex is within range; default to 0 on new query
      setSelectedIndex((prev) => (prev >= 0 && prev < filtered.length ? prev : 0));
    }
  }, [query, filtered.length, open]);

  const moveSelection = (delta: number) => {
    if (filtered.length === 0) return;
    setSelectedIndex((prev) => {
      const base = prev < 0 ? 0 : prev;
      const next = (base + delta + filtered.length) % filtered.length;
      return next;
    });
  };

  const runSelected = () => {
    if (selectedIndex >= 0 && selectedIndex < filtered.length) {
      const cmd = filtered[selectedIndex];
      cmd.run();
      setOpen(false);
    }
  };

  if (!open) return null;
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
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                moveSelection(1);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                moveSelection(-1);
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                runSelected();
              }
            }}
            aria-label="Command menu search"
            aria-controls={listboxId}
            aria-activedescendant={selectedIndex >= 0 && selectedIndex < filtered.length ? `${listboxId}-option-${selectedIndex}` : undefined}
          />
          <kbd className="kbd">⌘K</kbd>
        </div>
        <ul className="cmd__list" role="listbox" id={listboxId}>
          {filtered.map((cmd, i) => {
            const active = i === selectedIndex;
            return (
              <li
                key={cmd.id}
                id={`${listboxId}-option-${i}`}
                className={`cmd__item${active ? ' is-active' : ''}`}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <button
                  type="button"
                  onClick={() => { cmd.run(); setOpen(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { cmd.run(); setOpen(false); } }}
                >
                  <span>{cmd.label}</span>
                  {cmd.shortcut ? <span className="cmd__shortcut">{cmd.shortcut}</span> : null}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="cmd__empty" aria-live="polite">No commands found</li>
          )}
        </ul>
      </div>
    </div>,
    document.body
  );
}
