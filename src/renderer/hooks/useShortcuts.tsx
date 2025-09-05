import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { settingsService } from '../services/settingsService';
import type { AppSettings, ShortcutsModifier } from '../../types/settings';

type ShortcutHandler = (e: KeyboardEvent) => boolean | void;
export type Shortcut = { id: string; keys: (e: KeyboardEvent) => boolean; handler: ShortcutHandler; description?: string; scope?: 'global' | 'list' | 'panel' | 'modal' };

type ShortcutsApi = {
  register: (sc: Shortcut) => () => void;
  list: () => Shortcut[];
};

const Ctx = createContext<ShortcutsApi | null>(null);

// Track current modifier preference in module scope; updated on provider mount
let CURRENT_MOD: ShortcutsModifier = 'ctrl';

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const mapRef = useRef<Map<string, Shortcut>>(new Map());

  useEffect(() => {
    let mounted = true;
    // Load initial modifier from app settings
    (async () => {
      try {
        const app: AppSettings = await settingsService.getAppSettings();
        if (mounted) CURRENT_MOD = app.userPreferences.shortcutsModifier || CURRENT_MOD;
      } catch {}
    })();
    // No subscribe API exposed for app settings; match() will read CURRENT_MOD on each keydown
    return () => { mounted = false };
  }, []);

  const register = useCallback((sc: Shortcut) => {
    mapRef.current.set(sc.id, sc);
    return () => { mapRef.current.delete(sc.id); };
  }, []);

  const list = useCallback(() => Array.from(mapRef.current.values()), []);

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
          if (sc.keys(e)) {
            const res = sc.handler(e);
            if (res !== false) { e.preventDefault(); e.stopPropagation(); return; }
          }
        } catch {}
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true } as any);
  }, []);

  const api = useMemo(() => ({ register, list }), [register, list]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useShortcuts() {
  const ctx = useContext(Ctx);
  if (!ctx) return { register: () => () => {}, list: () => [] as Shortcut[] } as ShortcutsApi;
  return ctx;
}

// Helpers
function isMod(e: KeyboardEvent) {
  return CURRENT_MOD === 'meta' ? e.metaKey : e.ctrlKey;
}

export const match = {
  modK: (e: KeyboardEvent) => (e.key === 'k' || e.key === 'K') && isMod(e),
  modN: (e: KeyboardEvent) => (e.key === 'n' || e.key === 'N') && isMod(e),
  slash: (e: KeyboardEvent) => e.key === '/',
  question: (e: KeyboardEvent) => e.key === '?',
  esc: (e: KeyboardEvent) => e.key === 'Escape',
};

// Parse a human-readable combo string into a matcher
// Supported tokens: Mod, Ctrl, Meta, Cmd, Shift, Alt, and a base key like 'K', 'N', 'H', '/', '?', 'F'
export function comboMatcher(combo: string) {
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

  // Normalize base
  const baseKey = (base || '').length === 1 ? (base as string) : (base || '');

  return (e: KeyboardEvent) => {
    // Mod resolves to current preference
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
  }
}
