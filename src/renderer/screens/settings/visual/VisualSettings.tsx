import { useCallback } from 'react'
import { Button } from '../../components/ui/Button'
import { useTheme, type Theme } from '../../hooks/useTheme'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { type ShortcutsModifier, type ShortcutsConfig, DEFAULT_APP_SETTINGS } from '../../../types/settings'

export default function VisualSettings() {
  const { availableThemes, theme, setTheme } = useTheme()
  const { appSettings, setUserPreferences } = useAppSettings()

  const captureCombo = useCallback((e: React.KeyboardEvent<HTMLInputElement>): string => {
    const parts: string[] = []
    if (e.metaKey || e.ctrlKey) parts.push('Mod')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')
    const key = e.key
    if (key && key !== 'Shift' && key !== 'Meta' && key !== 'Control' && key !== 'Alt') {
      if (key.length === 1) {
        parts.push(key.toUpperCase())
      } else {
        parts.push(key)
      }
    }
    return parts.length ? parts.join('+') : ''
  }, [])

  const onShortcutChange = async (keyName: keyof ShortcutsConfig, combo: string) => {
    return await setUserPreferences({
      shortcuts: { ...appSettings.userPreferences.shortcuts, [keyName]: combo },
    })
  }

  const resetShortcutsToDefault = async () => {
    await setUserPreferences({ shortcuts: DEFAULT_APP_SETTINGS.userPreferences.shortcuts })
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Appearance</h2>
      <div className="space-y-2">
        <label htmlFor="theme" className="block text-sm font-medium">Theme</label>
        <select
          id="theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value as Theme)}
          className="w-64 p-2 border border-gray-300 rounded-md focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
        >
          {availableThemes.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 mt-6">
        <label htmlFor="shortcuts-mod" className="block text-sm font-medium">Shortcuts modifier key</label>
        <select
          id="shortcuts-mod"
          value={appSettings.userPreferences.shortcutsModifier}
          onChange={async (e) => await setUserPreferences({ shortcutsModifier: e.target.value as ShortcutsModifier })}
          className="w-64 p-2 border border-gray-300 rounded-md focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
        >
          <option value="meta">Cmd (⌘) / Meta</option>
          <option value="ctrl">Ctrl</option>
        </select>
        <div className="text-[12px] text-[var(--text-secondary)]">
          This controls which key acts as the modifier for app shortcuts like Cmd/Ctrl+K and +N.
        </div>
      </div>

      <div className="space-y-2 mt-8">
        <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
        <p className="text-[12px] text-[var(--text-secondary)]">
          Click a field and press the desired key combination. Mod maps to your selected modifier (Cmd on macOS, Ctrl on Windows/Linux).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-sm font-medium mb-1">Command Menu</label>
            <input
              type="text"
              value={appSettings.userPreferences.shortcuts.commandMenu}
              onChange={() => {}}
              onKeyDown={(e) => {
                e.preventDefault()
                const v = captureCombo(e)
                if (v) onShortcutChange('commandMenu', v)
              }}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Press keys..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Task</label>
            <input
              type="text"
              value={appSettings.userPreferences.shortcuts.newTask}
              onChange={() => {}}
              onKeyDown={(e) => {
                e.preventDefault()
                const v = captureCombo(e)
                if (v) onShortcutChange('newTask', v)
              }}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Press keys..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Help Menu</label>
            <input
              type="text"
              value={appSettings.userPreferences.shortcuts.help}
              onChange={() => {}}
              onKeyDown={(e) => {
                e.preventDefault()
                const v = captureCombo(e)
                if (v) onShortcutChange('help', v)
              }}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Press keys..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Add Feature to UI Improvements</label>
            <input
              type="text"
              value={appSettings.userPreferences.shortcuts.addUiFeature}
              onChange={() => {}}
              onKeyDown={(e) => {
                e.preventDefault()
                const v = captureCombo(e)
                if (v) onShortcutChange('addUiFeature', v)
              }}
              className="w-full p-2 border border-gray-300 rounded-md"
              placeholder="Press keys..."
            />
          </div>
        </div>
        <div className="mt-2">
          <Button onClick={resetShortcutsToDefault} variant="outline">Reset to defaults</Button>
        </div>
      </div>
    </div>
  )
}
