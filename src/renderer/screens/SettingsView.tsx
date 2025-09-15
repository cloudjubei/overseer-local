import { useState } from 'react'
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar'

// Subviews
import VisualSettings from './settings/visual/VisualSettings'
import LLMSettings from './settings/llms/LLMSettings'
import NotificationSettings from './settings/notifications/NotificationSettings'
import GitHubSettings from './settings/github/GitHubSettings'
import WebSearchSettings from './settings/websearch/WebSearchSettings'
import DatabaseSettings from './settings/database/DatabaseSettings'

// Settings Categories
const CATEGORIES = [
  { id: 'visual', label: 'Visual', icon: <span aria-hidden>🎨</span>, accent: 'purple' },
  { id: 'llms', label: 'LLMs', icon: <span aria-hidden>🤖</span>, accent: 'teal' },
  { id: 'notifications', label: 'Notifications', icon: <span aria-hidden>🔔</span>, accent: 'brand' },
  { id: 'github', label: 'GitHub', icon: <span aria-hidden>🐙</span>, accent: 'gray' },
  { id: 'websearch', label: 'Web Search', icon: <span aria-hidden>🔎</span>, accent: 'orange' },
  { id: 'database', label: 'Database', icon: <span aria-hidden>🗄️</span>, accent: 'indigo' },
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
