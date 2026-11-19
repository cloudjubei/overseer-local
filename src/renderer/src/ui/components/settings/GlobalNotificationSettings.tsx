import { useState } from 'react'
import {
  BADGE_COLORS,
  isBadgeColorCategory,
  useAppSettings,
  type BadgeColor,
  type NotificationCategory,
  type NotificationPermissionState,
  type NotificationPrefs,
} from 'thefactory-ui/headless'
import {
  Alert,
  Button,
  ChatNotifySettings,
  NativeSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  getNotificationBadgeColorClass,
  playBeep,
} from 'thefactory-ui/web'

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  chat: 'Chat messages',
  tests: 'Test runs',
  git: 'Git changes',
  activity: 'App activity',
  'cross-project': 'Cross-project requests',
  processes: 'Processes',
  storage: 'Storage usage',
}
const DURATIONS = [3, 5, 10, 0] as const
const GIT_BADGE_LABELS = [
  ['incoming_commits', 'Incoming Commits'],
  ['uncommitted_changes', 'Uncommitted Changes'],
] as const

// The shared NotificationSettings binds overrides to the active project.
// Global Settings must not mount those controls or their data hooks.
export default function GlobalNotificationSettings(): React.JSX.Element {
  const { settings, setNotifications } = useAppSettings()
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const prefs = settings.notifications
  const categories = Object.keys(prefs.categories) as NotificationCategory[]

  const toggleOsNotifications = async (enabled: boolean): Promise<void> => {
    if (!enabled) {
      setNotifications({ osNotificationsEnabled: false })
      return
    }
    if (typeof Notification === 'undefined') return
    const next =
      Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    setPermission(next)
    setNotifications({ osNotificationsEnabled: next === 'granted' })
  }

  return (
    <section className="max-w-3xl space-y-4 border-b border-(--border-subtle) pb-4">
      <h2 className="text-xl font-semibold">App Notification Preferences</h2>
      {permission === 'unsupported' && (
        <Alert>This browser does not support the Web Notifications API.</Alert>
      )}
      {permission === 'denied' && (
        <Alert>
          OS notifications are blocked at the browser level. Update site permissions to re-enable.
        </Alert>
      )}
      <Switch
        checked={prefs.osNotificationsEnabled && permission === 'granted'}
        disabled={permission === 'unsupported' || permission === 'denied'}
        onCheckedChange={(enabled) => void toggleOsNotifications(enabled)}
        label="Enable OS Notifications"
      />
      <div className="space-y-2">
        <h3 className="font-medium">Globally Enable Notifications For</h3>
        {categories.map((category) => (
          <Switch
            key={category}
            checked={prefs.categories[category]}
            onCheckedChange={(checked) =>
              setNotifications({ categories: { ...prefs.categories, [category]: checked } })
            }
            label={CATEGORY_LABELS[category]}
          />
        ))}
      </div>
      <div className="space-y-2">
        <h3 className="font-medium">Globally Show Badges For</h3>
        {categories.map((category) => (
          <div key={category} className="flex items-center justify-between">
            <Switch
              checked={prefs.badgesEnabled[category]}
              onCheckedChange={(checked) =>
                setNotifications({ badgesEnabled: { ...prefs.badgesEnabled, [category]: checked } })
              }
              label={CATEGORY_LABELS[category]}
            />
            {prefs.badgesEnabled[category] && isBadgeColorCategory(category) && (
              <Select
                value={prefs.badgeColors[category]}
                onValueChange={(color) =>
                  setNotifications({
                    badgeColors: { ...prefs.badgeColors, [category]: color as BadgeColor },
                  })
                }
              >
                <SelectTrigger
                  className="w-32"
                  aria-label={`${CATEGORY_LABELS[category]} badge color`}
                >
                  <SelectValue placeholder="Select color" />
                </SelectTrigger>
                <SelectContent>
                  {BADGE_COLORS.map((color) => (
                    <SelectItem key={color} value={color}>
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-3 w-3 rounded-full ${getNotificationBadgeColorClass(color)}`}
                        />
                        <span className="capitalize">{color}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
      {prefs.badgesEnabled.git && (
        <div className="space-y-2 border-t border-(--border-subtle) pt-2">
          <h3 className="font-medium">Git Badges Config</h3>
          <div className="space-y-2 pl-2">
            {GIT_BADGE_LABELS.map(([key, label]) => (
              <Switch
                key={key}
                checked={prefs.gitBadgeSubToggles[key]}
                onCheckedChange={(checked) =>
                  setNotifications({
                    gitBadgeSubToggles: { ...prefs.gitBadgeSubToggles, [key]: checked },
                  })
                }
                label={label}
              />
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-(--border-subtle) pt-2">
        <ChatNotifySettings />
      </div>
      <div className="space-y-2 border-t border-(--border-subtle) pt-2">
        <h3 className="font-medium">Chat Badge Counting Mode</h3>
        <Select
          value={prefs.chatBadgeCountMode}
          onValueChange={(value) =>
            setNotifications({
              chatBadgeCountMode: value as NotificationPrefs['chatBadgeCountMode'],
            })
          }
        >
          <SelectTrigger className="w-64" aria-label="Chat Badge Counting Mode">
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chats_with_unread">Chats with unread messages</SelectItem>
            <SelectItem value="total_messages">Total unread messages</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-(--border-subtle) pt-2">
        <Switch
          checked={prefs.soundsEnabled}
          onCheckedChange={(checked) => setNotifications({ soundsEnabled: checked })}
          label="Enable Notification Sounds"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => playBeep()}
          disabled={!prefs.soundsEnabled}
        >
          Test
        </Button>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Notification Display Duration
        <NativeSelect
          value={String(prefs.displayDurationSeconds)}
          onChange={(event) => {
            const duration = DURATIONS.find((value) => String(value) === event.target.value)
            if (duration !== undefined) setNotifications({ displayDurationSeconds: duration })
          }}
          className="w-64"
        >
          {DURATIONS.map((duration) => (
            <option key={duration} value={duration}>
              {duration === 0 ? 'Persistent' : `${duration} seconds`}
            </option>
          ))}
        </NativeSelect>
      </label>
    </section>
  )
}
