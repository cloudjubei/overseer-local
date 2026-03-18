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

  const globalNotifEnabled =
    appSettings.notificationSystemSettings.notificationsEnabled || ({} as Record<NotificationCategory, boolean>)
  const globalBadgeEnabled =
    appSettings.notificationSystemSettings.badgesEnabled || ({} as Record<NotificationCategory, boolean>)
  const globalColors =
    appSettings.notificationSystemSettings.badgeColors || ({} as Record<NotificationCategory, BadgeColor>)
  const globalChatBadgeCountMode = appSettings.notificationSystemSettings.chatBadgeCountMode || 'chats_with_unread'
  const globalGitBadgeSubToggles = appSettings.notificationSystemSettings.gitBadgeSubToggles || { incoming_commits: true, uncommitted_changes: true }

  const projectNotifEnabled =
    projectSettings.notifications.notificationsEnabled || ({} as Record<NotificationCategory, boolean>)

  const allProjectNotificationsEnabled = categories.every(c => projectNotifEnabled[c] !== false)

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
    <div className='max-w-3xl pb-16'>
      <h2 className='text-xl font-semibold mb-3'>App Notification Preferences</h2>
      <div className='space-y-4 pb-4 border-b border-border mb-4'>
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

        <div className='space-y-2'>
          <h3 className='font-medium mb-2'>Globally Enable Notifications For</h3>
          <div className='space-y-2'>
            {categories.map((c) => (
              <Switch
                key={`global-notif-${c}`}
                checked={globalNotifEnabled[c] !== false}
                onCheckedChange={(checked) =>
                  setNotificationSystemSettings({
                    notificationsEnabled: {
                      ...globalNotifEnabled,
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
          <h3 className='font-medium mb-2'>Globally Show Badges For</h3>
          <div className='space-y-2'>
            {categories.map((c) => (
              <div key={`global-badge-container-${c}`} className='flex items-center justify-between'>
                <Switch
                  key={`global-badge-${c}`}
                  checked={globalBadgeEnabled[c] !== false}
                  onCheckedChange={(checked) =>
                    setNotificationSystemSettings({
                      badgesEnabled: {
                        ...globalBadgeEnabled,
                        [c]: checked,
                      },
                    })
                  }
                  label={labelFor(c)}
                />
                
                {globalBadgeEnabled[c] !== false && (
                  <div className='w-32'>
                    <Select
                      value={globalColors[c] || 'blue'}
                      onValueChange={(value) =>
                        setNotificationSystemSettings({
                          badgeColors: {
                            ...globalColors,
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

        {globalBadgeEnabled['git_changes'] !== false && (
           <div className='space-y-2 pt-2 border-t border-border'>
              <h3 className='font-medium mb-2'>Git Badges Config</h3>
              <div className='space-y-2 pl-2'>
                <Switch
                  checked={globalGitBadgeSubToggles.incoming_commits !== false}
                  onCheckedChange={(checked) =>
                    setNotificationSystemSettings({
                      gitBadgeSubToggles: {
                        ...globalGitBadgeSubToggles,
                        incoming_commits: checked,
                      },
                    })
                  }
                  label='Incoming Commits'
                />
                <Switch
                  checked={globalGitBadgeSubToggles.uncommitted_changes !== false}
                  onCheckedChange={(checked) =>
                    setNotificationSystemSettings({
                      gitBadgeSubToggles: {
                        ...globalGitBadgeSubToggles,
                        uncommitted_changes: checked,
                      },
                    })
                  }
                  label='Uncommitted Changes'
                />
              </div>
           </div>
        )}

        <div className='space-y-2 pt-2 border-t border-border'>
          <h3 className='font-medium mb-2'>Chat Badge Counting Mode</h3>
          <Select
            value={globalChatBadgeCountMode}
            onValueChange={(value) =>
              setNotificationSystemSettings({
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

        <div className='pt-2 border-t border-border'>
          <Switch
            checked={appSettings.notificationSystemSettings.soundsEnabled}
            onCheckedChange={(checked) =>
              setNotificationSystemSettings({
                soundsEnabled: checked,
              })
            }
            label='Enable Notification Sounds'
          />
        </div>
        <div>
          <label className='block text-sm font-medium mb-1'>Notification Display Duration</label>
          <Select
            value={appSettings.notificationSystemSettings.displayDuration.toString()}
            onValueChange={(value) =>
              setNotificationSystemSettings({
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

      <h2 className='text-xl font-semibold mb-3'>Current Project Notifications</h2>
      <div className='space-y-4'>
        <div className='space-y-2'>
          <Switch
            checked={allProjectNotificationsEnabled}
            onCheckedChange={(checked) => {
              const newState = {} as Record<NotificationCategory, boolean>
              categories.forEach(c => {
                newState[c] = checked
              })
              setNotificationProjectSettings({
                notificationsEnabled: newState
              })
            }}
            label='Enable all notifications for this project'
          />
          <div className='space-y-2 mt-4 ml-6 border-l-2 border-border pl-4'>
            {categories.map((c) => (
              <Switch
                key={`project-notif-${c}`}
                checked={projectNotifEnabled[c] !== false}
                onCheckedChange={(checked) =>
                  setNotificationProjectSettings({
                    notificationsEnabled: {
                      ...projectNotifEnabled,
                      [c]: checked,
                    },
                  })
                }
                label={labelFor(c)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}