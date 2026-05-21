import type { ReactNode } from 'react'
import {
  IconAntenna,
  IconBranch,
  IconChat,
  IconFiles,
  IconHome,
  IconRobot,
  IconSettings,
  IconTests,
  IconTimeline,
  IconToolbox,
} from 'thefactory-ui/web/icons'
import type { NavIconKey } from 'thefactory-ui/headless'

/**
 * Resolves the headless `NavIconKey` set (the structural source of truth in
 * `thefactory-ui/headless`) to this client's icon components. Mirrors web's
 * `navIcons`.
 */
const ICONS: Record<NavIconKey, ReactNode> = {
  home: <IconHome />,
  files: <IconFiles />,
  chat: <IconChat />,
  git: <IconBranch />,
  tests: <IconTests />,
  'live-data': <IconAntenna />,
  timeline: <IconTimeline />,
  tools: <IconToolbox />,
  settings: <IconSettings />,
  agents: <IconRobot />,
}

export function navIcon(key: NavIconKey): ReactNode {
  return ICONS[key]
}
