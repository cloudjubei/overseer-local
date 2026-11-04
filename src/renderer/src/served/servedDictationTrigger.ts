import type { NativeDictationTrigger } from 'thefactory-ui/headless'
import { SERVED_DICTATION_UNAVAILABLE } from './servedConstants'

/**
 * Stands in for `core/speech/macOsDictationTrigger` in the served build only:
 * the composer keeps its mic button, and pressing it says dictation needs the
 * desktop app.
 */
export const macOsDictationTrigger: NativeDictationTrigger = {
  isSupported: () => true,
  trigger: async () => ({ status: 'unavailable', reason: SERVED_DICTATION_UNAVAILABLE }),
}
