import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShortcuts, comboMatcher, getShortcutsModifier } from '../../hooks/useShortcuts';
import { useAppSettings } from '../../hooks/useAppSettings';

export default function ShortcutsHelp() {
  const { list, register } = useShortcuts();
  const { appSettings } = useAppSettings();
  const [open, setOpen] = useState(false);

  const combos = appSettings.userPreferences.shortcuts;

  useEffect(() => {
    return register({ id: 'help', keys: comboMatcher(combos.help), handler: () => setOpen(true), description: 'Open keyboard shortcuts help', scope: 'global' });
  }, [register, combos.help]);

  const shortcuts = list();

  const prettyCombo = useMemo(() => {
    const mod = getShortcutsModifier();
    const isMacPref = mod === 'meta';
    const pretty = (combo: string) => {
      if (!combo) return '';
      const parts = combo.split('+').map(p => p.trim()).filter(Boolean);
      const mapped = parts.map(p => {
        const up = p.toLowerCase();
        if (up === 'mod') return isMacPref ? '⌘' : 'Ctrl';
        if (up === 'cmd' || up === 'meta') return '⌘';
        if (up === 'ctrl' || up === 'control') return 'Ctrl';
        if (up === 'shift') return 'Shift';
        if (up === 'alt' || up === 'option') return isMacPref ? '⌥' : 'Alt';
        return p.toUpperCase();
      });
      return mapped.join('+');
    };
    return pretty;
  }, []);

  const idToCombo: Record<string, string> = {
    'command-menu': appSettings.userPreferences.shortcuts.commandMenu,
    'new-task': appSettings.userPreferences.shortcuts.newTask,
    'help': appSettings.userPreferences.shortcuts.help,
    'add-ui-feature': appSettings.userPreferences.shortcuts.addUiFeature,
  };

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
                <span className="help__keys">{prettyCombo(idToCombo[s.id] || '')}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
}
