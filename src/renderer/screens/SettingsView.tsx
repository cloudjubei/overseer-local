import { useState, useCallback } from 'react'
import { Button } from '../components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select'
import { Switch } from '../components/ui/Switch'
import { useLLMConfig } from '../contexts/LLMConfigContext'
import { useTheme, type Theme } from '../hooks/useTheme'
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar'
import { useNavigator } from '../navigation/Navigator'
import { useProjectSettings } from '../hooks/useProjectSettings'
import { useNotifications } from '../hooks/useNotifications'
import { IconEdit, IconDelete, IconPlus } from '../components/ui/Icons'
import {
  type ShortcutsModifier,
  type ShortcutsConfig,
  type AppSettings,
  DEFAULT_APP_SETTINGS,
} from '../../types/settings'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { dbService } from '../services/dbService'

// Settings Categories
const CATEGORIES = [
  { id: 'visual', label: 'Visual', icon: <span aria-hidden>🎨</span>, accent: 'purple' },
  { id: 'llms', label: 'LLMs', icon: <span aria-hidden>🤖</span>, accent: 'teal' },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <span aria-hidden>🔔</span>,
    accent: 'brand',
  },
  { id: 'github', label: 'GitHub', icon: <span aria-hidden>🐙</span>, accent: 'gray' },
  { id: 'websearch', label: 'Web Search', icon: <span aria-hidden>🔎</span>, accent: 'orange' },
  { id: 'database', label: 'Database', icon: <span aria-hidden>🗄️</span>, accent: 'indigo' },
]

type CategoryId = (typeof CATEGORIES)[number]['id']

