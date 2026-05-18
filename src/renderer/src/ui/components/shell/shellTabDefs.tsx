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

/**
 * Shared definition of the shell's per-project navigation entries. Tabs with
 * `hiddenInSidebar: true` are still routable (the route is wired up in
 * `App.tsx`) but don't appear in `Sidebar.tsx`. We keep them in the union so
 * the type system can prove that route paths like `/agents` are valid.
 *
 * The visible items (and their order/labels/icons) mirror `overseer-local`'s
 * `NAV_ITEMS` (in `navigation/sidebar/constants.tsx`) 1:1 — the two apps must
 * look identical here.
 *
 * Note: `key` values map to URL segments (`/projects/:id/{key}`). `'stories'`
 * is kept as the key so existing bookmarks/links continue to work, even
 * though the user-facing label is "Home" to match desktop.
 */
export type ShellTabDef = {
  key: ShellTabKey
  label: string
  icon: ReactNode
  hiddenInSidebar?: boolean
}

export const SHELL_TAB_DEFS = [
  { key: 'stories', label: 'Home', icon: <IconHome /> },
  { key: 'files', label: 'Files', icon: <IconFiles /> },
  { key: 'chat', label: 'Chat', icon: <IconChat /> },
  { key: 'git', label: 'Git', icon: <IconBranch /> },
  { key: 'tests', label: 'Tests', icon: <IconTests /> },
  { key: 'live-data', label: 'Live Data', icon: <IconAntenna /> },
  { key: 'timeline', label: 'Timeline', icon: <IconTimeline /> },
  { key: 'tools', label: 'Tools', icon: <IconToolbox /> },
  { key: 'settings', label: 'Settings', icon: <IconSettings /> },
  // Hidden — has a route but isn't surfaced in the sidebar (parity with desktop).
  { key: 'agents', label: 'Agents', icon: <IconRobot />, hiddenInSidebar: true },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  icon: ReactNode
  hiddenInSidebar?: boolean
}>

export type ShellTabKey = (typeof SHELL_TAB_DEFS)[number]['key']

export function isShellTabKey(v: string | undefined): v is ShellTabKey {
  return SHELL_TAB_DEFS.some((t) => t.key === v)
}

/**
 * Per-group sidebar tabs. Mirrors desktop's `GROUP_NAV_ITEMS` — only the
 * three nav items that make sense at the group scope (no Files / Git / etc.,
 * since a group spans multiple repos). URL segments: `/groups/:id/{key}`.
 */
export const GROUP_TAB_DEFS = [
  { key: 'home', label: 'Home', icon: <IconHome /> },
  { key: 'chat', label: 'Chat', icon: <IconChat /> },
  { key: 'tools', label: 'Tools', icon: <IconToolbox /> },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  icon: ReactNode
}>

export type GroupTabKey = (typeof GROUP_TAB_DEFS)[number]['key']

export function isGroupTabKey(v: string | undefined): v is GroupTabKey {
  return GROUP_TAB_DEFS.some((t) => t.key === v)
}

/**
 * Map a project tab to its closest group equivalent. Used when the user
 * switches from a project to a group: tabs that have a meaningful
 * counterpart at the group scope (`chat`, `tools`) carry over so the
 * sidebar selection stays on the same surface; `stories` maps to `home`
 * (both are the landing page for their scope); everything else falls
 * back to `home`. Matches desktop's `handleGroupSelect` behaviour.
 */
export function projectTabToGroupTab(tab: ShellTabKey | undefined): GroupTabKey {
  if (tab === 'chat') return 'chat'
  if (tab === 'tools') return 'tools'
  return 'home'
}

/**
 * Map a group tab to its closest project equivalent. Used when the user
 * switches from a group to a project: `home` becomes `stories` (the
 * project landing page); `chat`/`tools` carry over verbatim.
 */
export function groupTabToProjectTab(tab: GroupTabKey | undefined): ShellTabKey {
  if (tab === 'chat') return 'chat'
  if (tab === 'tools') return 'tools'
  return 'stories'
}
