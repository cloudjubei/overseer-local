import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSettings } from '@core/contexts/AppSettingsContext'
import { useProjects } from '@core/contexts/ProjectsContext'
import { useProjectsGroups, type ProjectsGroup } from '@core/contexts/ProjectsGroupsContext'
import { useBadgeCounts, type BadgeCounts } from '@core/notifications/useBadgeCounts'
import type { BadgeColor, NotificationCategory } from '@core/types/settings'
import { Button, NotificationBadge, renderProjectIcon, SpinnerWithDot } from 'thefactory-ui/web'
import { IconCollection, IconFolder, IconFolderOpen, IconMenu } from 'thefactory-ui/web/icons'
import type { GroupTabKey, ShellTabKey } from './shellTabDefs'
import {
  GROUP_TAB_DEFS,
  SHELL_TAB_DEFS,
  groupTabToProjectTab,
  projectTabToGroupTab,
} from './shellTabDefs'
import ProjectManagerModal from '@ui/components/projects/ProjectManagerModal'

type Props = {
  projectId?: string
  /** Active per-project shell tab. Only used when `projectId` is set. */
  activeTab?: ShellTabKey
  activeGroupId?: string
  /** Active per-group tab. Only used when `activeGroupId` is set. */
  activeGroupTab?: GroupTabKey
}

const COLLAPSED_PX = 64
const EXPANDED_PX = 248

/** Maps each shell tab to the notification category whose count it should show. */
const TAB_BADGE_CATEGORY: Partial<Record<ShellTabKey, NotificationCategory>> = {
  chat: 'chat',
  agents: 'agent_runs',
  git: 'git',
}

const FOCUSABLE_ROW_SELECTOR = '[data-sidebar-row]'

const DND_PROJECT_MIME = 'application/x-thefactory-sidebar-project'

/**
 * Left navigation rail. Mirrors `overseer-local`'s `SidebarView` 1:1 —
 * collapsible, with keyboard nav, drag-reorder of projects within their MAIN
 * group, per-category notification badges, project icons, and group icons.
 *
 * When collapsed, the Projects section shows ONLY the currently active
 * project (or active group) — every other row is hidden so the rail stays
 * scannable at a glance.
 */
