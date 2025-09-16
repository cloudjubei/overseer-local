import { useState } from 'react'
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar'

// Subviews
import VisualSettings from './settings/visual/VisualSettings'
import LLMSettings from './settings/llms/LLMSettings'
import NotificationSettings from './settings/notifications/NotificationSettings'
import GitHubSettings from './settings/github/GitHubSettings'
import WebSearchSettings from './settings/websearch/WebSearchSettings'
import DatabaseSettings from './settings/database/DatabaseSettings'
import { IconPalette, IconRobot, IconBell, IconGitHub, IconSearch, IconDatabase } from '../components/ui/Icons'

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
  { id: 'websearch', label: 'Web Search', icon: <IconSearch className="h-4 w-4" />, accent: 'orange' },
  { id: 'database', label: 'Database', icon: <IconDatabase className="h-4 w-4" />, accent: 'indigo' },
]

type CategoryId = (typeof CATEGORIES)[number]['id']

export default function SettingsView() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('visual')

  return (
    <CollapsibleSidebar
      items={CATEGORIES}
      activeId={activeCategory}
      onSelect={(c) => setActiveCategory(c as CategoryId)}
      storageKey="settings-panel-collapsed"
      headerTitle="Categories"
      headerSubtitle=""
    >
      {activeCategory === 'visual' && <VisualSettings />}
      {activeCategory === 'llms' && <LLMSettings />}
      {activeCategory === 'notifications' && <NotificationSettings />}
      {activeCategory === 'github' && <GitHubSettings />}
      {activeCategory === 'websearch' && <WebSearchSettings />}
      {activeCategory === 'database' && <DatabaseSettings />}
    </CollapsibleSidebar>
  )
}
