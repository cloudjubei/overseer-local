import React from 'react'
import { NavDef } from './constants'
import { classNames } from '../utils'
import Tooltip from '../../components/ui/Tooltip'
import NotificationBadge, { getBadgeColorClass } from '../../components/stories/NotificationBadge'
import SpinnerWithDot from '../../components/ui/SpinnerWithDot'
import { useNotifications } from '@renderer/hooks/useNotifications'
import { useAppSettings } from '../../contexts/AppSettingsContext'

const cap99 = (n: number) => (n > 99 ? '99+' : `${n}`)

type StaticNavItemProps = {
  item: NavDef
  isActive: boolean
  effectiveCollapsed: boolean
  focusIndex: number
  index: number
  setFocusIndex: (i: number) => void
  onActivate: (view: NavDef['view']) => void
  isFirst?: boolean
  firstItemRef?: React.RefObject<HTMLButtonElement | null>

  // Current scope badges
  activeRunsCurrentProject: number
  agentsCompletedUnreadCurrentProject: number
  chatUnreadCurrentProject: number
  chatThinkingCurrentProject: boolean
  gitIncomingCurrentProject: number
  gitUncommittedCurrentProject: boolean
}

export default function StaticNavItem({
  item,
  isActive,
  effectiveCollapsed,
  focusIndex,
  index,
  setFocusIndex,
  onActivate,
  isFirst,
  firstItemRef,
  activeRunsCurrentProject,
  agentsCompletedUnreadCurrentProject,
  chatUnreadCurrentProject,
  chatThinkingCurrentProject,
  gitIncomingCurrentProject,
  gitUncommittedCurrentProject,
}: StaticNavItemProps) {
  const { isBadgeEnabled, isGitBadgeSubToggleEnabled } = useNotifications()
  const { appSettings } = useAppSettings()

  const chatBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.chat_messages
  const agentBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.agent_runs
  const gitBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.git_changes

  const chatColorClass = getBadgeColorClass(chatBadgeColor)
  const agentColorClass = getBadgeColorClass(agentBadgeColor, true)
  const gitColorClass = getBadgeColorClass(gitBadgeColor)

  const BtnBadges = () => {
    if (item.view === 'Agents' && isBadgeEnabled('agent_runs')) {
      const parts: React.ReactNode[] = []
      if (activeRunsCurrentProject > 0) {
        parts.push(
          <NotificationBadge
            key="agent-running"
            className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
            text={`${activeRunsCurrentProject}`}
            tooltipLabel={`${activeRunsCurrentProject} running agents`}
            isInformative
            colorClass={agentColorClass}
          />,
        )
      }
      if (agentsCompletedUnreadCurrentProject > 0) {
        parts.push(
          <NotificationBadge
            key="agent-unread"
            className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
            text={cap99(agentsCompletedUnreadCurrentProject)}
            tooltipLabel={`${agentsCompletedUnreadCurrentProject} completed agent runs`}
            colorClass={agentColorClass}
          />,
        )
      }
      return parts.length ? <>{parts}</> : null
    }
    if (item.view === 'Git' && isBadgeEnabled('git_changes')) {
      const parts: React.ReactNode[] = []

      if (isGitBadgeSubToggleEnabled('incoming_commits') && gitIncomingCurrentProject > 0) {
        parts.push(
          <NotificationBadge
            key="git-incoming"
            className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
            text={`${gitIncomingCurrentProject}↓`}
            tooltipLabel={`${gitIncomingCurrentProject} incoming commits`}
            colorClass={gitColorClass}
          />,
        )
      }

      if (isGitBadgeSubToggleEnabled('uncommitted_changes') && gitUncommittedCurrentProject) {
        parts.push(
          <NotificationBadge
            key="git-uncommitted"
            className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
            text={`*`}
            tooltipLabel={`Uncommitted changes`}
            colorClass={gitColorClass}
          />,
        )
      }

      return parts.length ? <>{parts}</> : null
    }
    if (item.view === 'Chat' && isBadgeEnabled('chat_messages')) {
      const parts: React.ReactNode[] = []
      if (chatThinkingCurrentProject) {
        parts.push(
          <SpinnerWithDot
            key="chat-thinking"
            size={effectiveCollapsed ? 14 : 16}
            showDot={chatUnreadCurrentProject > 0}
            dotTitle={
              chatUnreadCurrentProject > 0 ? `${chatUnreadCurrentProject} unread chats` : undefined
            }
            dotColorClass={chatColorClass}
          />,
        )
      } else if (chatUnreadCurrentProject > 0) {
        parts.push(
          <NotificationBadge
            key="chat-unread"
            className={effectiveCollapsed ? 'h-[14px] min-w-[14px] px-0.5 text-[6px]' : ''}
            text={cap99(chatUnreadCurrentProject)}
            tooltipLabel={`${chatUnreadCurrentProject} unread chats`}
            colorClass={chatColorClass}
          />,
        )
      }

      return parts.length ? <>{parts}</> : null
    }
    return null
  }

  const Btn = (
    <button
      ref={isFirst ? firstItemRef : null}
      type="button"
      className={`nav-item ${isActive ? 'nav-item--active' : ''} ${effectiveCollapsed ? 'nav-item--compact' : ''} nav-accent-${item.accent ?? 'brand'}`}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onActivate(item.view)}
      title={item.label}
      tabIndex={focusIndex === index ? 0 : -1}
      onFocus={() => setFocusIndex(index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate(item.view)
        }
      }}
    >
      <span className="nav-item__icon">{item.icon}</span>
      {!effectiveCollapsed && <span className="nav-item__label">{item.label}</span>}
      {(() => {
        const content = BtnBadges()
        return content ? (
          <span
            className={classNames(
              'nav-item__badges',
              effectiveCollapsed && 'nav-item__badges--compact',
            )}
            aria-hidden
          >
            {content}
          </span>
        ) : null
      })()}
    </button>
  )

  return (
    <li className="nav-li">
      {effectiveCollapsed ? (
        <Tooltip content={item.label} placement="right">
          {Btn}
        </Tooltip>
      ) : (
        Btn
      )}
    </li>
  )
}
