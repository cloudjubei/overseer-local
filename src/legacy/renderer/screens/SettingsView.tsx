import { useEffect, useState } from 'react'
import { CollapsibleSidebar } from 'thefactory-ui/web'
import { useNavigator } from '../navigation/Navigator'

// Subviews
import VisualSettings from './settings/visual/VisualSettings'
import LLMSettings from './settings/llms/LLMSettings'
import NotificationSettings from './settings/notifications/NotificationSettings'
import GitHubSettings from './settings/github/GitHubSettings'
import WebSearchSettings from './settings/websearch/WebSearchSettings'
import DatabaseSettings from './settings/database/DatabaseSettings'
import {
  IconBell,
  IconCpu,
  IconDatabase,
  IconGitHub,
  IconPalette,
  IconRobot,
  IconSearch,
} from 'thefactory-ui/web/icons'

import DeveloperSettings from './settings/developer/DeveloperSettings'

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
]

type CategoryId = (typeof CATEGORIES)[number]['id']

function isCategory(value: string | undefined): value is CategoryId {
  return (
    !!value && (CATEGORIES as ReadonlyArray<{ id: string }>).some((c) => c.id === value)
  )
}

export default function SettingsView() {
  const { settingsTab } = useNavigator()
  const [activeCategory, setActiveCategory] = useState<CategoryId>(() =>
    isCategory(settingsTab) ? settingsTab : 'visual',
  )

  useEffect(() => {
    if (isCategory(settingsTab) && settingsTab !== activeCategory) {
      setActiveCategory(settingsTab)
    }
  }, [settingsTab, activeCategory])

  return (
    <CollapsibleSidebar
      items={CATEGORIES}
      activeId={activeCategory}
      onSelect={(c) => setActiveCategory(c as CategoryId)}
      storageKey="settings-panel-collapsed"
      headerSubtitle=""
    >
      {activeCategory === 'llms' ? (
        <div className="h-full w-full min-h-0 overflow-hidden">
          <LLMSettings />
        </div>
      ) : (
        <div className="h-full min-h-0 overflow-y-auto p-4">
          {activeCategory === 'visual' && <VisualSettings />}
          {activeCategory === 'notifications' && <NotificationSettings />}
          {activeCategory === 'github' && <GitHubSettings />}
          {activeCategory === 'websearch' && <WebSearchSettings />}
          {activeCategory === 'database' && <DatabaseSettings />}
          {activeCategory === 'developer' && <DeveloperSettings />}
        </div>
      )}
    </CollapsibleSidebar>
  )
}
