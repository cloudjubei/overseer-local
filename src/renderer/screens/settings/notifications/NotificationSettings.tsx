import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select'
import { Switch } from '../../components/ui/Switch'
import { useNotifications } from '../../hooks/useNotifications'
import { useProjectSettings } from '../../hooks/useProjectSettings'
import { useAppSettings } from '../../contexts/AppSettingsContext'

export default function NotificationSettings() {
  const { projectSettings, setNotificationProjectSettings } = useProjectSettings()
  const { appSettings, setNotificationSystemSettings } = useAppSettings()
  const { enableNotifications } = useNotifications()

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Notification Preferences</h2>
      <div className="space-y-4">
        <Switch
          checked={appSettings.notificationSystemSettings.osNotificationsEnabled}
          onCheckedChange={async (checked) => {
            if (checked) {
              const success = await enableNotifications()
              if (success) {
                setNotificationSystemSettings({ osNotificationsEnabled: true })
              } else {
                setNotificationSystemSettings({ osNotificationsEnabled: false })
              }
            } else {
              setNotificationSystemSettings({ osNotificationsEnabled: false })
            }
          }}
          label="Enable OS Notifications"
        />
        <div>
          <h3 className="font-medium mb-2">Notification Categories</h3>
          <div className="space-y-2">
            {Object.entries(projectSettings.notifications.categoriesEnabled).map(([category, enabled]) => (
              <Switch
                key={category}
                checked={enabled ?? true}
                onCheckedChange={(checked) =>
                  setNotificationProjectSettings({
                    categoriesEnabled: {
                      ...projectSettings.notifications.categoriesEnabled,
                      [category]: checked,
                    },
                  })
                }
                label={category.charAt(0).toUpperCase() + category.slice(1)}
              />
            ))}
          </div>
        </div>
        <Switch
          checked={appSettings.notificationSystemSettings.soundsEnabled}
          onCheckedChange={(checked) =>
            setNotificationSystemSettings({
              ...appSettings.notificationSystemSettings,
              soundsEnabled: checked,
            })
          }
          label="Enable Notification Sounds"
        />
        <div>
          <label className="block text-sm font-medium mb-1">Notification Display Duration</label>
          <Select
            value={appSettings.notificationSystemSettings.displayDuration.toString()}
            onValueChange={(value) =>
              setNotificationSystemSettings({
                ...appSettings.notificationSystemSettings,
                displayDuration: parseInt(value),
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 seconds</SelectItem>
              <SelectItem value="5">5 seconds</SelectItem>
              <SelectItem value="10">10 seconds</SelectItem>
              <SelectItem value="0">Persistent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
