import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FilesView from '../screens/FilesView'
import SettingsView from '../screens/SettingsView'
import ChatView from '../screens/ChatView'
import NotificationsView from '../screens/NotificationsView'
import StoriesView from '../screens/StoriesView'
import AgentsView from '../screens/AgentsView'
import LiveDataView from '../screens/LiveDataView'
import ProjectTimelineView from '../screens/ProjectTimelineView'
import ToolsScreen from '../screens/ToolsView'
import TestsView from '../screens/TestsView'
import GitView from '../screens/GitView'
import { useNavigator } from './Navigator'
import Tooltip from '../components/ui/Tooltip'
import { useNotifications } from '../hooks/useNotifications'
import { MAIN_PROJECT, useProjectContext } from '../contexts/ProjectContext'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { useAgents } from '../contexts/AgentsContext'
import NotificationBadge from '../components/stories/NotificationBadge'
import { ProjectSpec } from 'thefactory-tools'
import {
  IconHome,
  IconFiles,
  IconChat,
  IconRobot,
  IconAntenna,
  IconBell,
  IconSettings,
  IconWarningTriangle,
  IconMenu,
  IconChevron,
  IconTimeline,
  IconToolbox,
  IconTests,
  IconBranch,
} from '../components/ui/icons/Icons'
import { notificationsService } from '../services/notificationsService'
import { renderProjectIcon } from '@renderer/screens/projects/projectIcons'
import { NavigationView } from '@renderer/types'
import { hideScrollStyle } from '@renderer/utils/hideScrollStyle'
import { useProjectsGroups } from '../contexts/ProjectsGroupsContext'
import { useChatUnread } from '../hooks/useChatUnread'
import { useChatThinking } from '../hooks/useChatThinking'
import SpinnerWithDot from '../components/ui/SpinnerWithDot'
import { useGit } from '../contexts/GitContext'

export type SidebarProps = {}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ')
}

type NavDef = {
  id: string
  label: string
  view: NavigationView
  icon: React.ReactNode
  accent?: 'brand' | 'purple' | 'teal' | 'gray'
}

const NAV_ITEMS: NavDef[] = [
  { id: 'home', label: 'Home', view: 'Home', icon: <IconHome />, accent: 'brand' },
  {
    id: 'files',
    label: 'Files',
    view: 'Files',
    icon: <IconFiles />,
    accent: 'purple',
  },
  { id: 'chat', label: 'Chat', view: 'Chat', icon: <IconChat />, accent: 'teal' },
  {
    id: 'agents',
    label: 'Agents',
    view: 'Agents',
    icon: <IconRobot />,
    accent: 'teal',
  },
  {
    id: 'git',
    label: 'Git',
    view: 'Git',
    icon: <IconBranch />,
    accent: 'purple',
  },
  {
    id: 'tests',
    label: 'Tests',
    view: 'Tests',
    icon: <IconTests />,
    accent: 'teal',
  },
  {
    id: 'live-data',
    label: 'Live Data',
    view: 'LiveData',
    icon: <IconAntenna />,
    accent: 'brand',
  },
  {
    id: 'project-timeline',
    label: 'Timeline',
    view: 'ProjectTimeline',
    icon: <IconTimeline />,
    accent: 'purple',
  },
  {
    id: 'tools',
    label: 'Tools',
    view: 'Tools',
    icon: <IconToolbox />,
    accent: 'brand',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    view: 'Notifications',
    icon: <IconBell />,
    accent: 'teal',
  },
  {
    id: 'settings',
    label: 'Settings',
    view: 'Settings',
    icon: <IconSettings />,
    accent: 'gray',
  },
]

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const m = window.matchMedia(query)
    const onChange = () => setMatches(m.matches)
    if (m.addEventListener) m.addEventListener('change', onChange)
    else m.addListener(onChange)
    setMatches(m.matches)
    return () => {
      if (m.removeEventListener) m.removeEventListener('change', onChange)
      else m.removeListener(onChange)
    }
  }, [query])
  return matches
}

function useAccentClass(seed: string, isMain: boolean): string {
  if (isMain) {
    return 'nav-item nav-accent-gray'
  }
  // Stable but simple accent class selection based on id
  const n = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0)
  const i = n % 3
  switch (i) {
    case 0:
      return 'nav-accent-teal'
    case 1:
      return 'nav-accent-purple'
    case 2:
    default:
      return 'nav-accent-brand'
  }
}