export default function Sidebar({
  projectId,
  activeTab,
  activeGroupId,
  activeGroupTab,
}: Props) {
  const navigate = useNavigate()
  const { settings, setUserPreferences } = useAppSettings()
  const userCollapsed = settings.userPreferences.sidebarCollapsed === true
  const isNarrow = useIsNarrowViewport()
  // On narrow viewports the rail auto-collapses; the user toggle expands
  // it as a mobile-style drawer (fixed overlay + backdrop) instead of
  // pushing the content — there isn't room to push.
  const [drawerOpen, setDrawerOpen] = useState(false)
  const collapsed = !drawerOpen && (userCollapsed || isNarrow)
  // Close the drawer when the user navigates somewhere.
  const onDrawerNavigate = () => {
    if (isNarrow && drawerOpen) setDrawerOpen(false)
  }
  // Close on Esc while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])
  const { projects, activeProjectId, setActiveProjectId } = useProjects()
  const { groups, reorderProject } = useProjectsGroups()
  const { counts, getProjectBadgeState } = useBadgeCounts()

  const asideRef = useRef<HTMLElement>(null)
  const [draggingProject, setDraggingProject] = useState<{ id: string; groupId: string } | null>(
    null,
  )
  const [manageOpen, setManageOpen] = useState(false)
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(() => readOpenGroupIds())

  const persistOpenGroupIds = (next: Set<string>) => {
    setOpenGroupIds(next)
    writeOpenGroupIds(next)
  }
  const toggleGroupOpen = (id: string) => {
    persistOpenGroupIds(
      ((current: Set<string>) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })(openGroupIds),
    )
  }
  const setGroupOpen = (id: string, open: boolean) => {
    if (open === openGroupIds.has(id)) return
    persistOpenGroupIds(
      ((current: Set<string>) => {
        const next = new Set(current)
        if (open) next.add(id)
        else next.delete(id)
        return next
      })(openGroupIds),
    )
  }

  // Inactive projects are hidden from the sidebar entirely. They remain
  // editable from the "Manage Projects" modal and can be reactivated there.
  const activeProjects = useMemo(() => projects.filter((p) => p.active !== false), [projects])

  const { mainGroups, allGroups, ungroupedProjects } = useMemo(
    () => splitGroupsAndProjects(groups, activeProjects),
    [groups, activeProjects],
  )

  // Preserve the user's current tab across project/group switches —
  // matches desktop's `handleProjectSwitch` / `handleGroupSelect`. If the
  // current scope is the same target type, carry the tab verbatim;
  // otherwise map across scopes via `projectTabToGroupTab` /
  // `groupTabToProjectTab` so equivalent surfaces (chat, tools, landing)
  // stay selected.
  const targetProjectTab: ShellTabKey = activeGroupId
    ? groupTabToProjectTab(activeGroupTab)
    : (activeTab ?? 'stories')
  const targetGroupTab: GroupTabKey = activeGroupId
    ? (activeGroupTab ?? 'home')
    : projectTabToGroupTab(activeTab)

  const onSelectProject = (id: string) => {
    setActiveProjectId(id)
    navigate(`/projects/${id}/${targetProjectTab}`)
    onDrawerNavigate()
  }
  const onSelectGroup = (id: string) => {
    navigate(`/groups/${id}/${targetGroupTab}`)
    onDrawerNavigate()
  }
  const onSelectTab = (next: ShellTabKey) => {
    if (!projectId) return
    navigate(`/projects/${projectId}/${next}`)
    onDrawerNavigate()
  }
  const onSelectGroupTab = (next: GroupTabKey) => {
    if (!activeGroupId) return
    navigate(`/groups/${activeGroupId}/${next}`)
    onDrawerNavigate()
  }
  const toggleCollapsed = () => {
    if (isNarrow) {
      // On narrow viewports the menu icon toggles the slide-out drawer.
      setDrawerOpen((open) => !open)
      return
    }
    setUserPreferences({ sidebarCollapsed: !userCollapsed })
  }

  /**
   * Roving focus across all rows in the sidebar, regardless of section.
   * `[data-sidebar-row]` is set on each focusable row.
   */
  const onAsideKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!asideRef.current) return
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
    const rows = Array.from(asideRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ROW_SELECTOR))
    if (rows.length === 0) return
    const active = document.activeElement as HTMLElement | null
    const currentIdx = active ? rows.indexOf(active) : -1
    let nextIdx = currentIdx
    if (e.key === 'ArrowDown')
      nextIdx = currentIdx < 0 ? 0 : Math.min(rows.length - 1, currentIdx + 1)
    else if (e.key === 'ArrowUp') nextIdx = currentIdx <= 0 ? 0 : currentIdx - 1
    else if (e.key === 'Home') nextIdx = 0
    else if (e.key === 'End') nextIdx = rows.length - 1
    if (nextIdx !== currentIdx) {
      e.preventDefault()
      rows[nextIdx].focus()
    }
  }

  const onProjectDragStart = (id: string, groupId: string) => (e: DragEvent<HTMLElement>) => {
    e.dataTransfer.setData(DND_PROJECT_MIME, id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingProject({ id, groupId })
  }

  const onProjectDragOver = (e: DragEvent<HTMLElement>) => {
    if (!e.dataTransfer.types.includes(DND_PROJECT_MIME) && draggingProject === null) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const onProjectDrop =
    (group: ProjectsGroup, targetIdx: number) => (e: DragEvent<HTMLElement>) => {
      e.preventDefault()
      const droppedId = e.dataTransfer.getData(DND_PROJECT_MIME) || draggingProject?.id
      setDraggingProject(null)
      if (!droppedId) return
      // Only reorder within the same group; cross-group moves aren't supported
      // by `reorderProject` (would need an explicit move endpoint).
      if (draggingProject && draggingProject.groupId !== group.id) return
      const fromIdx = group.projects.indexOf(droppedId)
      if (fromIdx < 0 || fromIdx === targetIdx) return
      void reorderProject(group.id, fromIdx, targetIdx)
    }

  const activeProject = activeProjects.find((p) => p.id === activeProjectId)
  const activeProjectGroup = activeProject
    ? mainGroups.find((g) => g.projects.includes(activeProject.id))
    : undefined

  const isDrawer = isNarrow && drawerOpen
  const asideClassName = [
    'flex flex-col h-full overflow-hidden border-r shrink-0 transition-[width,transform]',
    // When narrow + drawer-open, slide the panel over the content as a
    // fixed overlay with backdrop; otherwise behave as the normal rail.
    isDrawer ? 'fixed inset-y-0 left-0 z-50 shadow-2xl translate-x-0' : '',
    isNarrow && !drawerOpen ? '' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <>
      {isDrawer ? (
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Dismiss sidebar"
          className="fixed inset-0 z-40 bg-black/40 transition-opacity"
        />
      ) : null}
      <aside
        ref={asideRef}
        onKeyDown={onAsideKeyDown}
        className={asideClassName}
        style={{
          width: collapsed ? COLLAPSED_PX : EXPANDED_PX,
          borderColor: 'var(--border-subtle)',
          background: 'var(--surface-base)',
        }}
      >
        <header
          className={`flex items-center gap-2 p-3 shrink-0 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {!collapsed && (
            <button
              type="button"
              onClick={() => projectId && navigate(`/projects/${projectId}/stories`)}
              className="flex items-center gap-3 text-sm font-semibold"
              tabIndex={-1}
            >
              <img src="/icon.png" alt="Overseer" className="h-5 w-5 shrink-0" />
              <span>Overseer</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1 rounded text-(--text-muted) hover:text-(--text-primary) hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            tabIndex={-1}
          >
            <IconMenu className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-auto">
          {projectId && (
            <Section collapsed={collapsed}>
              {SHELL_TAB_DEFS.filter(
                (t) => t.key !== 'settings' && !('hiddenInSidebar' in t && t.hiddenInSidebar),
              ).map((tab) => {
                const cat = TAB_BADGE_CATEGORY[tab.key]
                const countKey = cat ? badgeKeyForCategory(cat) : undefined
                const badgeValue = countKey ? (counts[countKey] as number) : 0
                const badgeColor = cat ? settings.notifications.badgeColors[cat] : undefined
                // Chat tab gets the additional "thinking" spinner-with-dot
                // affordance — matches desktop's StaticNavItem.
                const thinking = tab.key === 'chat' && counts.chatThinking
                return (
                  <NavRow
                    key={tab.key}
                    label={tab.label}
                    icon={tab.icon}
                    isActive={tab.key === activeTab && !activeGroupId}
                    onClick={() => onSelectTab(tab.key)}
                    collapsed={collapsed}
                    badge={badgeValue}
                    badgeColor={badgeColor}
                    thinking={thinking}
                  />
                )
              })}
            </Section>
          )}

          {activeGroupId && (
            <Section collapsed={collapsed}>
              {GROUP_TAB_DEFS.map((tab) => {
                // Chat tab gets the "thinking" spinner-with-dot affordance.
                const thinking = tab.key === 'chat' && counts.chatThinking
                const badgeValue = tab.key === 'chat' ? counts.chat : 0
                const badgeColor =
                  tab.key === 'chat' ? settings.notifications.badgeColors.chat : undefined
                return (
                  <NavRow
                    key={tab.key}
                    label={tab.label}
                    icon={tab.icon}
                    isActive={tab.key === activeGroupTab}
                    onClick={() => onSelectGroupTab(tab.key)}
                    collapsed={collapsed}
                    badge={badgeValue}
                    badgeColor={badgeColor}
                    thinking={thinking}
                  />
                )
              })}
            </Section>
          )}

          <Section
            label="Projects"
            collapsed={collapsed}
            divider
            headerActions={
              !collapsed && (
                <div className="inline-flex items-center gap-1.5">
                  <span className="text-xs text-(--text-secondary)">{activeProjects.length}</span>
                  <Button size="sm" variant="secondary" onClick={() => setManageOpen(true)}>
                    Manage
                  </Button>
                </div>
              )
            }
          >
            {activeProjects.length === 0 ? (
              !collapsed && <p className="text-sm opacity-60 px-3 py-1">No projects yet.</p>
            ) : collapsed ? (
              // Collapsed: show ONLY the active selection (project or group).
              // Everything else is hidden so the rail stays scannable.
              (() => {
                if (activeGroupId) {
                  const g = groups.find((gg) => gg.id === activeGroupId)
                  if (g) return <GroupRow group={g} isActive collapsed onClick={() => undefined} />
                }
                if (activeProject) {
                  return (
                    <NavRow
                      label={activeProject.title}
                      icon={renderProjectIcon(asIconKey(activeProject.metadata?.icon))}
                      isActive
                      onClick={() => onSelectProject(activeProject.id)}
                      collapsed
                      dataLocation={activeProject.dataLocation}
                    />
                  )
                }
                return null
              })()
            ) : (
              <>
                {ungroupedProjects.map((p) => {
                  const isActive = p.id === activeProjectId && !activeGroupId
                  const st = getProjectBadgeState(p.id)
                  // Active project's badges are surfaced by the per-tab row
                  // above (Chat / Agents / Git / Tests) — skip them on the
                  // project row itself to avoid double-rendering. Matches
                  // desktop's ProjectNavItem behaviour.
                  const chatUnread = isActive ? 0 : st.chat_messages.unread
                  const chatThinking = isActive ? false : st.chat_messages.thinking
                  return (
                    <NavRow
                      key={p.id}
                      label={p.title}
                      icon={renderProjectIcon(asIconKey(p.metadata?.icon))}
                      isActive={isActive}
                      onClick={() => onSelectProject(p.id)}
                      collapsed={collapsed}
                      dataLocation={p.dataLocation}
                      badge={chatUnread}
                      badgeColor={settings.notifications.badgeColors.chat}
                      thinking={chatThinking}
                    />
                  )
                })}
                {allGroups.map((g) =>
                  g.type === 'SCOPE' ? (
                    <GroupRow
                      key={g.id}
                      group={g}
                      isActive={g.id === activeGroupId}
                      collapsed={collapsed}
                      onClick={() => onSelectGroup(g.id)}
                    />
                  ) : (
                    <GroupBlock
                      key={g.id}
                      group={g}
                      projects={activeProjects}
                      activeProjectId={activeProjectId}
                      activeGroupId={activeGroupId}
                      collapsed={collapsed}
                      isOpen={openGroupIds.has(g.id)}
                      onToggleOpen={() => toggleGroupOpen(g.id)}
                      autoOpenForActiveProject={
                        !!activeProject &&
                        g.projects.includes(activeProject.id) &&
                        !activeGroupId &&
                        activeProjectGroup?.id === g.id
                      }
                      onAutoOpen={() => setGroupOpen(g.id, true)}
                      onSelectProject={onSelectProject}
                      onSelectGroup={() => onSelectGroup(g.id)}
                      draggingId={draggingProject?.id ?? null}
                      onDragStart={onProjectDragStart}
                      onDragOver={onProjectDragOver}
                      onDrop={onProjectDrop}
                      getProjectBadgeState={getProjectBadgeState}
                      chatBadgeColor={settings.notifications.badgeColors.chat}
                    />
                  ),
                )}
              </>
            )}
          </Section>
        </div>

        {projectId && (
          <div className="shrink-0 border-t py-1" style={{ borderColor: 'var(--border-subtle)' }}>
            {(() => {
              const settingsTab = SHELL_TAB_DEFS.find((t) => t.key === 'settings')
              if (!settingsTab) return null
              return (
                <NavRow
                  label={settingsTab.label}
                  icon={settingsTab.icon}
                  isActive={activeTab === 'settings' && !activeGroupId}
                  onClick={() => onSelectTab('settings')}
                  collapsed={collapsed}
                />
              )
            })()}
          </div>
        )}
        {manageOpen && <ProjectManagerModal onRequestClose={() => setManageOpen(false)} />}
      </aside>
    </>
  )
}

/**
 * `true` while the viewport is narrower than ~768px (Tailwind's `md` breakpoint).
 * Used to auto-collapse the sidebar on phones/portrait tablets without losing
 * the user's preferred desktop layout.
 */
function useIsNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(max-width: 767.98px)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 767.98px)')
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

function badgeKeyForCategory(cat: NotificationCategory): keyof BadgeCounts {
  // The `BadgeCounts` keys mirror notification categories one-for-one.
  return cat === 'agent_runs' ? 'agent_runs' : (cat as keyof BadgeCounts)
}

function asIconKey(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

const OPEN_GROUPS_LS_KEY = 'thefactory-overseer-web:sidebar.openGroupIds'

/** Read the persisted set of expanded sidebar group ids. Survives navigation
 *  AND reloads — moving between projects or visiting a group page shouldn't
 *  reset which folders the user had open. */
function readOpenGroupIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(OPEN_GROUPS_LS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === 'string'))
    }
  } catch {
    // unparseable / unavailable localStorage — fall through to empty set
  }
  return new Set()
}

function writeOpenGroupIds(ids: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(OPEN_GROUPS_LS_KEY, JSON.stringify(Array.from(ids)))
  } catch {
    // ignore storage errors
  }
}

function splitGroupsAndProjects(
  groups: ProjectsGroup[],
  projects: ReturnType<typeof useProjects>['projects'],
) {
  // Only ACTIVE groups appear in the sidebar at all.
  const allGroups = groups.filter((g) => g.active !== false)
  // MAIN groups are the only ones that "own" projects (a project's
  // ungrouped-ness is decided purely by MAIN-group membership). SCOPE groups
  // are flat selectable rows and don't take projects out of the ungrouped
  // bucket.
  const mainGroups = allGroups.filter((g) => g.type !== 'SCOPE')
  const grouped = new Set<string>()
  for (const g of mainGroups) for (const id of g.projects) grouped.add(id)
  const ungroupedProjects = projects.filter((p) => !grouped.has(p.id))
  return { mainGroups, allGroups, ungroupedProjects }
}

function Section({
  label,
  collapsed,
  children,
  headerActions,
  divider = false,
}: {
  label?: string
  collapsed: boolean
  children: ReactNode
  headerActions?: ReactNode
  /** Draw a horizontal divider above this section. Stays visible in collapsed mode. */
  divider?: boolean
}) {
  return (
    <div
      className={`flex flex-col mb-3 ${divider ? 'mt-2 pt-2 border-t' : 'mt-2'}`}
      style={divider ? { borderColor: 'var(--border-subtle)' } : undefined}
    >
      {!collapsed && label && (
        <div className="flex items-center justify-between gap-2 px-3 py-1">
          <span className="text-[10px] uppercase tracking-wider opacity-60">{label}</span>
          {headerActions}
        </div>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

/**
 * A MAIN group with an expand/collapse folder icon and its member projects
 * nested beneath. Auto-opens when the active project lives in this group.
 */
function GroupBlock({
  group,
  projects,
  activeProjectId,
  activeGroupId,
  collapsed,
  isOpen,
  onToggleOpen,
  autoOpenForActiveProject,
  onAutoOpen,
  onSelectProject,
  onSelectGroup,
  draggingId,
  onDragStart,
  onDragOver,
  onDrop,
  getProjectBadgeState,
  chatBadgeColor,
}: {
  group: ProjectsGroup
  projects: ReturnType<typeof useProjects>['projects']
  activeProjectId: string | undefined
  activeGroupId: string | undefined
  collapsed: boolean
  isOpen: boolean
  onToggleOpen: () => void
  /** True when the active project lives in this group and the group should
   *  auto-expand on mount/navigation if it isn't already open. */
  autoOpenForActiveProject: boolean
  onAutoOpen: () => void
  onSelectProject: (id: string) => void
  onSelectGroup: () => void
  draggingId: string | null
  onDragStart: (id: string, groupId: string) => (e: DragEvent<HTMLElement>) => void
  onDragOver: (e: DragEvent<HTMLElement>) => void
  onDrop: (group: ProjectsGroup, targetIdx: number) => (e: DragEvent<HTMLElement>) => void
  /** Per-project badge resolver from the parent's `useBadgeCounts`. */
  getProjectBadgeState: (projectId: string) => {
    chat_messages: { unread: number; thinking: boolean }
  }
  chatBadgeColor?: BadgeColor
}) {
  // Auto-expand when the active project lives in this group. We don't ever
  // auto-collapse — once the user toggles a group closed, navigating away
  // and back should leave it closed.
  useEffect(() => {
    if (autoOpenForActiveProject && !isOpen) onAutoOpen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenForActiveProject])

  const memberProjects = group.projects
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is (typeof projects)[number] => Boolean(p))

  const isActive = group.id === activeGroupId

  return (
    <div className="flex flex-col gap-0.5 mb-1">
      <div
        data-sidebar-row
        className="flex items-center gap-0 text-sm w-full"
        style={{
          background: isActive ? 'var(--color-brand-50)' : 'transparent',
          color: isActive ? 'var(--color-brand-700)' : 'inherit',
        }}
      >
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={isOpen}
          aria-controls={`group-${group.id}`}
          className="inline-flex h-9 w-10 items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
        >
          {isOpen ? <IconFolderOpen className="w-4 h-4" /> : <IconFolder className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={onSelectGroup}
          className="flex-1 text-left text-sm py-2 pr-3 font-medium truncate"
        >
          {group.title}
        </button>
      </div>
      {isOpen && (
        <div id={`group-${group.id}`} className="flex flex-col gap-0.5">
          {memberProjects.map((p, idx) => {
            const projectIsActive = p.id === activeProjectId && !activeGroupId
            const st = getProjectBadgeState(p.id)
            // Active project: skip badges on the project row — they're
            // already surfaced on the per-tab nav row above.
            const chatUnread = projectIsActive ? 0 : st.chat_messages.unread
            const chatThinking = projectIsActive ? false : st.chat_messages.thinking
            return (
              <NavRow
                key={p.id}
                label={p.title}
                icon={renderProjectIcon(asIconKey(p.metadata?.icon))}
                isActive={projectIsActive}
                onClick={() => onSelectProject(p.id)}
                collapsed={collapsed}
                indent
                draggable
                isDragging={draggingId === p.id}
                onDragStart={onDragStart(p.id, group.id)}
                onDragOver={onDragOver}
                onDrop={onDrop(group, idx)}
                dataLocation={p.dataLocation}
                badge={chatUnread}
                badgeColor={chatBadgeColor}
                thinking={chatThinking}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

/** A flat group row used for SCOPE groups + collapsed-active rendering. */
function GroupRow({
  group,
  isActive,
  collapsed,
  onClick,
}: {
  group: ProjectsGroup
  isActive: boolean
  collapsed: boolean
  onClick: () => void
}) {
  const icon =
    group.type === 'SCOPE' ? (
      <IconCollection className="w-4.5 h-4.5" />
    ) : (
      <IconFolder className="w-4.5 h-4.5" />
    )
  return (
    <NavRow
      label={group.title}
      icon={icon}
      isActive={isActive}
      onClick={onClick}
      collapsed={collapsed}
    />
  )
}

function NavRow({
  label,
  icon,
  isActive,
  onClick,
  collapsed,
  badge,
  badgeColor,
  thinking = false,
  indent = false,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragOver,
  onDrop,
  dataLocation,
}: {
  label: string
  icon: ReactNode
  isActive: boolean
  onClick: () => void
  collapsed: boolean
  badge?: number
  badgeColor?: BadgeColor
  /** When true, render a `SpinnerWithDot` instead of (or alongside) the
   * numeric badge — used by the Chat row to surface "any chat thinking". */
  thinking?: boolean
  indent?: boolean
  draggable?: boolean
  isDragging?: boolean
  onDragStart?: (e: DragEvent<HTMLElement>) => void
  onDragOver?: (e: DragEvent<HTMLElement>) => void
  onDrop?: (e: DragEvent<HTMLElement>) => void
  /** Project's data-location, when this row represents a project. */
  dataLocation?: 'central' | 'inProject'
}) {
  const hasBadge = badge !== undefined && badge > 0
  const cap99 = (n: number) => (n > 99 ? '99+' : `${n}`)
  const badgeColorClass = badgeColor ? `bg-${badgeColor}-500` : undefined
  return (
    <button
      type="button"
      onClick={onClick}
      data-sidebar-row
      aria-current={isActive ? 'true' : undefined}
      title={collapsed ? label : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative flex items-center gap-2 py-2 text-left text-sm w-full focus:outline-none focus-visible:ring-2 ${
        collapsed ? 'justify-center px-0' : 'px-3'
      }`}
      style={{
        background: isActive ? 'var(--color-brand-50)' : 'transparent',
        color: isActive ? 'var(--color-brand-700)' : 'inherit',
        opacity: isDragging ? 0.4 : 1,
        paddingLeft: !collapsed && indent ? '1.75rem' : undefined,
      }}
    >
      <span
        aria-hidden
        className="inline-flex h-5 w-5 items-center justify-center shrink-0 [&>svg]:w-4.5 [&>svg]:h-4.5"
      >
        {icon}
      </span>
      {!collapsed && <span className="truncate flex-1">{label}</span>}
      {!collapsed && dataLocation === 'inProject' && (
        <span
          aria-label="Stored in this project’s repository"
          title="This project’s stories and chats are kept in its own git repository, not in the thefactory-overseer project."
          className="text-[10px] opacity-70 shrink-0"
        >
          ◉
        </span>
      )}
      {/* Badge / spinner — always rendered (collapsed mode shrinks them) so
          unread/thinking state stays visible even on the narrow rail. */}
      {thinking ? (
        <span
          className={
            collapsed
              ? 'absolute top-1 right-1 inline-flex items-center justify-center'
              : 'inline-flex items-center justify-center'
          }
        >
          <SpinnerWithDot
            size={collapsed ? 12 : 14}
            showDot={hasBadge}
            dotColorClass={badgeColorClass}
            dotTitle={hasBadge ? `${cap99(badge!)} unread chats` : undefined}
          />
        </span>
      ) : hasBadge ? (
        <NotificationBadge
          text={cap99(badge!)}
          color={badgeColor}
          className={
            collapsed ? 'absolute top-1 right-1 h-[14px] min-w-[14px] px-0.5 text-[8px]' : ''
          }
          tooltipLabel={label}
        />
      ) : null}
    </button>
  )
}
