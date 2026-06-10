import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppSettings } from 'thefactory-ui/headless'
import { useProjects } from 'thefactory-ui/headless'
import { useProjectsGroups, type ProjectsGroup } from 'thefactory-ui/headless'
import { useSeedActivities } from 'thefactory-ui/headless'
import { useBadgeCounts, type BadgeCounts } from '@core/notifications/useBadgeCounts'
import type { BadgeColor, NotificationCategory } from '@core/types/settings'
import { isBadgeColorCategory } from '@core/types/settings'
import { Button, NotificationBadge, renderProjectIcon, SpinnerWithDot } from 'thefactory-ui/web'
import { IconPause } from 'thefactory-ui/web/icons'
import { IconCollection, IconFolder, IconFolderOpen, IconMenu } from 'thefactory-ui/web/icons'
import {
  GROUP_TAB_DEFS,
  SHELL_TAB_DEFS,
  formatBadgeCount,
  groupTabToProjectTab,
  projectTabToGroupTab,
  splitGroupsAndProjects,
  type GroupTabKey,
  type ShellTabKey,
} from 'thefactory-ui/headless'
import { navIcon } from './navIcons'
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
  git: 'git',
}

const FOCUSABLE_ROW_SELECTOR = '[data-sidebar-row]'

const DND_PROJECT_MIME = 'application/x-thefactory-sidebar-project'

/**
 * Left navigation rail — collapsible, with keyboard nav, drag-reorder of
 * projects within their MAIN group, per-category notification badges, project
 * icons, and group icons.
 *
 * Desktop is big-screen only, so this is the big-screen rail that mirrors
 * web's `Sidebar` without web's narrow-viewport drawer behaviour.
 *
 * When collapsed, the Projects section shows ONLY the currently active
 * project (or active group) — every other row is hidden so the rail stays
 * scannable at a glance.
 */
