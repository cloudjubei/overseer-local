import React, { useEffect, useState } from 'react'
import { ProjectsGroup, ProjectSpec } from 'thefactory-tools'
import NotificationBadge, { getBadgeColorClass } from '../../components/stories/NotificationBadge'
import SpinnerWithDot from '../../components/ui/SpinnerWithDot'
import { IconFolder, IconFolderOpen, IconCollection } from '../../components/ui/icons/Icons'
import ProjectNavItem from './ProjectNavItem'
import { useNotifications } from '@renderer/hooks/useNotifications'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { classNames } from '../utils'

type GroupNavItemProps = {
  group: ProjectsGroup
  groupProjects: ProjectSpec[]
  isActiveGroup: boolean
  activeProjectId?: string
  activeSelectionType: 'project' | 'group'
  effectiveCollapsed: boolean
  onGroupSelect: (groupId: string) => void
  onProjectSwitch: (projectId: string) => void
}

const cap99 = (n: number) => (n > 99 ? '99+' : `${n}`)

export default function GroupNavItem({
  group: g,
  groupProjects,
  isActiveGroup,
  activeProjectId,
  activeSelectionType,
  effectiveCollapsed,
  onGroupSelect,
  onProjectSwitch,
}: GroupNavItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { isBadgeEnabled, isGitBadgeSubToggleEnabled, getGroupBadgeState } = useNotifications()
  const { appSettings } = useAppSettings()

  const isScope = g.type === 'SCOPE'

  // Auto-expand if the active project is in this group (MAIN only)
  const isActiveProjectInGroup =
    !isScope &&
    activeSelectionType === 'project' &&
    activeProjectId &&
    groupProjects.some((p) => p.id === activeProjectId)

  useEffect(() => {
    if (isActiveProjectInGroup) {
      setIsOpen(true)
    }
  }, [isActiveProjectInGroup])

  const chatBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.chat_messages
  const agentBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.agent_runs
  const gitBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.git_changes

  const chatColorClass = getBadgeColorClass(chatBadgeColor)
  const agentColorClass = getBadgeColorClass(agentBadgeColor, true)
  const gitColorClass = getBadgeColorClass(gitBadgeColor)

  const accentClass = isActiveGroup ? 'nav-accent-brand' : ''

  const groupBadge = getGroupBadgeState(g.id)

  const aggActive = groupBadge.agent_runs.running
  const aggAgentsCompletedUnread = groupBadge.agent_runs.unread
  const aggChatUnread = groupBadge.chat_messages.unread
  const aggThinking = groupBadge.chat_messages.thinking ? 1 : 0
  const aggGitIncoming = groupBadge.git_changes.incoming
  const aggGitUncommitted = groupBadge.git_changes.uncommitted

  const aggShowAgents = isBadgeEnabled('agent_runs') && aggActive > 0
  const aggShowAgentsCompleted = isBadgeEnabled('agent_runs') && aggAgentsCompletedUnread > 0
  const aggShowChat = isBadgeEnabled('chat_messages') && (aggChatUnread > 0 || aggThinking > 0)

  const aggShowGitIncoming =
    isBadgeEnabled('git_changes') &&
    isGitBadgeSubToggleEnabled('incoming_commits') &&
    aggGitIncoming > 0
  const aggShowGitUncommitted =
    isBadgeEnabled('git_changes') &&
    isGitBadgeSubToggleEnabled('uncommitted_changes') &&
    aggGitUncommitted

  const showAnyBadge =
    aggShowAgents ||
    aggShowAgentsCompleted ||
    aggShowChat ||
    aggShowGitIncoming ||
    aggShowGitUncommitted

  // Badge visibility rules:
  // - SCOPE groups: hide badges when this group IS active (the Chat nav item takes over)
  // - MAIN groups: hide badges when this group IS active OR when it is expanded (projects show their own)
  const showBadges = showAnyBadge && (isScope ? !isActiveGroup : !isActiveGroup && !isOpen)

  return (
    <li className="nav-li">
      <div
        className={classNames(
          'nav-item',
          'pl-0 gap-0',
          accentClass,
          isActiveGroup && 'nav-item--active',
        )}
      >
        {isScope ? (
          /* SCOPE: static collection icon, same width as the MAIN folder button so labels align */
          <span
            className="flex items-center justify-center h-full w-[42px] shrink-0"
            aria-hidden
          >
            <IconCollection className="w-4 h-4" />
          </span>
        ) : (
          /* MAIN: clickable folder icon that toggles expand/collapse */
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 h-full w-[42px] rounded-l shrink-0"
            aria-expanded={isOpen}
            aria-controls={`group-${g.id}`}
          >
            {isOpen ? (
              <IconFolderOpen className="w-4 h-4" />
            ) : (
              <IconFolder className="w-4 h-4" />
            )}
          </button>
        )}

        <button
          type="button"
          className="nav-item__label flex-1 text-left font-medium outline-none truncate h-full flex items-center"
          onClick={() => onGroupSelect(g.id)}
        >
          {g.title}
        </button>

        {showBadges && (
          <span className="nav-item__badges" aria-hidden>
            {aggShowAgents && (
              <NotificationBadge
                className={''}
                text={`${aggActive}`}
                tooltipLabel={`${aggActive} running agents in group`}
                isInformative
                colorClass={agentColorClass}
              />
            )}
            {aggShowAgentsCompleted && (
              <NotificationBadge
                className={''}
                text={cap99(aggAgentsCompletedUnread)}
                tooltipLabel={`${aggAgentsCompletedUnread} completed agent runs in group`}
                colorClass={agentColorClass}
              />
            )}
            {aggShowChat && aggThinking > 0 ? (
              <SpinnerWithDot
                size={16}
                showDot={aggChatUnread > 0}
                dotTitle={aggChatUnread > 0 ? `${aggChatUnread} unread chats in group` : undefined}
                dotColorClass={chatColorClass}
              />
            ) : aggShowChat && aggChatUnread > 0 ? (
              <NotificationBadge
                className={''}
                text={cap99(aggChatUnread)}
                tooltipLabel={`${aggChatUnread} unread chats in group`}
                colorClass={chatColorClass}
              />
            ) : null}
            {aggShowGitIncoming && (
              <NotificationBadge
                className={''}
                text={`${aggGitIncoming}↓`}
                tooltipLabel={`${aggGitIncoming} incoming commits in group`}
                colorClass={gitColorClass}
              />
            )}
            {aggShowGitUncommitted && (
              <NotificationBadge
                className={''}
                text={`*`}
                tooltipLabel={`Uncommitted changes in group`}
                colorClass={gitColorClass}
              />
            )}
          </span>
        )}
      </div>

      {/* Expandable project list — MAIN groups only */}
      {!isScope && isOpen && (
        <div className="pl-3 mt-1 flex flex-col gap-1">
          <ul id={`group-${g.id}`} className="nav-list" aria-label={`${g.title} projects`}>
            {groupProjects.map((p) => (
              <ProjectNavItem
                key={p.id}
                project={p}
                active={activeSelectionType === 'project' && activeProjectId === p.id}
                effectiveCollapsed={effectiveCollapsed}
                onSwitch={onProjectSwitch}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}
