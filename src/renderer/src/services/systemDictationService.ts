import type { NativeDictationResult } from 'thefactory-ui/headless'

/**
 * Renderer-side typed handle for the preload bridge that triggers
 * macOS native Dictation. Resolves with the same `NativeDictationResult`
 * shape `useNativeDictationTrigger` consumes, so the adapter can pass
 * it straight through.
 */
export type SystemDictationService = {
  trigger: () => Promise<NativeDictationResult>
  openSettings: () => Promise<void>
}

export const systemDictationService: SystemDictationService = {
  ...(window as { systemDictation?: SystemDictationService }).systemDictation!,
}
