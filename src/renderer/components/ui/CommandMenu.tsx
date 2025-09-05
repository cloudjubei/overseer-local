import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const items = useMemo(() => commandsBase(nav), [nav]);

  const combos = appSettings.userPreferences.shortcuts;

  useEffect(() => {
    return register({ id: 'cmdk', keys: comboMatcher(combos.commandMenu), handler: () => setOpen(true), description: 'Open command menu', scope: 'global' });
  }, [register, combos.commandMenu]);
  useEffect(() => {
    return register({ id: 'slash-search', keys: comboMatcher(combos.slashSearch), handler: () => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); } });
  }, [register, combos.slashSearch]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter((x) => x.label.toLowerCase().includes(q));
  }, [items, query]);

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
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
            aria-label="Command menu search"
          />
          <kbd className="kbd">⌘K</kbd>
        </div>
        <ul className="cmd__list" role="listbox">
          {filtered.map((cmd, i) => (
            <li key={cmd.id} className="cmd__item" role="option">
              <button
                type="button"
                onClick={() => { cmd.run(); setOpen(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { cmd.run(); setOpen(false); } }}
              >
                <span>{cmd.label}</span>
                {cmd.shortcut ? <span className="cmd__shortcut">{cmd.shortcut}</span> : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="cmd__empty" aria-live="polite">No commands found</li>
          )}
        </ul>
      </div>
    </div>,
    document.body
  );
}
