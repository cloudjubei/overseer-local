import { useSearchParams } from 'react-router-dom'
import { CollapsibleSidebar } from 'thefactory-ui/web'

// Subviews
import { VisualSettings } from 'thefactory-ui/web'
import LLMSettings from '@ui/components/settings/LLMSettings'
import { NotificationSettings } from 'thefactory-ui/web'
import { CrossProjectSettings } from 'thefactory-ui/web'
import { GitCredentialsSettings } from 'thefactory-ui/web'
import { WebSearchSettings } from 'thefactory-ui/web'
import { DatabaseSettings } from 'thefactory-ui/web'
import { ProviderConnectionsSettings } from 'thefactory-ui/web'
import { ProcessesView } from 'thefactory-ui/web'
import { GroupTicketSettings, ProjectTicketSettings } from 'thefactory-ui/web'
import {
  IconBell,
  IconBoard,
  IconCpu,
  IconDatabase,
  IconFolder,
  IconFolderOpen,
  IconGitHub,
  IconList,
  IconPalette,
  IconRobot,
  IconSearch,
  IconWorkflow,
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
  {
    id: 'cross-project',
    label: 'Cross-project',
    icon: <IconList className="h-4 w-4" />,
    accent: 'blue',
  },
  { id: 'github', label: 'Git', icon: <IconGitHub className="h-4 w-4" />, accent: 'gray' },
  { id: 'tickets', label: 'Tickets', icon: <IconBoard className="h-4 w-4" />, accent: 'blue' },
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
    id: 'processes',
    label: 'Processes',
    icon: <IconWorkflow className="h-4 w-4" />,
    accent: 'green',
  },
  {
    id: 'developer',
    label: 'Developer',
    icon: <IconCpu className="h-4 w-4" />,
    accent: 'gray',
  },
] as const

/** Whose Settings these are: the project or group the user opened them from. */
export type SettingsScope =
  | { kind: 'project'; projectId: string }
  | { kind: 'group'; groupId: string }

/** The scope's own section, listed first: what belongs to this project or group alone. */
const SCOPE_CATEGORIES = {
  project: {
    id: 'project',
    label: 'Project',
    icon: <IconFolder className="h-4 w-4" />,
    accent: 'brand',
  },
  group: {
    id: 'group',
    label: 'Group',
    icon: <IconFolderOpen className="h-4 w-4" />,
    accent: 'brand',
  },
} as const

type CategoryId = (typeof CATEGORIES)[number]['id'] | 'project' | 'group'

export default function SettingsView({ scope }: { scope: SettingsScope }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryTab = searchParams.get('tab')
  const scopeCategory = SCOPE_CATEGORIES[scope.kind]
  const categories = [scopeCategory, ...CATEGORIES]
  const isCategory = (value: string | null): value is CategoryId =>
    value !== null && categories.some((c) => c.id === value)
  // The URL is the single source of truth — no local state to avoid the brief
  // "wrong tab visible" flash that happens when local state and the URL update
  // on different ticks. Opens on the project's or group's own section.
  const activeCategory: CategoryId = isCategory(queryTab) ? queryTab : scopeCategory.id

  const onSelect = (next: string) => {
    if (!isCategory(next) || next === activeCategory) return
    const params = new URLSearchParams(searchParams)
    params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <CollapsibleSidebar
      items={categories}
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
      ) : activeCategory === 'processes' ? (
        // The blueprint library is its own two-pane master/detail, so it wants
        // the full pane rather than the padded column the simple panels use.
        <div className="h-full w-full min-h-0 overflow-hidden">
          <ProcessesView />
        </div>
      ) : (
        <div className="h-full min-h-0 overflow-y-auto p-4">
          {activeCategory === 'project' && scope.kind === 'project' && (
            <ProjectTicketSettings projectId={scope.projectId} />
          )}
          {activeCategory === 'group' && scope.kind === 'group' && (
            <GroupTicketSettings groupId={scope.groupId} />
          )}
          {activeCategory === 'visual' && <VisualSettings />}
          {activeCategory === 'notifications' && <NotificationSettings />}
          {activeCategory === 'cross-project' && <CrossProjectSettings />}
          {activeCategory === 'github' && (
            // Electron renderer can't redirect cleanly (file:// host) — use
            // the device flow only. window.open is trapped by the main
            // process's setWindowOpenHandler, which routes to
            // shell.openExternal, so the default openExternalUrl works.
            <GitCredentialsSettings
              hostCapabilities={{ canRedirect: false, canOpenBrowser: true }}
            />
          )}
          {activeCategory === 'tickets' && <ProviderConnectionsSettings />}
          {activeCategory === 'websearch' && <WebSearchSettings />}
          {activeCategory === 'database' && <DatabaseSettings />}
        </div>
      )}
    </CollapsibleSidebar>
  )
}
