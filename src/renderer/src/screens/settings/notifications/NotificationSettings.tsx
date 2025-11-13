import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select'
import { Switch } from '../../../components/ui/Switch'
import { useNotifications } from '../../../hooks/useNotifications'
import { useProjectSettings } from '../../../hooks/useProjectSettings'
import { useAppSettings } from '../../../contexts/AppSettingsContext'
import type { NotificationCategory } from 'src/types/notifications'

export default function NotificationSettings() {
  const { projectSettings, setNotificationProjectSettings } = useProjectSettings()
  const { appSettings, setNotificationSystemSettings } = useAppSettings()
  const { enableNotifications } = useNotifications()

  const categories: NotificationCategory[] = ['agent_runs', 'chat_messages', 'git_changes']

  const notifEnabled =
    projectSettings.notifications.notificationsEnabled || ({} as Record<NotificationCategory, boolean>)
  const badgeEnabled =
    projectSettings.notifications.badgesEnabled || ({} as Record<NotificationCategory, boolean>)

  const labelFor = (c: NotificationCategory): string => {
    switch (c) {
      case 'agent_runs':
        return 'Agent runs'
      case 'chat_messages':
        return 'Chat messages'
      case 'git_changes':
        return 'Git changes'
    }
  }

  return (
    <div className='max-w-3xl'>
      <h2 className='text-xl font-semibold mb-3'>Notification Preferences</h2>
      <div className='space-y-4'>
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
          label='Enable OS Notifications'
        />
        {/* Sidebar Notifications nav toggle removed by design */}

        <div className='space-y-2'>
          <h3 className='font-medium mb-2'>Create Notifications For</h3>
          <div className='space-y-2'>
            {categories.map((c) => (
              <Switch
                key={`notif-${c}`}
                checked={notifEnabled[c] !== false}
                onCheckedChange={(checked) =>
                  setNotificationProjectSettings({
                    notificationsEnabled: {
                      ...notifEnabled,
                      [c]: checked,
                    },
                  })
                }
                label={labelFor(c)}
              />
            ))}
          </div>
        </div>

        <div className='space-y-2'>
          <h3 className='font-medium mb-2'>Show Badges For</h3>
          <div className='space-y-2'>
            {categories.map((c) => (
              <Switch
                key={`badge-${c}`}
                checked={badgeEnabled[c] !== false}
                onCheckedChange={(checked) =>
                  setNotificationProjectSettings({
                    badgesEnabled: {
                      ...badgeEnabled,
                      [c]: checked,
                    },
                  })
                }
                label={labelFor(c)}
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
          label='Enable Notification Sounds'
        />
        <div>
          <label className='block text-sm font-medium mb-1'>Notification Display Duration</label>
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
              <SelectValue placeholder='Select duration' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='3'>3 seconds</SelectItem>
              <SelectItem value='5'>5 seconds</SelectItem>
              <SelectItem value='10'>10 seconds</SelectItem>
              <SelectItem value='0'>Persistent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
