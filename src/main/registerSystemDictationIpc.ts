import { ipcMain, shell, systemPreferences } from 'electron'
import { spawn } from 'node:child_process'
import IPC_HANDLER_KEYS from '../preload/ipcHandlersKeys'

/**
 * Result of attempting to dispatch the macOS Dictation shortcut. Shape
 * matches the renderer's `NativeDictationResult` so the bridge is a
 * passthrough.
 */
export type SystemDictationResult =
  | { status: 'started' }
  | { status: 'unavailable'; reason: string }

/**
 * Wires the desktop-side native-dictation IPC. Two channels:
 *
 *  - `SYSTEM_DICTATION_TRIGGER` — kick off macOS Dictation by sending
 *    Fn twice via `osascript`. macOS handles everything from there:
 *    its own mic indicator appears in the menu bar, the floating
 *    dictation circle pops up, and transcribed text lands directly
 *    in the focused text input via the OS's text input services.
 *
 *  - `SYSTEM_DICTATION_OPEN_SETTINGS` — open the Privacy &
 *    Security → Accessibility pane when the user needs to grant
 *    permission. Surfaced as a button on the error popup.
 *
 * We rely on the user having macOS Dictation enabled (System
 * Settings → Keyboard → Dictation) with the default Fn-twice
 * shortcut. If they've remapped it the keystroke still goes through
 * but it won't start dictation — the user sees nothing and we can't
 * detect that case. Acceptable for v1; if it becomes a friction
 * point we can detect the shortcut from
 * `defaults read com.apple.HIToolbox AppleDictationAutoEnable` and
 * the related key-binding plist.
 */
export function registerSystemDictationIpc(): () => void {
  const handleTrigger = (): Promise<SystemDictationResult> => {
    if (process.platform !== 'darwin') {
      return Promise.resolve({ status: 'unavailable', reason: 'not-macos' })
    }
    // Probe accessibility permission first so we can return a precise
    // failure reason instead of a generic osascript error. `false`
    // means we wouldn't be able to send synthetic keystrokes; macOS
    // will pop up the prompt itself on the next call, but knowing
    // up front lets us short-circuit with the actionable error.
    if (!systemPreferences.isTrustedAccessibilityClient(false)) {
      return Promise.resolve({ status: 'unavailable', reason: 'accessibility-permission' })
    }
    return new Promise<SystemDictationResult>((resolve) => {
      // Two Fn presses in quick succession is the default macOS
      // Dictation shortcut. `key code 63` is the Fn key. Some Mac
      // keyboard firmwares trap Fn locally; in that case the
      // keystroke is dispatched but never observed by the dictation
      // listener — the user sees nothing happen and the call still
      // exits 0. There's no reliable way to detect that from here.
      const script = `tell application "System Events"
  key code 63
  delay 0.08
  key code 63
end tell`
      const child = spawn('osascript', ['-e', script])
      let stderr = ''
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
      child.on('error', (err) => {
        resolve({ status: 'unavailable', reason: err.message })
      })
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ status: 'started' })
        } else if (/not authorized|1002/i.test(stderr)) {
          resolve({ status: 'unavailable', reason: 'accessibility-permission' })
        } else {
          resolve({
            status: 'unavailable',
            reason: stderr.trim() || `osascript exit ${code}`,
          })
        }
      })
    })
  }

  const handleOpenSettings = async (): Promise<void> => {
    // Deep-link straight to the Accessibility pane. On macOS Ventura+
    // the URL scheme is `x-apple.systempreferences:`; older versions
    // accepted the same scheme so this is safe.
    await shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    )
  }

  ipcMain.handle(IPC_HANDLER_KEYS.SYSTEM_DICTATION_TRIGGER, () => handleTrigger())
  ipcMain.handle(IPC_HANDLER_KEYS.SYSTEM_DICTATION_OPEN_SETTINGS, () => handleOpenSettings())

  return () => {
    ipcMain.removeHandler(IPC_HANDLER_KEYS.SYSTEM_DICTATION_TRIGGER)
    ipcMain.removeHandler(IPC_HANDLER_KEYS.SYSTEM_DICTATION_OPEN_SETTINGS)
  }
}
