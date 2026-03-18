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
import type { BadgeColor } from 'src/types/settings'

export default function NotificationSettings() {
  const { projectSettings, setNotificationProjectSettings } = useProjectSettings()
  const { appSettings, setNotificationSystemSettings } = useAppSettings()
  const { enableNotifications } = useNotifications()

  const categories: NotificationCategory[] = ['agent_runs', 'chat_messages', 'git_changes']
  const badgeColors: BadgeColor[] = ['red', 'blue', 'green', 'orange']

  const notifEnabled =
    projectSettings.notifications.notificationsEnabled || ({} as Record<NotificationCategory, boolean>)
  const badgeEnabled =
    projectSettings.notifications.badgesEnabled || ({} as Record<NotificationCategory, boolean>)
  const colors =
    projectSettings.notifications.badgeColors || ({} as Record<NotificationCategory, BadgeColor>)
  const chatBadgeCountMode = projectSettings.notifications.chatBadgeCountMode || 'chats_with_unread'

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
              <div key={`badge-container-${c}`} className='flex items-center justify-between'>
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
                
                {badgeEnabled[c] !== false && (
                  <div className='w-32'>
                    <Select
                      value={colors[c] || 'blue'}
                      onValueChange={(value) =>
                        setNotificationProjectSettings({
                          badgeColors: {
                            ...colors,
                            [c]: value as BadgeColor,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select color' />
                      </SelectTrigger>
                      <SelectContent>
                        {badgeColors.map((color) => (
                          <SelectItem key={color} value={color}>
                            <div className='flex items-center gap-2'>
                              <div
                                className='w-3 h-3 rounded-full'
                                style={{ backgroundColor: color }}
                              />
                              <span className='capitalize'>{color}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className='space-y-2 pt-2 border-t border-border'>
          <h3 className='font-medium mb-2'>Chat Badge Counting Mode</h3>
          <Select
            value={chatBadgeCountMode}
            onValueChange={(value) =>
              setNotificationProjectSettings({
                chatBadgeCountMode: value as 'total_messages' | 'chats_with_unread',
              })
            }
          >
            <SelectTrigger className='w-64'>
              <SelectValue placeholder='Select mode' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='chats_with_unread'>Chats with unread messages</SelectItem>
              <SelectItem value='total_messages'>Total unread messages</SelectItem>
            </SelectContent>
          </Select>
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
            <SelectTrigger className='w-64'>
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