export default function SettingsView() {
  const { availableThemes, theme, setTheme } = useTheme()
  const { appSettings, setNotificationSystemSettings, updateAppSettings, setUserPreferences } =
    useAppSettings()
  const { projectSettings, setNotificationProjectSettings } = useProjectSettings()
  const { enableNotifications } = useNotifications()

  const { configs, activeConfigId, removeConfig, setActive } = useLLMConfig()
  const { openModal } = useNavigator()

  // Layout state
  const [activeCategory, setActiveCategory] = useState<CategoryId>('visual')

  // DB local UI state
  const [isConnecting, setIsConnecting] = useState(false)
  const [isIngesting, setIsIngesting] = useState(false)
  const [dbMsg, setDbMsg] = useState<string | null>(null)

  // Helper: capture a combo from a keydown
  const captureCombo = useCallback((e: React.KeyboardEvent<HTMLInputElement>): string => {
    const parts: string[] = []
    if (e.metaKey || e.ctrlKey) parts.push('Mod')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')
    // Base key
    const key = e.key
    // Ignore modifier-only
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

  // Visual Settings content
  const renderVisualSection = () => (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Appearance</h2>
      <div className="space-y-2">
        <label htmlFor="theme" className="block text-sm font-medium">
          Theme
        </label>
        <select
          id="theme"
          value={theme}
          onChange={(e) => {
            setTheme(e.target.value as Theme)
          }}
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
        <label htmlFor="shortcuts-mod" className="block text-sm font-medium">
          Shortcuts modifier key
        </label>
        <select
          id="shortcuts-mod"
          value={appSettings.userPreferences.shortcutsModifier}
          onChange={async (e) =>
            await setUserPreferences({ shortcutsModifier: e.target.value as ShortcutsModifier })
          }
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
          Click a field and press the desired key combination. Mod maps to your selected modifier
          (Cmd on macOS, Ctrl on Windows/Linux).
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
          <Button onClick={resetShortcutsToDefault} variant="outline">
            Reset to defaults
          </Button>
        </div>
      </div>
    </div>
  )

  // LLMs list content
  const renderLLMsSection = () => (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">LLM Configurations</h2>
        <Button onClick={() => openModal({ type: 'llm-config-add' })}>
          <IconPlus />
        </Button>
      </div>
      <div className="border rounded-md divide-y">
        {configs.length === 0 && (
          <div className="p-4 text-sm text-gray-600">
            No configurations yet. Click "Add New Config" to create one.
          </div>
        )}
        {configs.map((cfg) => (
          <div
            key={cfg.id}
            className="p-3 flex flex-wrap gap-2 md:flex-nowrap md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">
                {cfg.name}{' '}
                {activeConfigId === cfg.id ? (
                  <span className="badge badge--soft badge--done">Active</span>
                ) : null}
              </div>
              <div className="text-sm text-gray-600 truncate">
                Provider: {cfg.provider} • Model: {cfg.model || '—'}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeConfigId !== cfg.id && (
                <Button onClick={() => setActive(cfg.id!)}>Set Active</Button>
              )}
              <Button
                onClick={() => openModal({ type: 'llm-config-edit', id: cfg.id! })}
                variant="outline"
              >
                <IconEdit className="w-4 h-4" />
              </Button>
              <Button onClick={() => removeConfig(cfg.id!)} variant="danger">
                <IconDelete className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[12px] text-[var(--text-secondary)] mt-2">
        Tip: Local providers must expose an OpenAI-compatible API. Use the Local preset to fill the
        default URL (http://localhost:1234/v1) and click "Load Available Models" to discover models.
      </div>
    </div>
  )

  const renderNotificationsSection = () => (
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
            {Object.entries(projectSettings.notifications.categoriesEnabled).map(
              ([category, enabled]) => (
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
              ),
            )}
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

  const renderGithubSection = () => (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">GitHub Credentials</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="gh-username" className="block text-sm font-medium mb-1">
            Username
          </label>
          <input
            id="gh-username"
            type="text"
            value={appSettings.github?.username ?? ''}
            onChange={(e) =>
              updateAppSettings({ github: { ...appSettings.github, username: e.target.value } })
            }
            className="w-full max-w-md p-2 border border-gray-300 rounded-md"
            placeholder="your-github-username"
            autoComplete="username"
          />
        </div>
        <div>
          <label htmlFor="gh-email" className="block text-sm font-medium mb-1">
            E-mail
          </label>
          <input
            id="gh-email"
            type="text"
            value={appSettings.github?.email ?? ''}
            onChange={(e) =>
              updateAppSettings({ github: { ...appSettings.github, email: e.target.value } })
            }
            className="w-full max-w-md p-2 border border-gray-300 rounded-md"
            placeholder="your-github-email"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="gh-token" className="block text-sm font-medium mb-1">
            Personal Access Token
          </label>
          <input
            id="gh-token"
            type="password"
            value={appSettings.github?.token ?? ''}
            onChange={(e) =>
              updateAppSettings({ github: { ...appSettings.github, token: e.target.value } })
            }
            className="w-full max-w-md p-2 border border-gray-300 rounded-md"
            placeholder="ghp_..."
            autoComplete="new-password"
          />
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">
            Token is stored locally in app settings.
          </p>
        </div>
      </div>
    </div>
  )

  const renderWebSearchSection = () => (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Web Search API Keys</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="exa-key" className="block text-sm font-medium mb-1">
            Exa API Key
          </label>
          <input
            id="exa-key"
            type="password"
            value={appSettings.webSearchApiKeys?.exa ?? ''}
            onChange={(e) =>
              updateAppSettings({
                webSearchApiKeys: { ...appSettings.webSearchApiKeys, exa: e.target.value },
              })
            }
            className="w-full max-w-md p-2 border border-gray-300 rounded-md"
            placeholder="exa_..."
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="serpapi-key" className="block text-sm font-medium mb-1">
            SerpAPI Key
          </label>
          <input
            id="serpapi-key"
            type="password"
            value={appSettings.webSearchApiKeys?.serpapi ?? ''}
            onChange={(e) =>
              updateAppSettings({
                webSearchApiKeys: { ...appSettings.webSearchApiKeys, serpapi: e.target.value },
              })
            }
            className="w-full max-w-md p-2 border border-gray-300 rounded-md"
            placeholder="your_serpapi_key"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="tavily-key" className="block text-sm font-medium mb-1">
            Tavily API Key
          </label>
          <input
            id="tavily-key"
            type="password"
            value={appSettings.webSearchApiKeys?.tavily ?? ''}
            onChange={(e) =>
              updateAppSettings({
                webSearchApiKeys: { ...appSettings.webSearchApiKeys, tavily: e.target.value },
              })
            }
            className="w-full max-w-md p-2 border border-gray-300 rounded-md"
            placeholder="tvly-..."
            autoComplete="off"
          />
        </div>
        <p className="text-[12px] text-[var(--text-secondary)] mt-1">
          Keys are stored locally in app settings.
        </p>
      </div>
    </div>
  )

  const renderDatabaseSection = () => {
    const currentConn = appSettings.database?.connectionString?.trim() || ''

    const onConnectAndIngest = async () => {
      if (!currentConn) return
      setDbMsg(null)
      setIsConnecting(true)
      try {
        const dbStatus = await dbService.connect(currentConn)
        if (!dbStatus?.connected) {
          setDbMsg('Failed to connect. Check your connection string and try again.')
          return
        }
        setDbMsg('Connected. Starting ingestion…')
        setIsIngesting(true)
        const res = await dbService.ingestAllProjects()
        setDbMsg('Ingestion complete.')
      } catch (e: any) {
        setDbMsg(String(e?.message || e))
      } finally {
        setIsConnecting(false)
        setIsIngesting(false)
      }
    }

    return (
      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold mb-3">Database</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="db-conn" className="block text-sm font-medium mb-1">
              thefactory-db Postgres connection string
            </label>
            <input
              id="db-conn"
              type="text"
              value={currentConn}
              onChange={(e) =>
                updateAppSettings({
                  database: { ...appSettings.database, connectionString: e.target.value },
                })
              }
              className="w-full max-w-xl p-2 border border-gray-300 rounded-md"
              placeholder="postgres://user:pass@host:5432/dbname"
              autoComplete="off"
            />
            <p className="text-[12px] text-[var(--text-secondary)] mt-1">
              Stored locally. Leave empty to use default environment configuration.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={onConnectAndIngest} disabled={!currentConn || isConnecting || isIngesting}>
                {isConnecting ? 'Connecting…' : isIngesting ? 'Ingesting…' : 'Connect & Ingest Now'}
              </Button>
              {dbMsg && (
                <span className="text-sm text-gray-600 dark:text-gray-300">{dbMsg}</span>
              )}
            </div>
            <p className="text-[12px] text-[var(--text-secondary)] mt-2">
              If you change the connection string later, run ingestion again to repopulate the database.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <CollapsibleSidebar
      items={CATEGORIES}
      activeId={activeCategory}
      onSelect={(c) => {
        setActiveCategory(c as CategoryId)
      }}
      storageKey="settings-panel-collapsed"
      headerTitle="Categories"
      headerSubtitle=""
    >
      {activeCategory === 'visual' && renderVisualSection()}
      {activeCategory === 'llms' && renderLLMsSection()}
      {activeCategory === 'notifications' && renderNotificationsSection()}
      {activeCategory === 'github' && renderGithubSection()}
      {activeCategory === 'websearch' && renderWebSearchSection()}
      {activeCategory === 'database' && renderDatabaseSection()}
    </CollapsibleSidebar>
  )
}
