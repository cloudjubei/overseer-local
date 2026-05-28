import { useAppSettings } from '@core/contexts/AppSettingsContext'
import { useActiveProject } from 'thefactory-ui/headless'
import { useProjectSettings } from '@core/hooks/useProjectSettings'
import type { BadgeColor, NotificationCategory, NotificationPrefs } from '@core/types/settings'
import { BADGE_COLORS, isBadgeColorCategory } from '@core/types/settings'
import {
  Alert,
  Button,
  NativeSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  playBeep,
} from 'thefactory-ui/web'
import { useWebNotifications } from '@ui/hooks/useWebNotifications'

const DURATIONS: NotificationPrefs['displayDurationSeconds'][] = [3, 5, 10, 0]

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  chat: 'Chat messages',
  tests: 'Test runs',
  git: 'Git changes',
  agent_runs: 'Agent runs',
}

const BADGE_COLOR_HEX: Record<BadgeColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
}

export default function NotificationSettings() {
  const { settings, setNotifications } = useAppSettings()
  const { permission, request } = useWebNotifications()
  const { projectId, project } = useActiveProject()
  const { settings: projectSettings, setNotificationCategory } = useProjectSettings(projectId)
  const prefs = settings.notifications

  const categories = Object.keys(prefs.categories) as NotificationCategory[]

  const allProjectNotificationsEnabled = categories.every((c) => {
    const override = projectSettings.notifications.categories[c]
    return override === undefined ? prefs.categories[c] : override
  })

  const onToggleOs = async (next: boolean) => {
    if (!next) {
      setNotifications({ osNotificationsEnabled: false })
      return
    }
    const result = permission === 'granted' ? 'granted' : await request()
    setNotifications({ osNotificationsEnabled: result === 'granted' })
  }

  return (
    <div className="max-w-3xl pb-16">
      <h2 className="text-xl font-semibold mb-3">App Notification Preferences</h2>
      <div className="space-y-4 pb-4 border-b border-(--border-subtle) mb-4">
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
          onCheckedChange={(checked) => void onToggleOs(checked)}
          label="Enable OS Notifications"
        />

        <div className="space-y-2">
          <h3 className="font-medium mb-2">Globally Enable Notifications For</h3>
          <div className="space-y-2">
            {categories.map((c) => (
              <Switch
                key={`global-notif-${c}`}
                checked={prefs.categories[c]}
                onCheckedChange={(checked) =>
                  setNotifications({
                    categories: { ...prefs.categories, [c]: checked },
                  })
                }
                label={CATEGORY_LABEL[c]}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-medium mb-2">Globally Show Badges For</h3>
          <div className="space-y-2">
            {categories.map((c) => (
              <div
                key={`global-badge-container-${c}`}
                className="flex items-center justify-between"
              >
                <Switch
                  key={`global-badge-${c}`}
                  checked={prefs.badgesEnabled[c]}
                  onCheckedChange={(checked) =>
                    setNotifications({
                      badgesEnabled: { ...prefs.badgesEnabled, [c]: checked },
                    })
                  }
                  label={CATEGORY_LABEL[c]}
                />
                {prefs.badgesEnabled[c] && isBadgeColorCategory(c) && (
                  <div className="w-32">
                    <Select
                      value={prefs.badgeColors[c]}
                      onValueChange={(value) =>
                        setNotifications({
                          badgeColors: {
                            ...prefs.badgeColors,
                            [c]: value as BadgeColor,
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select color" />
                      </SelectTrigger>
                      <SelectContent>
                        {BADGE_COLORS.map((color) => (
                          <SelectItem key={color} value={color}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: BADGE_COLOR_HEX[color] }}
                              />
                              <span className="capitalize">{color}</span>
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

        {prefs.badgesEnabled.git && (
          <div className="space-y-2 pt-2 border-t border-(--border-subtle)">
            <h3 className="font-medium mb-2">Git Badges Config</h3>
            <div className="space-y-2 pl-2">
              <Switch
                checked={prefs.gitBadgeSubToggles.incoming_commits}
                onCheckedChange={(checked) =>
                  setNotifications({
                    gitBadgeSubToggles: {
                      ...prefs.gitBadgeSubToggles,
                      incoming_commits: checked,
                    },
                  })
                }
                label="Incoming Commits"
              />
              <Switch
                checked={prefs.gitBadgeSubToggles.uncommitted_changes}
                onCheckedChange={(checked) =>
                  setNotifications({
                    gitBadgeSubToggles: {
                      ...prefs.gitBadgeSubToggles,
                      uncommitted_changes: checked,
                    },
                  })
                }
                label="Uncommitted Changes"
              />
            </div>
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-(--border-subtle)">
          <h3 className="font-medium mb-2">Chat Badge Counting Mode</h3>
          <Select
            value={prefs.chatBadgeCountMode}
            onValueChange={(value) =>
              setNotifications({
                chatBadgeCountMode: value as NotificationPrefs['chatBadgeCountMode'],
              })
            }
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chats_with_unread">Chats with unread messages</SelectItem>
              <SelectItem value="total_messages">Total unread messages</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2 border-t border-(--border-subtle)">
          <div className="flex items-center justify-between gap-3">
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
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notification Display Duration</label>
          <NativeSelect
            value={String(prefs.displayDurationSeconds)}
            onChange={(e) =>
              setNotifications({
                displayDurationSeconds: Number(
                  e.target.value,
                ) as NotificationPrefs['displayDurationSeconds'],
              })
            }
            className="w-64"
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d === 0 ? 'Persistent' : `${d} seconds`}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {projectId && (
        <>
          <h2 className="text-xl font-semibold mb-3">
            Current Project Notifications
            {project?.title ? (
              <span className="text-(--text-muted) font-normal"> — {project.title}</span>
            ) : null}
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Switch
                checked={allProjectNotificationsEnabled}
                onCheckedChange={(checked) => {
                  for (const c of categories) setNotificationCategory(c, checked)
                }}
                label="Enable all notifications for this project"
              />
              <div className="space-y-2 mt-4 ml-6 border-l-2 border-(--border-subtle) pl-4">
                {categories.map((c) => {
                  const override = projectSettings.notifications.categories[c]
                  const effective = override === undefined ? prefs.categories[c] : override
                  return (
                    <Switch
                      key={`project-notif-${c}`}
                      checked={effective}
                      onCheckedChange={(checked) => setNotificationCategory(c, checked)}
                      label={CATEGORY_LABEL[c]}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
