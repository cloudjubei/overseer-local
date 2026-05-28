import type { NativeDictationTrigger } from 'thefactory-ui/headless'
import { systemDictationService } from '@services/systemDictationService'

/**
 * `NativeDictationTrigger` adapter for the desktop renderer. Detects
 * macOS (we ship desktop on macOS first; Windows/Linux get their own
 * adapters when they land), hands the actual trigger off to the
 * preload bridge so the keystroke synthesis runs in the main process
 * where Node's `child_process.spawn` is available.
 *
 * `isSupported()` is synchronous because the hook needs to decide
 * whether to render the mic button on first paint. We check the
 * userAgent and the presence of the preload bridge — both stable on
 * Electron 30+.
 */
function isMacOs(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent ?? ''
  return /Mac OS X|Macintosh/i.test(ua)
}

export const macOsDictationTrigger: NativeDictationTrigger = {
  isSupported() {
    if (!isMacOs()) return false
    return typeof systemDictationService.trigger === 'function'
  },
  async trigger() {
    return await systemDictationService.trigger()
  },
}
