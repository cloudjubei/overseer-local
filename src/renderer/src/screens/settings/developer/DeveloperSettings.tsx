import { useAppSettings } from '../../../contexts/AppSettingsContext'
import { Switch } from '../../../components/ui/Switch'

export default function DeveloperSettings() {
  const { appSettings, setUserPreferences } = useAppSettings()

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Developer</h2>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Diagnostics overlay</div>
            <div className="text-[12px] text-[var(--text-secondary)]">
              Shows CPU, memory, and event-loop lag (dev-only).
            </div>
          </div>

          <Switch
            checked={!!appSettings.userPreferences.showDiagnosticsOverlay}
            onCheckedChange={async (checked) => await setUserPreferences({ showDiagnosticsOverlay: checked })}
          />
        </div>
      </div>
    </div>
  )
}
