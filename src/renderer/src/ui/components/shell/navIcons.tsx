import type { ReactNode } from 'react'
import {
  IconAntenna,
  IconBranch,
  IconChat,
  IconDocument,
  IconFiles,
  IconHome,
  IconMonitor,
  IconSettings,
  IconTests,
  IconTimeline,
  IconToolbox,
  IconWorkflow,
} from 'thefactory-ui/web/icons'
import type { NavIconKey } from 'thefactory-ui/headless'

/**
 * Resolves the headless `NavIconKey` set (the structural source of truth in
 * `thefactory-ui/headless`) to this client's icon components. Mirrors web's
 * `navIcons`.
 */
const ICONS: Record<NavIconKey, ReactNode> = {
  home: <IconHome />,
  app: <IconMonitor />,
  files: <IconFiles />,
  notes: <IconDocument />,
  chat: <IconChat />,
  git: <IconBranch />,
  tests: <IconTests />,
  'live-data': <IconAntenna />,
  timeline: <IconTimeline />,
  tools: <IconToolbox />,
  processes: <IconWorkflow />,
  settings: <IconSettings />,
}

export function navIcon(key: NavIconKey): ReactNode {
  return ICONS[key]
}
