import { useEffect, useRef } from 'react'

// Simple global registry for unsaved change checkers
// Components (forms, editors) can register a getter that returns whether they are dirty.

export type UnsavedCheck = () => boolean

const registry = new Map<string, UnsavedCheck>()

export function registerUnsavedCheck(key: string, getIsDirty: UnsavedCheck): () => void {
  registry.set(key, getIsDirty)
  return () => {
    // only remove if same reference (avoid removing someone else accidentally)
    const cur = registry.get(key)
    if (cur === getIsDirty) registry.delete(key)
  }
}

export function hasUnsavedChanges(): boolean {
  for (const [, check] of registry) {
    try {
      if (check()) return true
    } catch {
      // ignore checker errors
    }
  }
  return false
}

export async function confirmDiscardIfUnsaved(message?: string): Promise<boolean> {
  if (!hasUnsavedChanges()) return true
  const msg = message || 'You have unsaved changes. Do you want to discard them and navigate away?'
  return window.confirm(msg)
}

// Convenience hook for components to register a dirty checker bound to their lifecycle
export function useUnsavedChanges(key: string, getIsDirty: UnsavedCheck) {
  const ref = useRef(getIsDirty)
  ref.current = getIsDirty
  useEffect(() => {
    return registerUnsavedCheck(key, () => ref.current())
  }, [key])
}
