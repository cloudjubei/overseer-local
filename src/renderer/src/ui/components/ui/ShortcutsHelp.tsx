import { useEffect, useMemo, useState } from 'react'
import { useShortcuts } from '@core/shortcuts/ShortcutsContext'
import { useAppSettings } from '@core/contexts/AppSettingsContext'
import { ShortcutsHelpView, type ShortcutEntry } from 'thefactory-ui/web'

/**
 * App-side wrapper: registers the help shortcut and pulls the registered shortcut
 * list from the `useShortcuts` context, then renders the library's view.
 */
export default function ShortcutsHelp() {
  const { register, list, prettyCombo } = useShortcuts()
  const { settings } = useAppSettings()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    return register({
      id: 'help',
      comboKeys: settings.userPreferences.shortcuts.help,
      handler: () => setOpen((v) => !v),
      description: 'Show keyboard shortcuts',
    })
  }, [register, settings.userPreferences.shortcuts.help])

  const shortcuts = useMemo<ShortcutEntry[]>(
    () =>
      list().flatMap((s) =>
        s.description ? [{ id: s.id, description: s.description, combo: s.comboKeys }] : [],
      ),
    [list],
  )

  return (
    <ShortcutsHelpView
      open={open}
      onClose={() => setOpen(false)}
      shortcuts={shortcuts}
      prettyShortcut={prettyCombo}
    />
  )
}
