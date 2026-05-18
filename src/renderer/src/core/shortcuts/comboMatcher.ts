/**
 * Pure helpers for parsing keyboard shortcut combos like `"Mod+Shift+K"` into
 * either a predicate against a `KeyboardEvent` or a pretty-printed string.
 *
 * Mirrors the matcher in overseer-local's `useShortcuts` so both apps accept
 * the same combo format.
 */

import type { ShortcutsModifier } from '../types/settings'

type ComboParts = {
  mod: boolean
  ctrl: boolean
  meta: boolean
  shift: boolean
  alt: boolean
  base: string | null
}

function parseCombo(combo: string): ComboParts {
  const out: ComboParts = {
    mod: false,
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
    base: null,
  }
  const parts = combo
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)

  for (const p of parts) {
    const up = p.toLowerCase()
    if (up === 'mod') out.mod = true
    else if (up === 'ctrl' || up === 'control') out.ctrl = true
    else if (up === 'meta' || up === 'cmd' || up === 'command') out.meta = true
    else if (up === 'shift') out.shift = true
    else if (up === 'alt' || up === 'option') out.alt = true
    else out.base = p
  }

  if (!parts.length && combo) out.base = combo
  return out
}

export function comboMatches(
  combo: string,
  e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; key: string },
  modifier: ShortcutsModifier,
): boolean {
  const need = parseCombo(combo)
  const isMod = modifier === 'meta' ? e.metaKey : e.ctrlKey

  if (need.mod && !isMod) return false
  if (need.ctrl && !e.ctrlKey) return false
  if (need.meta && !e.metaKey) return false
  if (need.shift && !e.shiftKey) return false
  if (need.alt && !e.altKey) return false

  if (!need.base) return false
  if (need.base.length === 1) return e.key.toLowerCase() === need.base.toLowerCase()
  return e.key === need.base
}

export function prettyCombo(combo: string, modifier: ShortcutsModifier): string {
  if (!combo) return ''
  const isMacPref = modifier === 'meta'
  const parts = combo
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
  return parts
    .map((p) => {
      const up = p.toLowerCase()
      if (up === 'mod') return isMacPref ? '⌘' : 'Ctrl'
      if (up === 'cmd' || up === 'meta' || up === 'command') return '⌘'
      if (up === 'ctrl' || up === 'control') return 'Ctrl'
      if (up === 'shift') return 'Shift'
      if (up === 'alt' || up === 'option') return isMacPref ? '⌥' : 'Alt'
      return p.toUpperCase()
    })
    .join('+')
}
