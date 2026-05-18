import { useCallback } from 'react'
import { useAppSettings } from '@core/contexts/AppSettingsContext'
import {
  AVAILABLE_THEMES,
  DEFAULT_APP_SETTINGS,
  type ShortcutsConfig,
  type ShortcutsModifier,
  type Theme,
} from '@core/types/settings'
import { Button, Input } from 'thefactory-ui/web'
import { NativeSelect as Select } from 'thefactory-ui/web'

const THEME_LABEL: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

export default function VisualSettings() {
  const { settings, setTheme, setUserPreferences } = useAppSettings()

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

  const onShortcutChange = (keyName: keyof ShortcutsConfig, combo: string) => {
    setUserPreferences({
      shortcuts: { ...settings.userPreferences.shortcuts, [keyName]: combo },
    })
  }

  const resetShortcutsToDefault = () => {
    setUserPreferences({ shortcuts: DEFAULT_APP_SETTINGS.userPreferences.shortcuts })
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Appearance</h2>
      <div className="space-y-2">
        <label htmlFor="theme" className="block text-sm font-medium">
          Theme
        </label>
        <Select
          id="theme"
          value={settings.theme}
          onChange={(e) => setTheme(e.target.value as Theme)}
          className="w-64"
        >
          {AVAILABLE_THEMES.map((t) => (
            <option key={t} value={t}>
              {THEME_LABEL[t]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2 mt-6">
        <label htmlFor="shortcuts-mod" className="block text-sm font-medium">
          Shortcuts modifier key
        </label>
        <Select
          id="shortcuts-mod"
          value={settings.userPreferences.shortcutsModifier}
          onChange={(e) =>
            setUserPreferences({ shortcutsModifier: e.target.value as ShortcutsModifier })
          }
          className="w-64"
        >
          <option value="meta">Cmd (⌘) / Meta</option>
          <option value="ctrl">Ctrl</option>
        </Select>
        <div className="text-[12px] text-(--text-secondary)">
          This controls which key acts as the modifier for app shortcuts like Cmd/Ctrl+K and +N.
        </div>
      </div>

      <div className="space-y-2 mt-8">
        <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
        <p className="text-[12px] text-(--text-secondary)">
          Click a field and press the desired key combination. Mod maps to your selected modifier
          (Cmd on macOS, Ctrl on Windows/Linux).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-sm font-medium mb-1">Command Menu</label>
            <Input
              value={settings.userPreferences.shortcuts.commandMenu}
              onChange={() => {}}
              onKeyDown={(e) => {
                e.preventDefault()
                const v = captureCombo(e)
                if (v) onShortcutChange('commandMenu', v)
              }}
              placeholder="Press keys..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Story</label>
            <Input
              value={settings.userPreferences.shortcuts.newStory}
              onChange={() => {}}
              onKeyDown={(e) => {
                e.preventDefault()
                const v = captureCombo(e)
                if (v) onShortcutChange('newStory', v)
              }}
              placeholder="Press keys..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Help Menu</label>
            <Input
              value={settings.userPreferences.shortcuts.help}
              onChange={() => {}}
              onKeyDown={(e) => {
                e.preventDefault()
                const v = captureCombo(e)
                if (v) onShortcutChange('help', v)
              }}
              placeholder="Press keys..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Add Feature to UI Improvements</label>
            <Input
              value={settings.userPreferences.shortcuts.addUiFeature}
              onChange={() => {}}
              onKeyDown={(e) => {
                e.preventDefault()
                const v = captureCombo(e)
                if (v) onShortcutChange('addUiFeature', v)
              }}
              placeholder="Press keys..."
            />
          </div>
        </div>
        <div className="mt-2">
          <Button onClick={resetShortcutsToDefault} variant="outline">
            Reset to defaults
          </Button>
        </div>
      </div>
    </div>
  )
}
