import React from 'react'
import { ProjectSpec } from 'thefactory-tools'
import Tooltip from '../../components/ui/Tooltip'
import NotificationBadge, { getBadgeColorClass } from '../../components/stories/NotificationBadge'
import SpinnerWithDot from '../../components/ui/SpinnerWithDot'
import { renderProjectIcon } from '@renderer/screens/projects/projectIcons'
import { useNotifications } from '@renderer/hooks/useNotifications'
import { useAppSettings } from '../../contexts/AppSettingsContext'
import { classNames, useAccentClass } from '../utils'

type ProjectNavItemProps = {
  project: ProjectSpec
  active: boolean
  effectiveCollapsed: boolean
  onSwitch: (projectId: string) => void
}

const cap99 = (n: number) => (n > 99 ? '99+' : `${n}`)

export default function ProjectNavItem({
  project: p,
  active,
  effectiveCollapsed,
  onSwitch,
}: ProjectNavItemProps) {
  const { isBadgeEnabled, isGitBadgeSubToggleEnabled, getProjectBadgeState } = useNotifications()
  const { appSettings } = useAppSettings()

  const chatBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.chat_messages
  const agentBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.agent_runs
  const gitBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.git_changes

  const chatColorClass = getBadgeColorClass(chatBadgeColor)
  const agentColorClass = getBadgeColorClass(agentBadgeColor, true)
  const gitColorClass = getBadgeColorClass(gitBadgeColor)

  const accent = useAccentClass(p.id, false)

  const st = getProjectBadgeState(p.id)
  const activeRuns = st.agent_runs.running
  const agentsCompletedUnread = st.agent_runs.unread
  const chatUnread = st.chat_messages.unread
  const thinking = st.chat_messages.thinking
  const gitIncoming = st.git_changes.incoming
  const gitUncommitted = st.git_changes.uncommitted

  const iconKey = p.metadata?.icon || 'folder'
  const projectIcon = renderProjectIcon(iconKey)

  const showAgents = isBadgeEnabled('agent_runs') && activeRuns > 0 && !active
  const showAgentsCompleted = isBadgeEnabled('agent_runs') && agentsCompletedUnread > 0 && !active
  const showChat = isBadgeEnabled('chat_messages') && (chatUnread > 0 || thinking) && !active

  const gitBadgesEnabled = isBadgeEnabled('git_changes') && !active
  const showGitIncoming =
    gitBadgesEnabled && isGitBadgeSubToggleEnabled('incoming_commits') && gitIncoming > 0
  const showGitUncommitted =
    gitBadgesEnabled && isGitBadgeSubToggleEnabled('uncommitted_changes') && gitUncommitted

  const hasAnyBadge =
    showAgents || showAgentsCompleted || showChat || showGitIncoming || showGitUncommitted

  const Btn = (
    <button
      type="button"
      onClick={() => onSwitch(p.id)}
      className={classNames(
        'nav-item flex-1',
        accent,
        active && 'nav-item--active',
        effectiveCollapsed && 'nav-item--compact',
      )}
      title={p.title}
      aria-current={active ? 'page' : undefined}
    >
      <span className="nav-item__icon" aria-hidden>
        {projectIcon}
      </span>
      {!effectiveCollapsed && <span className="nav-item__label flex-1 text-left">{p.title}</span>}

      {hasAnyBadge && (
        <span
          className={classNames(
            'nav-item__badges',
            effectiveCollapsed && 'nav-item__badges--compact',
          )}
          aria-hidden
        >
          {showAgents && (
            <NotificationBadge
              className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
              text={`${activeRuns}`}
              tooltipLabel={`${activeRuns} running agents`}
              isInformative
              colorClass={agentColorClass}
            />
          )}
          {showAgentsCompleted && (
            <NotificationBadge
              className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
              text={cap99(agentsCompletedUnread)}
              tooltipLabel={`${agentsCompletedUnread} completed agent runs`}
              colorClass={agentColorClass}
            />
          )}
          {showChat && thinking ? (
            <SpinnerWithDot
              size={effectiveCollapsed ? 14 : 16}
              showDot={chatUnread > 0}
              dotTitle={chatUnread > 0 ? `${chatUnread} unread chats` : undefined}
              dotColorClass={chatColorClass}
            />
          ) : showChat && chatUnread > 0 ? (
            <NotificationBadge
              className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
              text={cap99(chatUnread)}
              tooltipLabel={`${chatUnread} unread chats`}
              colorClass={chatColorClass}
            />
          ) : null}
          {showGitIncoming && (
            <NotificationBadge
              className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
              text={`${gitIncoming}↓`}
              tooltipLabel={`${gitIncoming} incoming commits`}
              colorClass={gitColorClass}
            />
          )}
          {showGitUncommitted && (
            <NotificationBadge
              className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
              text={`*`}
              tooltipLabel={`Uncommitted changes`}
              colorClass={gitColorClass}
            />
          )}
        </span>
      )}
    </button>
  )

  return (
    <li className="nav-li">
      {effectiveCollapsed ? (
        <Tooltip content={p.title} placement="right">
          {Btn}
        </Tooltip>
      ) : (
        Btn
      )}
    </li>
  )
}
