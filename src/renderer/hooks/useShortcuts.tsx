import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

type ShortcutHandler = (e: KeyboardEvent) => boolean | void;
export type Shortcut = { id: string; keys: (e: KeyboardEvent) => boolean; handler: ShortcutHandler; description?: string; scope?: 'global' | 'list' | 'panel' | 'modal' };

type ShortcutsApi = {
  register: (sc: Shortcut) => () => void;
  list: () => Shortcut[];
};

const Ctx = createContext<ShortcutsApi | null>(null);

export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const mapRef = useRef<Map<string, Shortcut>>(new Map());

  const register = useCallback((sc: Shortcut) => {
    mapRef.current.set(sc.id, sc);
    return () => { mapRef.current.delete(sc.id); };
  }, []);

  const list = useCallback(() => Array.from(mapRef.current.values()), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Iterate in registration order; first match wins
      for (const sc of mapRef.current.values()) {
        try {
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
export const match = {
  modK: (e: KeyboardEvent) => (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey),
  modN: (e: KeyboardEvent) => (e.key === 'n' || e.key === 'N') && (e.metaKey || e.ctrlKey),
  slash: (e: KeyboardEvent) => e.key === '/',
  question: (e: KeyboardEvent) => e.key === '?',
  esc: (e: KeyboardEvent) => e.key === 'Escape',
};
