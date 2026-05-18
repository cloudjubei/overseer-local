import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { comboMatches, prettyCombo as pretty } from './comboMatcher'

export type ShortcutHandler = (e: KeyboardEvent) => boolean | void

export type Shortcut = {
  id: string
  comboKeys: string
  handler: ShortcutHandler
  description?: string
  scope?: 'global' | 'list' | 'panel' | 'modal'
}

type ShortcutsApi = {
  register: (sc: Shortcut) => () => void
  list: () => Shortcut[]
  prettyCombo: (combo: string) => string
}

const ShortcutsCtx = createContext<ShortcutsApi | null>(null)

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings()
  const modifier = settings.userPreferences.shortcutsModifier
  const mapRef = useRef<Map<string, Shortcut>>(new Map())

  const register = useCallback((sc: Shortcut) => {
    mapRef.current.set(sc.id, sc)
    return () => {
      mapRef.current.delete(sc.id)
    }
  }, [])

  const list = useCallback(() => Array.from(mapRef.current.values()), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = (target?.tagName || '').toLowerCase()
      const isEditable =
        (target && target.isContentEditable) ||
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select'

      for (const sc of mapRef.current.values()) {
        try {
          if (isEditable && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) continue
          if (comboMatches(sc.comboKeys, e, modifier)) {
            const res = sc.handler(e)
            if (res !== false) {
              e.preventDefault()
              e.stopPropagation()
              return
            }
          }
        } catch {
          /* ignore handler errors so a misbehaving shortcut can't lock the keyboard */
        }
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [modifier])

  const prettyCombo = useCallback((combo: string) => pretty(combo, modifier), [modifier])

  const api = useMemo<ShortcutsApi>(
    () => ({ register, list, prettyCombo }),
    [register, list, prettyCombo],
  )
  return <ShortcutsCtx.Provider value={api}>{children}</ShortcutsCtx.Provider>
}

export function useShortcuts(): ShortcutsApi {
  const ctx = useContext(ShortcutsCtx)
  if (!ctx) {
    return {
      register: () => () => {},
      list: () => [],
      prettyCombo: (combo) => combo,
    }
  }
  return ctx
}
