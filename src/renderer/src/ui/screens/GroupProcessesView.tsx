import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RUN_CHAT_PLACEHOLDER, type ProcessNodeRunRef } from 'thefactory-ui/headless'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { ProcessGroupRunsView } from 'thefactory-ui/web'
import { getChatContext, getChatContextKey } from '@core/chats/chatKey'
import ChatBodyForContext from '@ui/components/chat/ChatBodyForContext'

/**
 * A group's Processes tab: its group runs, each one piece of work carried
 * across several of its projects. Thin by design — the screen lives in
 * `thefactory-ui`; this supplies the group and the host navigations. A project's own pipeline opens inside it, its leaf chats too.
 */
export default function GroupProcessesView() {
  const { groupId, groupRunId } = useParams<{ groupId: string; groupRunId: string }>()
  const navigate = useNavigate()

  const onSelectGroupRun = useCallback(
    (id: string) => {
      if (groupId) navigate(`/groups/${groupId}/processes/${id}`)
    },
    [navigate, groupId],
  )

  const renderAgentRun = useCallback((ref: ProcessNodeRunRef, onBack: () => void) => {
    const context = chatContextOf(ref.chatContextId)
    return context ? <ChatBodyForContext context={context} onBackToPipeline={onBack} /> : null
  }, [])

  const renderChat = useCallback(
    (context: ChatContext) => (
      <ChatBodyForContext
        context={context}
        inputProps={{ autoFocus: true, placeholder: RUN_CHAT_PLACEHOLDER }}
      />
    ),
    [],
  )

  const onOpenChat = useCallback(
    (context: ChatContext) => {
      const key = encodeURIComponent(getChatContextKey(context))
      if (context.projectId) navigate(`/projects/${context.projectId}/chat/${key}`)
    },
    [navigate],
  )

  const onOpenAgentRun = useCallback(
    (ref: ProcessNodeRunRef) => {
      const context = chatContextOf(ref.chatContextId)
      if (context) onOpenChat(context)
    },
    [onOpenChat],
  )

  if (!groupId) return null
  return (
    <ProcessGroupRunsView
      groupId={groupId}
      {...(groupRunId ? { selectedGroupRunId: groupRunId } : {})}
      onSelectGroupRun={onSelectGroupRun}
      onOpenAgentRun={onOpenAgentRun}
      renderAgentRun={renderAgentRun}
      onOpenChat={onOpenChat}
      renderChat={renderChat}
    />
  )
}

function chatContextOf(key: string | undefined): ChatContext | undefined {
  if (!key) return undefined
  try {
    return getChatContext(key) ?? undefined
  } catch {
    return undefined
  }
}
