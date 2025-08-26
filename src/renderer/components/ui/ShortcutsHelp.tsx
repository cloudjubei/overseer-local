import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShortcuts, match } from '../../hooks/useShortcuts';

export default function ShortcutsHelp() {
  const { list, register } = useShortcuts();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return register({ id: 'help', keys: match.question, handler: () => setOpen(true), description: 'Open keyboard shortcuts help', scope: 'global' });
  }, [register]);

  const shortcuts = list();

  if (!open) return null;
  return createPortal(
    <div className="help-overlay" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
      <div className="help" onClick={(e) => e.stopPropagation()}>
        <div className="help__header">
          <h2 className="help__title">Keyboard Shortcuts</h2>
          <button className="help__close" onClick={() => setOpen(false)} aria-label="Close">×</button>
        </div>
        <div className="help__body">
          <ul className="help__list">
            {shortcuts.map((s) => (
              <li key={s.id} className="help__item">
                <span className="help__desc">{s.description || s.id}</span>
                <span className="help__keys">{/* Best effort format by id */}
                  {s.id === 'cmdk' ? 'Cmd/Ctrl+K' : s.id === 'new-task' ? 'Cmd/Ctrl+N' : s.id === 'help' ? '?' : s.id === 'slash-search' ? '/' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
}