export default function Sidebar({ projectId, activeTab, activeGroupId, activeGroupTab }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { settings, setUserPreferences } = useAppSettings()
  const userCollapsed = settings.userPreferences.sidebarCollapsed === true
  const collapsed = userCollapsed
  const { projects, activeProjectId, setActiveProjectId } = useProjects()
  const { groups, reorderProject } = useProjectsGroups()
  const { counts, getProjectBadgeState, getGroupBadgeState } = useBadgeCounts()

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
  // Seed every project's activity state so each row shows live spinners + paused
  // icons, not just the active project (which self-seeds).
  useSeedActivities(useMemo(() => activeProjects.map((p) => p.id), [activeProjects]))

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
    // The `app` tab only exists for projects that have one — carrying it to a
    // non-app project would land on an empty App view, so fall back to home.
    const targetMeta = projects.find((p) => p.id === id)?.metadata as
      | { hasApp?: unknown }
      | undefined
    const tab =
      targetProjectTab === 'app' && targetMeta?.hasApp !== true ? 'stories' : targetProjectTab
    // Switching projects while inside Settings should keep the user on
    // their current sub-tab (`?tab=llms`, `?tab=github`, …). Settings is
    // mostly global; only `NotificationSettings` reads per-project state
    // and that re-renders automatically when `useActiveProject()` flips.
    // For other tabs, dropping the search params is the right call (a
    // selected story / file from the previous project doesn't carry over).
    const search = tab === 'settings' ? location.search : ''
    navigate(`/projects/${id}/${tab}${search}`)
  }
  const onSelectGroup = (id: string) => {
    navigate(`/groups/${id}/${targetGroupTab}`)
  }
  const onSelectTab = (next: ShellTabKey) => {
    if (!projectId) return
    navigate(`/projects/${projectId}/${next}`)
  }
  const onSelectGroupTab = (next: GroupTabKey) => {
    if (!activeGroupId) return
    navigate(`/groups/${activeGroupId}/${next}`)
  }
  const toggleCollapsed = () => {
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

  return (
    <aside
      ref={asideRef}
      onKeyDown={onAsideKeyDown}
      className="flex flex-col h-full overflow-hidden border-r shrink-0 transition-[width]"
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

      <div className="shrink-0">
        {projectId && (
          <Section collapsed={collapsed}>
            {SHELL_TAB_DEFS.filter((t) => {
              if (t.key === 'settings') return false
              if ('hiddenInSidebar' in t && t.hiddenInSidebar) return false
              if (t.key === 'app') {
                const meta = projects.find((p) => p.id === projectId)?.metadata as
                  | { hasApp?: unknown }
                  | undefined
                return meta?.hasApp === true
              }
              return true
            }).map((tab) => {
              const cat = TAB_BADGE_CATEGORY[tab.key]
              const countKey = cat ? badgeKeyForCategory(cat) : undefined
              // The App tab carries the background-activity badge/spinner (the
              // embedded app's detached runs) rather than a notification category.
              const isApp = tab.key === 'app'
              // Don't re-spin the App nav row while the user is viewing the app —
              // they can see the work happening (matches the active chat).
              const viewingApp = isApp && tab.key === activeTab && !activeGroupId
              const badgeValue = isApp
                ? viewingApp
                  ? 0
                  : counts.activity
                : countKey
                  ? (counts[countKey] as number)
                  : 0
              const badgeColor = isApp
                ? settings.notifications.badgeColors.activity
                : cat && isBadgeColorCategory(cat)
                  ? settings.notifications.badgeColors[cat]
                  : undefined
              // Chat thinking + App activity both get the spinner-with-dot affordance.
              const thinking =
                (tab.key === 'chat' && counts.chatThinking) ||
                (isApp && counts.activityWorking && !viewingApp)
              const paused = isApp && counts.activityPaused && !viewingApp
              return (
                <NavRow
                  key={tab.key}
                  label={tab.label}
                  icon={navIcon(tab.icon)}
                  isActive={tab.key === activeTab && !activeGroupId}
                  onClick={() => onSelectTab(tab.key)}
                  collapsed={collapsed}
                  badge={badgeValue}
                  badgeColor={badgeColor}
                  thinking={thinking}
                  paused={paused}
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
                  icon={navIcon(tab.icon)}
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
      </div>

      <div className="flex-1 overflow-auto">
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
                    thinking={chatThinking || st.activity.running > 0}
                    paused={st.activity.running === 0 && st.activity.paused > 0}
                  />
                )
              })}
              {allGroups.map((g) => {
                // Group badges show CHAT unread only (no git/tests at group
                // scope). A SCOPE group, and an OPEN folder, show just the
                // group's OWN chats; a CLOSED folder shows the aggregate of
                // the group + its member projects. The active group skips its
                // row badge — surfaced on the per-group-tab nav row instead.
                const groupIsActive = g.id === activeGroupId
                const groupOpen = openGroupIds.has(g.id)
                const rolled =
                  g.type === 'SCOPE' || groupOpen
                    ? getGroupBadgeState(g.id, [])
                    : getGroupBadgeState(g.id, g.projects)
                const groupUnread = groupIsActive ? 0 : rolled.chat_messages.unread
                const groupThinking =
                  groupIsActive ? false : rolled.chat_messages.thinking || rolled.activity.running > 0
                const groupPaused =
                  groupIsActive ? false : rolled.activity.running === 0 && rolled.activity.paused > 0
                return g.type === 'SCOPE' ? (
                  <GroupRow
                    key={g.id}
                    group={g}
                    isActive={groupIsActive}
                    collapsed={collapsed}
                    onClick={() => onSelectGroup(g.id)}
                    badge={groupUnread}
                    badgeColor={settings.notifications.badgeColors.chat}
                    thinking={groupThinking}
                    paused={groupPaused}
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
                    headerBadge={groupUnread}
                    headerThinking={groupThinking}
                    headerPaused={groupPaused}
                  />
                )
              })}
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
                icon={navIcon(settingsTab.icon)}
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
  )
}

function badgeKeyForCategory(cat: NotificationCategory): keyof BadgeCounts {
  // The `BadgeCounts` keys mirror notification categories one-for-one.
  return cat
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
  headerBadge,
  headerThinking = false,
  headerPaused = false,
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
    activity: { running: number; paused: number }
  }
  chatBadgeColor?: BadgeColor
  /** Group chat badge for the header row. The parent resolves it to the
   *  group's OWN chats when the folder is open (members show their own rows)
   *  and to the aggregate (group + members) when collapsed. */
  headerBadge?: number
  headerThinking?: boolean
  headerPaused?: boolean
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
        {(headerThinking || headerPaused || (headerBadge ?? 0) > 0) && (
          <span className="inline-flex items-center justify-center shrink-0 pr-2">
            {headerThinking ? (
              <SpinnerWithDot
                size={14}
                showDot={(headerBadge ?? 0) > 0}
                dotColorClass={chatBadgeColor ? `bg-${chatBadgeColor}-500` : undefined}
                dotTitle={(headerBadge ?? 0) > 0 ? `${formatBadgeCount(headerBadge!)} unread chats` : undefined}
              />
            ) : headerPaused ? (
              <span className="text-blue-500" title="Paused activity — resumes when you open it">
                <IconPause className="w-3.5 h-3.5" />
              </span>
            ) : (
              <NotificationBadge
                text={formatBadgeCount(headerBadge!)}
                color={chatBadgeColor}
                tooltipLabel={group.title}
              />
            )}
          </span>
        )}
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
                thinking={chatThinking || st.activity.running > 0}
                paused={st.activity.running === 0 && st.activity.paused > 0}
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
  badge,
  badgeColor,
  thinking = false,
  paused = false,
}: {
  group: ProjectsGroup
  isActive: boolean
  collapsed: boolean
  onClick: () => void
  badge?: number
  badgeColor?: BadgeColor
  thinking?: boolean
  paused?: boolean
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
      badge={badge}
      badgeColor={badgeColor}
      thinking={thinking}
      paused={paused}
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
  paused = false,
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
  /** When true (and not thinking), render a paused icon — a resumable activity
   * that isn't live in the server (e.g. orphaned after a restart). */
  paused?: boolean
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
            dotTitle={hasBadge ? `${formatBadgeCount(badge!)} unread chats` : undefined}
          />
        </span>
      ) : paused ? (
        <span
          className={
            collapsed
              ? 'absolute top-1 right-1 inline-flex items-center justify-center text-blue-500'
              : 'inline-flex items-center justify-center text-blue-500'
          }
          title="Paused activity — resumes when you open it"
        >
          <IconPause className={collapsed ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        </span>
      ) : hasBadge ? (
        <NotificationBadge
          text={formatBadgeCount(badge!)}
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
