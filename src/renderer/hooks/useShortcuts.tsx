import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useNavigator } from '../navigation/Navigator';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { UI_IMPROVEMENTS_TASK_ID } from '../components/ui/CommandMenu';

type ShortcutHandler = (e: KeyboardEvent) => boolean | void;
export type Shortcut = { id: string; comboKeys: string, handler: ShortcutHandler; description?: string; scope?: 'global' | 'list' | 'panel' | 'modal' };

type ShortcutsApi = {
  register: (sc: Shortcut) => () => void;
  list: () => Shortcut[];
  prettyCombo: (combo: string) => string;
};

const Ctx = createContext<ShortcutsApi | null>(null);

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const { appSettings } = useAppSettings()
  
  const mapRef = useRef<Map<string, Shortcut>>(new Map());
  const shortcutsModifier = useMemo(() => appSettings.userPreferences.shortcutsModifier, [appSettings])

  const register = useCallback((sc: Shortcut) => {
    mapRef.current.set(sc.id, sc);
    return () => { mapRef.current.delete(sc.id); };
  }, []);

  const list = useCallback(() => Array.from(mapRef.current.values()), []);

  const isMod = useMemo(() => {
    return (e: KeyboardEvent) => {
      return shortcutsModifier === 'meta' ? e.metaKey : e.ctrlKey;
    };
  }, [shortcutsModifier]);
  
  const prettyCombo = useMemo(() => {
    const isMacPref = shortcutsModifier === 'meta';
    return (combo: string) => {
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
  }, [shortcutsModifier]);

// Parse a human-readable combo string into a matcher
// Supported tokens: Mod, Ctrl, Meta, Cmd, Shift, Alt, and a base key like 'K', 'N', 'H', '/', '?', 'F'
  const comboMatcher = useMemo(() => {
    return (combo: string, e: KeyboardEvent) : boolean => {
    const parts = combo.split('+').map(p => p.trim()).filter(Boolean);
    const need = {
      mod: false,
      ctrl: false,
      meta: false,
      shift: false,
      alt: false,
    };
    let base: string | null = null;

    for (const p of parts) {
      const up = p.toLowerCase();
      if (up === 'mod') need.mod = true;
      else if (up === 'ctrl' || up === 'control') need.ctrl = true;
      else if (up === 'meta' || up === 'cmd' || up === 'command') need.meta = true;
      else if (up === 'shift') need.shift = true;
      else if (up === 'alt' || up === 'option') need.alt = true;
      else base = p;
    }

    // If there was no '+' (e.g., '/'), the base is the original string
    if (!parts.length && combo) base = combo;
    if (!base && parts.length === 1) base = parts[0];

    const baseKey = (base || '').length === 1 ? (base as string) : (base || '');

    if (need.mod) {
      if (!isMod(e)) return false;
    }
    if (need.ctrl && !e.ctrlKey) return false;
    if (need.meta && !e.metaKey) return false;
    if (need.shift && !e.shiftKey) return false;
    if (need.alt && !e.altKey) return false;

    if (!baseKey) return false;

    const ek = e.key;
    // Compare letters case-insensitively
    if (baseKey.length === 1) {
      return ek.toLowerCase() === baseKey.toLowerCase();
    }
    // Fallback exact compare for non-single tokens
    return ek === baseKey;
  }}, [isMod])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Do not intercept if typing in editable fields unless shortcut explicitly handles it
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const isEditable = (target && ((target as any).isContentEditable)) || tag === 'input' || tag === 'textarea' || tag === 'select';

      // Iterate in registration order; first match wins
      for (const sc of mapRef.current.values()) {
        try {
          // If editable and the key is a plain character (no modifiers), skip handling to avoid interference like '/'
          if (isEditable && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
            continue;
          }
          if (comboMatcher(sc.comboKeys, e)) {
            const res = sc.handler(e);
            if (res !== false) { e.preventDefault(); e.stopPropagation(); return; }
          }
        } catch {}
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
  }, []);

  const api = useMemo(() => ({ register, list, shortcutsModifier, prettyCombo }), [register, list, prettyCombo]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useShortcuts() {
  const ctx = useContext(Ctx);
  if (!ctx) return { register: () => () => {}, list: () => [] as Shortcut[], prettyCombo: (combo) => combo } as ShortcutsApi;
  return ctx;
}

export function ShortcutsBootstrap() {
  const { register } = useShortcuts();
  const nav = useNavigator();
  const { appSettings } = useAppSettings();

  const combos = appSettings.userPreferences.shortcuts;

  useEffect(() => {
    const unregisterNew = register({ id: 'new-task', comboKeys: combos.newTask, handler: () => nav.openModal({ type: 'task-create' }), description: 'New task' });
    const unregisterAddUiFeature = register({ id: 'add-ui-feature', comboKeys: combos.addUiFeature, handler: () => nav.openModal({ type: 'feature-create', taskId: UI_IMPROVEMENTS_TASK_ID }), description: 'Add feature to UI Improvements', scope: 'global' });
    return () => { unregisterNew(); unregisterAddUiFeature(); };
  }, [register, nav, combos.newTask, combos.addUiFeature]);

  useEffect(() => {
    const onHash = () => {};
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return null;
}