import { useNavigate, useParams } from 'react-router-dom'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { getChatContextKey } from '@core/chats/chatKey'
import ChatBodyForContext, { type ChatBodyForContextProps } from './ChatBodyForContext'
import ChatHeaderConnected from './ChatHeaderConnected'

export type ChatPanelBodyProps = {
  context: ChatContext
  /** The host's own name for the chat; the chat's own title when absent. */
  chatContextTitle?: string
  /**
   * Dismiss affordance — collapses the docked sidebar. Wired to the header's
   * collapse button.
   */
  onCollapse: () => void
  /** The composer's focus on opening and its placeholder. */
  inputProps?: ChatBodyForContextProps['inputProps']
  /** Docked beside what the chat is about (a run's chat beside its run): the slim header with this label. */
  dockedLabel?: string
}

/**
 * Fully-wired chat surface for a single context — `ChatBodyForContext` under
 * the connected chat header, hosted by `ChatSidebarPanelConnected` (docked).
 * Mirrors web's same-named component.
 */
export default function ChatPanelBody({
  context,
  chatContextTitle,
  onCollapse,
  inputProps,
  dockedLabel,
}: ChatPanelBodyProps): React.JSX.Element {
  const navigate = useNavigate()
  const { projectId: urlProjectId } = useParams<{ projectId: string }>()

  const openChat = (target: ChatContext): void => {
    const projectId = target.projectId ?? urlProjectId
    if (!projectId) return
    navigate(`/projects/${projectId}/chat/${encodeURIComponent(getChatContextKey(target))}`)
  }

  return (
    <div className="relative h-full flex flex-col bg-(--surface-base)">
      <ChatBodyForContext
        context={context}
        {...(inputProps ? { inputProps } : {})}
        header={
          <ChatHeaderConnected
            context={context}
            title={chatContextTitle}
            narrow
            onOpenChat={openChat}
            onCollapse={onCollapse}
            onMaximize={() => openChat(context)}
            {...(dockedLabel !== undefined ? { dockedLabel } : {})}
          />
        }
      />
    </div>
  )
}
