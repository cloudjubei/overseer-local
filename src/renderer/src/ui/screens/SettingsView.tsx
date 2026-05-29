import { useSearchParams } from 'react-router-dom'
import { CollapsibleSidebar } from 'thefactory-ui/web'

// Subviews
import { VisualSettings } from 'thefactory-ui/web'
import LLMSettings from '@ui/components/settings/LLMSettings'
import NotificationSettings from '@ui/components/settings/NotificationSettings'
import { GitHubSettings } from "thefactory-ui/web"
import { WebSearchSettings } from "thefactory-ui/web"
import { DatabaseSettings } from "thefactory-ui/web"
import {
  IconBell,
  IconCpu,
  IconDatabase,
  IconGitHub,
  IconPalette,
  IconRobot,
  IconSearch,
} from 'thefactory-ui/web/icons'

import DeveloperSettings from '@ui/components/settings/DeveloperSettings'

// Settings Categories
const CATEGORIES = [
  { id: 'visual', label: 'Visual', icon: <IconPalette className="h-4 w-4" />, accent: 'purple' },
  { id: 'llms', label: 'LLMs', icon: <IconRobot className="h-4 w-4" />, accent: 'teal' },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <IconBell className="h-4 w-4" />,
    accent: 'brand',
  },
  { id: 'github', label: 'GitHub', icon: <IconGitHub className="h-4 w-4" />, accent: 'gray' },
  {
    id: 'websearch',
    label: 'Web Search',
    icon: <IconSearch className="h-4 w-4" />,
    accent: 'orange',
  },
  {
    id: 'database',
    label: 'Database',
    icon: <IconDatabase className="h-4 w-4" />,
    accent: 'indigo',
  },
  {
    id: 'developer',
    label: 'Developer',
    icon: <IconCpu className="h-4 w-4" />,
    accent: 'gray',
  },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

function isCategory(value: string | null): value is CategoryId {
  return value !== null && (CATEGORIES as ReadonlyArray<{ id: string }>).some((c) => c.id === value)
}

export default function SettingsView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryTab = searchParams.get('tab')
  // The URL is the single source of truth — no local state to avoid the brief
  // "wrong tab visible" flash that happens when local state and the URL update
  // on different ticks.
  const activeCategory: CategoryId = isCategory(queryTab) ? queryTab : 'visual'

  const onSelect = (next: string) => {
    if (!isCategory(next) || next === activeCategory) return
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <CollapsibleSidebar
      items={CATEGORIES.slice()}
      activeId={activeCategory}
      onSelect={onSelect}
      storageKey="settings-panel-collapsed"
      headerSubtitle=""
    >
      {/* `llms` and `developer` get edge-to-edge wrappers — both can swap
          into a fill-the-pane subview (LLM playground, overseer Git view)
          where a `p-4` outer margin would clip the embedded UI. Each
          category applies its own padding when it actually wants it. */}
      {activeCategory === 'llms' ? (
        <div className="h-full w-full min-h-0 overflow-hidden">
          <LLMSettings />
        </div>
      ) : activeCategory === 'developer' ? (
        <div className="h-full w-full min-h-0 overflow-hidden">
          <DeveloperSettings />
        </div>
      ) : (
        <div className="h-full min-h-0 overflow-y-auto p-4">
          {activeCategory === 'visual' && <VisualSettings />}
          {activeCategory === 'notifications' && <NotificationSettings />}
          {activeCategory === 'github' && (
            // Electron renderer can't redirect cleanly (file:// host) — use
            // the device flow only. window.open is trapped by the main
            // process's setWindowOpenHandler, which routes to
            // shell.openExternal, so the default openExternalUrl works.
            <GitHubSettings hostCapabilities={{ canRedirect: false, canOpenBrowser: true }} />
          )}
          {activeCategory === 'websearch' && <WebSearchSettings />}
          {activeCategory === 'database' && <DatabaseSettings />}
        </div>
      )}
    </CollapsibleSidebar>
  )
}