export default function SidebarView({}: SidebarProps) {
  const { currentView, navigateView, openModal } = useNavigator()
  const { unreadCount } = useNotifications()
  const { activeProjectId, projects, setActiveProjectId } = useProjectContext()
  const { isAppSettingsLoaded, appSettings, updateAppSettings } = useAppSettings()
  const { runsActive } = useAgents()
  const { groups } = useProjectsGroups()
  const { unreadCountByProject } = useChatUnread()
  const { thinkingCountByProject, anyThinkingForProject } = useChatThinking(500)
  const { getProjectUpdatedBranchesCount } = useGit()

  const [collapsed, setCollapsed] = useState<boolean>(appSettings.userPreferences.sidebarCollapsed)

  useEffect(() => {
    if (isAppSettingsLoaded) {
      setCollapsed(appSettings.userPreferences.sidebarCollapsed)
    }
  }, [isAppSettingsLoaded])
  useEffect(() => {
    updateAppSettings({
      userPreferences: { ...appSettings.userPreferences, sidebarCollapsed: collapsed },
    })
  }, [collapsed])

  const handleProjectSwitch = (projectId: string) => {
    if (projectId === activeProjectId) {
      return
    }
    setActiveProjectId(projectId)
    navigateView(currentView)
  }

  const activeCountByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of runsActive) {
      const k = r.projectId
      map.set(k, (map.get(k) || 0) + 1)
    }
    return map
  }, [runsActive])

  // Active agent runs for the current project for Agents nav badge
  const activeRunsCurrentProject = activeCountByProject.get(activeProjectId) || 0
  const chatUnreadCurrentProject = unreadCountByProject.get(activeProjectId) || 0
  const chatThinkingCurrentProject = anyThinkingForProject(activeProjectId)
  const gitUnreadCurrentProject = getProjectUpdatedBranchesCount(activeProjectId)

  // Track unread notifications per project for badges in the Projects list.
  const [unreadByProject, setUnreadByProject] = useState<Map<string, number>>(new Map())

  const refreshUnreadFor = useCallback(async (projectId: string) => {
    try {
      const count = await notificationsService.getUnreadNotificationsCount(projectId)
      setUnreadByProject((prev) => {
        const next = new Map(prev)
        next.set(projectId, count)
        return next
      })
    } catch (_) {
      // ignore errors; keep previous
    }
  }, [])

  const refreshAllUnread = useCallback(
    async (projectIds: string[]) => {
      await Promise.all(projectIds.map((id) => refreshUnreadFor(id)))
    },
    [refreshUnreadFor],
  )

  useEffect(() => {
    const ids = projects.map((p) => p.id)
    if (ids.length) refreshAllUnread(ids)
  }, [projects.map((p) => p.id).join('|'), refreshAllUnread])

  useEffect(() => {
    // Subscribe to notification changes; update affected project only
    const unsubscribe = notificationsService.subscribe((payload) => {
      const pid = payload?.projectId
      if (pid) refreshUnreadFor(pid)
      else {
        // Unknown project; refresh all to be safe
        const ids = projects.map((p) => p.id)
        if (ids.length) refreshAllUnread(ids)
      }
    })
    return () => unsubscribe()
  }, [projects.map((p) => p.id).join('|'), refreshAllUnread, refreshUnreadFor])

  const isMobile = useMediaQuery('(max-width: 768px)')
  const [mobileOpen, setMobileOpen] = useState<boolean>(false)
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null)
  const firstItemRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (mobileOpen) {
      setTimeout(() => firstItemRef.current?.focus(), 0)
    }
  }, [mobileOpen])

  const activeIndex = useMemo(() => {
    const idx = NAV_ITEMS.findIndex((n) => n.view === currentView)
    return idx >= 0 ? idx : 0
  }, [currentView])
  const [focusIndex, setFocusIndex] = useState<number>(activeIndex)
  useEffect(() => setFocusIndex(activeIndex), [activeIndex])

  const onKeyDownList = useCallback((e: React.KeyboardEvent) => {
    const max = NAV_ITEMS.length - 1
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((i) => (i >= max ? 0 : i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((i) => (i <= 0 ? max : i - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setFocusIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setFocusIndex(max)
    }
  }, [])

  const onActivate = useCallback(
    (view: NavDef['view']) => {
      navigateView(view)
      if (isMobile) {
        setMobileOpen(false)
        setTimeout(() => mobileTriggerRef.current?.focus(), 0)
      }
    },
    [navigateView, isMobile],
  )

  const renderedView = useMemo(() => {
    if (currentView === 'Files')
      return (
        <div key="Files" className="flex flex-col flex-1 min-h-0 view-transition">
          <FilesView />
        </div>
      )
    if (currentView === 'Settings')
      return (
        <div key="Settings" className="flex flex-col flex-1 min-h-0 view-transition">
          <SettingsView />
        </div>
      )
    if (currentView === 'Chat')
      return (
        <div key="Chat" className="flex flex-col flex-1 min-h-0 view-transition">
          <ChatView />
        </div>
      )
    if (currentView === 'Notifications')
      return (
        <div key="Notifications" className="flex flex-col flex-1 min-h-0 view-transition">
          <NotificationsView />
        </div>
      )
    if (currentView === 'Agents')
      return (
        <div key="Agents" className="flex flex-col flex-1 min-h-0 view-transition">
          <AgentsView />
        </div>
      )
    if (currentView === 'Git')
      return (
        <div key="Git" className="flex flex-col flex-1 min-h-0 view-transition">
          <GitView />
        </div>
      )
    if (currentView === 'Tests')
      return (
        <div key="Tests" className="flex flex-col flex-1 min-h-0 view-transition">
          <TestsView />
        </div>
      )
    if (currentView === 'LiveData')
      return (
        <div key="LiveData" className="flex flex-col flex-1 min-h-0 view-transition">
          <LiveDataView />
        </div>
      )
    if (currentView === 'ProjectTimeline')
      return (
        <div key="ProjectTimeline" className="flex flex-col flex-1 min-h-0 view-transition">
          <ProjectTimelineView />
        </div>
      )
    if (currentView === 'Tools')
      return (
        <div key="Tools" className="flex flex-col flex-1 min-h-0 view-transition">
          <ToolsScreen />
        </div>
      )
    return (
      <div key="Home" className="flex flex-col flex-1 min-h-0 view-transition">
        <StoriesView />
      </div>
    )
  }, [currentView])

  const effectiveCollapsed = isMobile ? false : collapsed

  // Expanded/collapsed state for project groups in sidebar (default closed)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  useEffect(() => {
    setOpenGroups((prev) => {
      const next: Record<string, boolean> = { ...prev }
      for (const g of groups) {
        if (!(g.id in next)) next[g.id] = false // start closed
      }
      // Remove any no-longer-existing groups keys
      const validIds = new Set(groups.map((g) => g.id))
      for (const k of Object.keys(next)) {
        if (!validIds.has(k)) delete next[k]
      }
      return next
    })
  }, [groups.map((g) => g.id).join('|')])

  const groupedProjectIds = useMemo(() => new Set(groups.flatMap((g) => g.projects || [])), [groups])
  const uncategorizedProjects = useMemo(
    () => projects.filter((p) => !groupedProjectIds.has(p.id)),
    [projects, groupedProjectIds],
  )

  const cap99 = (n: number) => (n > 99 ? '99+' : `${n}`)

  const renderProjectItem = (p: ProjectSpec) => {
    const isMain = p.id === MAIN_PROJECT
    const active = activeProjectId === p.id
    const accent = useAccentClass(p.id, isMain)
    const activeCount = activeCountByProject.get(p.id) || 0
    const unread = unreadByProject.get(p.id) || 0 // notifications (system)
    const chatUnread = unreadCountByProject.get(p.id) || 0 // chats
    const chatThinking = (thinkingCountByProject.get(p.id) || 0) > 0
    const gitUnread = getProjectUpdatedBranchesCount(p.id)
    const iconKey = p.metadata?.icon || (isMain ? 'collection' : 'folder')
    const projectIcon = renderProjectIcon(iconKey)
    const hasAnyBadge = activeCount > 0 || unread > 0 || chatUnread > 0 || chatThinking || gitUnread > 0

    const Btn = (
      <button
        className={classNames(
          'nav-item flex-1',
          accent,
          active && 'nav-item--active',
          effectiveCollapsed && 'nav-item--compact',
        )}
        aria-current={active ? 'true' : undefined}
        onClick={() => handleProjectSwitch(p.id)}
        title={p.title}
      >
        <span className="nav-item__icon" aria-hidden>
          {projectIcon}
        </span>
        {!effectiveCollapsed && <span className="nav-item__label">{p.title}</span>}

        {hasAnyBadge && (
          <span
            className={classNames(
              'nav-item__badges',
              effectiveCollapsed && 'nav-item__badges--compact',
            )}
            aria-hidden
          >
            {activeCount > 0 && (
              <NotificationBadge
                className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                text={`${activeCount}`}
                tooltipLabel={`${activeCount} running agents`}
                isInformative
              />
            )}
            {chatThinking && !active ? (
              <SpinnerWithDot
                size={effectiveCollapsed ? 14 : 16}
                showDot={chatUnread > 0}
                className={effectiveCollapsed ? '' : ''}
                dotTitle={chatUnread > 0 ? `${chatUnread} unread chats` : undefined}
              />
            ) : chatUnread > 0 ? (
              <NotificationBadge
                className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                text={cap99(chatUnread)}
                tooltipLabel={`${chatUnread} unread chats`}
              />
            ) : null}
            {unread > 0 && (
              <NotificationBadge
                className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                text={`${unread}`}
                tooltipLabel={`${unread} unread notifications`}
              />
            )}
            {gitUnread > 0 && (
              <NotificationBadge
                className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                text={`${gitUnread}`}
                tooltipLabel={`${gitUnread} updated ${gitUnread === 1 ? 'branch' : 'branches'}`}
                color="green"
              />
            )}
          </span>
        )}
      </button>
    )

    return (
      <li className="nav-li" key={p.id}>
        {effectiveCollapsed ? (
          <Tooltip content={p.title} placement="right">{Btn}</Tooltip>
        ) : (
          Btn
        )}
      </li>
    )
  }

  // Sidebar element (shared for desktop and mobile drawer)
  const Aside = (
    <aside
      className={`sidebar relative z-30 flex h-full shrink-0 flex-col overflow-hidden border-r bg-white dark:bg-neutral-900 dark:border-neutral-800 ${effectiveCollapsed ? 'collapsed' : ''}`}
      aria-label="Primary navigation"
      data-collapsed={effectiveCollapsed ? 'true' : 'false'}
      style={{}}
    >
      <div
        className={`mb-2 flex items-center ${effectiveCollapsed ? 'justify-center' : 'justify-between'} px-2 pt-3`}
      >
        {!effectiveCollapsed && (
          <div className="px-1">
            <div className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              The Overseer
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
              powered by TheFactory
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => (isMobile ? setMobileOpen(false) : setCollapsed((v) => !v))}
          className="nav-toggle"
          aria-label={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!effectiveCollapsed}
          title={effectiveCollapsed ? 'Expand sidebar (⌘/Ctrl+B)' : 'Collapse sidebar (⌘/Ctrl+B)'}
        >
          <span aria-hidden>
            <IconChevron
              className="w-4 h-4"
              style={{ transform: effectiveCollapsed ? 'none' : 'rotate(180deg)' }}
            />
          </span>
        </button>
      </div>

      <nav
        className="nav flex-1 min-h-0 overflow-y-auto"
        style={hideScrollStyle}
        onKeyDown={onKeyDownList}
      >
        <ul className="nav-list" role="list">
          {NAV_ITEMS.filter((n) => n.view !== 'Settings').map((item, i) => {
            const isActive = currentView === item.view
            const ref = i === 0 ? firstItemRef : undefined

            // Decide badge for Notifications, Git, Agents, or Chat
            let badgeEl: React.ReactNode | null = null
            if (item.view === 'Notifications' && unreadCount > 0) {
              badgeEl = (
                <NotificationBadge
                  className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                  text={`${unreadCount}`}
                  tooltipLabel={`${unreadCount} unread notifications`}
                />
              )
            } else if (item.view === 'Git' && gitUnreadCurrentProject > 0) {
              badgeEl = (
                <NotificationBadge
                  className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                  text={`${gitUnreadCurrentProject}`}
                  tooltipLabel={`${gitUnreadCurrentProject} updated ${gitUnreadCurrentProject === 1 ? 'branch' : 'branches'}`}
                  color="green"
                />
              )
            } else if (item.view === 'Agents' && activeRunsCurrentProject > 0) {
              badgeEl = (
                <NotificationBadge
                  className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                  text={`${activeRunsCurrentProject}`}
                  tooltipLabel={`${activeRunsCurrentProject} running agents`}
                  isInformative
                />
              )
            } else if (item.view === 'Chat') {
              if (chatThinkingCurrentProject) {
                badgeEl = (
                  <SpinnerWithDot
                    size={effectiveCollapsed ? 14 : 16}
                    showDot={chatUnreadCurrentProject > 0}
                    dotTitle={
                      chatUnreadCurrentProject > 0
                        ? `${chatUnreadCurrentProject} unread chats`
                        : undefined
                    }
                  />
                )
              } else if (chatUnreadCurrentProject > 0) {
                badgeEl = (
                  <NotificationBadge
                    className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
                    text={cap99(chatUnreadCurrentProject)}
                    tooltipLabel={`${chatUnreadCurrentProject} unread chats`}
                  />
                )
              }
            }

            const Btn = (
              <button
                ref={ref as any}
                type="button"
                className={`nav-item ${isActive ? 'nav-item--active' : ''} ${effectiveCollapsed ? 'nav-item--compact' : ''} nav-accent-${item.accent ?? 'brand'}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onActivate(item.view)}
                title={item.label}
                tabIndex={focusIndex === i ? 0 : -1}
                onFocus={() => setFocusIndex(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onActivate(item.view)
                  }
                }}
              >
                <span className="nav-item__icon">{item.icon}</span>
                {!effectiveCollapsed && <span className="nav-item__label">{item.label}</span>}
                {badgeEl && (
                  <span
                    className={classNames(
                      'nav-item__badges',
                      effectiveCollapsed && 'nav-item__badges--compact',
                    )}
                    aria-hidden
                  >
                    {badgeEl}
                  </span>
                )}
              </button>
            )
            return (
              <li key={item.id} className="nav-li">
                {effectiveCollapsed ? (
                  <Tooltip content={item.label} placement="right">
                    {Btn}
                  </Tooltip>
                ) : (
                  Btn
                )}
              </li>
            )
          })}
        </ul>

        <div className="nav-sep" aria-hidden />

        {!effectiveCollapsed && (
          <div className="px-3" aria-hidden>
            <div
              style={{
                color: 'var(--text-secondary)',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span>Projects</span>
              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <span>{projects.length}</span>
                <button
                  className="btn-secondary"
                  style={{ padding: '0 8px', height: 24, fontSize: 12 }}
                  onClick={() => openModal({ type: 'projects-manage' })}
                >
                  Manage
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Projects listing: uncategorized first, then grouped with collapsible sections */}
        <ul className="nav-list" aria-label="Projects">
          {projects.length == 0 && (
            <li className="nav-li">
              <div
                className={classNames('nav-item', effectiveCollapsed && 'nav-item--compact')}
                role="status"
              >
                <span className="nav-item__icon" aria-hidden>
                  <IconWarningTriangle />
                </span>
                {!effectiveCollapsed && <span className="nav-item__label">Failed to load</span>}
              </div>
            </li>
          )}

          {/* Uncategorized projects at the top */}
          {uncategorizedProjects.map((p) => renderProjectItem(p))}

          {/* Grouped projects as collapsible sections */}
          {!effectiveCollapsed &&
            groups.map((g) => {
              const projectById = new Map(projects.map((p) => [p.id, p]))
              const groupProjects = (g.projects || [])
                .map((pid) => projectById.get(pid))
                .filter(Boolean) as ProjectSpec[]
              const isOpen = openGroups[g.id] || false

              // Determine if the active project is within this group
              const hasActive = !!groupProjects.find((p) => p.id === activeProjectId)
              const accentClass = hasActive
                ? useAccentClass(activeProjectId, activeProjectId === MAIN_PROJECT)
                : ''

              // Aggregate badges across group projects
              const aggActive = (g.projects || []).reduce(
                (sum, pid) => sum + (activeCountByProject.get(pid) || 0),
                0,
              )
              const aggUnread = (g.projects || []).reduce(
                (sum, pid) => sum + (unreadByProject.get(pid) || 0),
                0,
              )
              const aggChatUnread = (g.projects || []).reduce(
                (sum, pid) => sum + (unreadCountByProject.get(pid) || 0),
                0,
              )
              const aggThinking = (g.projects || []).reduce(
                (sum, pid) => sum + (thinkingCountByProject.get(pid) || 0),
                0,
              )
              const aggGitUnread = (g.projects || []).reduce(
                (sum, pid) => sum + getProjectUpdatedBranchesCount(pid),
                0,
              )
              const showAnyBadge =
                aggActive > 0 ||
                aggUnread > 0 ||
                aggChatUnread > 0 ||
                aggThinking > 0 ||
                aggGitUnread > 0

              return (
                <li key={g.id} className="nav-li">
                  <button
                    type="button"
                    onClick={() => setOpenGroups((prev) => ({ ...prev, [g.id]: !isOpen }))}
                    className={classNames(
                      'nav-item',
                      'nav-item--compact',
                      accentClass,
                      hasActive && 'nav-item--active',
                    )}
                    aria-expanded={isOpen}
                    aria-controls={`group-${g.id}`}
                    title={g.title}
                  >
                    <span className="nav-item__icon" aria-hidden>
                      <IconChevron
                        className="w-4 h-4"
                        style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}
                      />
                    </span>
                    <span className="nav-item__label flex-1 text-left">{g.title}</span>

                    {showAnyBadge && !isOpen && (
                      <span className="nav-item__badges" aria-hidden>
                        {aggActive > 0 && (
                          <NotificationBadge
                            className={''}
                            text={`${aggActive}`}
                            tooltipLabel={`${aggActive} running agents in group`}
                            isInformative
                          />
                        )}
                        {aggThinking > 0 ? (
                          <SpinnerWithDot
                            size={16}
                            showDot={aggChatUnread > 0}
                            dotTitle={aggChatUnread > 0 ? `${aggChatUnread} unread chats in group` : undefined}
                          />
                        ) : aggChatUnread > 0 ? (
                          <NotificationBadge
                            className={''}
                            text={cap99(aggChatUnread)}
                            tooltipLabel={`${aggChatUnread} unread chats in group`}
                          />
                        ) : null}
                        {aggUnread > 0 && (
                          <NotificationBadge
                            className={''}
                            text={`${aggUnread}`}
                            tooltipLabel={`${aggUnread} unread notifications in group`}
                          />
                        )}
                        {aggGitUnread > 0 && (
                          <NotificationBadge
                            className={''}
                            text={`${aggGitUnread}`}
                            tooltipLabel={`${aggGitUnread} updated ${aggGitUnread === 1 ? 'branch' : 'branches'} in group`}
                            color="green"
                          />
                        )}
                      </span>
                    )}
                  </button>

                  {isOpen && groupProjects.length > 0 && (
                    <ul id={`group-${g.id}`} className="nav-list" aria-label={`${g.title} projects`}>
                      {groupProjects.map((p) => renderProjectItem(p))}
                    </ul>
                  )}
                </li>
              )
            })}
        </ul>
      </nav>

      {/* Fixed footer: Settings at the bottom, does not scroll */}
      <div className="shrink-0" aria-label="Footer">
        <div className="nav-sep" aria-hidden />
        <ul className="nav-list" role="list" onKeyDown={onKeyDownList}>
          {NAV_ITEMS.filter((n) => n.view === 'Settings').map((item) => {
            const idx = NAV_ITEMS.findIndex((n) => n.view === item.view)
            const isActive = currentView === item.view
            const Btn = (
              <button
                type="button"
                className={`nav-item ${isActive ? 'nav-item--active' : ''} ${effectiveCollapsed ? 'nav-item--compact' : ''} nav-accent-${item.accent ?? 'gray'}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onActivate(item.view)}
                title={item.label}
                tabIndex={focusIndex === idx ? 0 : -1}
                onFocus={() => setFocusIndex(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onActivate(item.view)
                  }
                }}
              >
                <span className="nav-item__icon">{item.icon}</span>
                {!effectiveCollapsed && <span className="nav-item__label">{item.label}</span>}
              </button>
            )
            return (
              <li key={item.id} className="nav-li">
                {effectiveCollapsed ? (
                  <Tooltip content={item.label} placement="right">
                    {Btn}
                  </Tooltip>
                ) : (
                  Btn
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )

  return (
    <div className="flex h-full w-full min-w-0">
      {isMobile ? (
        <>
          {mobileOpen && (
            <>
              <div
                className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
                aria-hidden
              />
              <div className="fixed inset-y-0 left-0 z-30" style={{ width: 260 }}>
                {React.cloneElement(Aside, {
                  className: `${Aside.props.className} drawer-open`,
                  'data-collapsed': 'false',
                })}
              </div>
            </>
          )}
        </>
      ) : (
        Aside
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="md:hidden sticky top-0 z-10 flex items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <button
            ref={mobileTriggerRef}
            type="button"
            className="nav-trigger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <IconMenu />
          </button>
          <div className="text-sm font-semibold">{currentView}</div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{renderedView}</div>
      </main>
    </div>
  )
}
