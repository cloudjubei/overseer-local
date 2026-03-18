import React, { useState } from 'react'
import { ProjectGroup } from 'thefactory-tools'
import { ProjectSpec } from 'thefactory-tools'
import NotificationBadge, { getBadgeColorClass } from '../../components/stories/NotificationBadge'
import SpinnerWithDot from '../../components/ui/SpinnerWithDot'
import { IconChevron } from '../../components/ui/icons/Icons'
import ProjectNavItem from './ProjectNavItem'
import { useNotifications } from '@renderer/hooks/useNotifications'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { classNames } from '../utils'

type GroupNavItemProps = {
  group: ProjectGroup
  groupProjects: ProjectSpec[]
  isActiveGroup: boolean
  activeProjectId: string | null
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

  return (
    <li className="nav-li">
      <div
        className={classNames(
          'nav-item',
          'nav-item--compact',
          accentClass,
          isActiveGroup && 'nav-item--active',
        )}
      >
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="nav-item__icon flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 rounded"
          aria-expanded={isOpen}
          aria-controls={`group-${g.id}`}
        >
          <IconChevron
            className="w-4 h-4"
            style={{
              transform: isOpen ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>
        <button
          type="button"
          className="nav-item__label flex-1 text-left font-medium outline-none truncate"
          onClick={() => onGroupSelect(g.id)}
        >
          {g.title}
        </button>

        {showAnyBadge && !isOpen && (
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
                dotTitle={
                  aggChatUnread > 0 ? `${aggChatUnread} unread chats in group` : undefined
                }
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

      {isOpen && (
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
