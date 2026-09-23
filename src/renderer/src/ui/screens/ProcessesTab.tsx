import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProcessNodeRunRef } from 'thefactory-ui/headless'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { getChatContext } from '@core/chats/chatKey'
import { ProcessRunsView } from 'thefactory-ui/web'
import ChatBodyForContext from '@ui/components/chat/ChatBodyForContext'

export type ProcessesTabProps = {
  projectId: string | undefined
  /** The run whose pipeline fills the detail pane, from `/process-runs/:id`. */
  selectedRunId?: string
}

/**
 * The Processes tab. Thin by design: the master/detail screen lives in
 * `thefactory-ui`; this wrapper supplies the project and the host navigations —
 * selecting a run, opening a leaf's chat, and the cog to the process blueprints
 * (Settings → Processes).
 */
export default function ProcessesTab({ projectId, selectedRunId }: ProcessesTabProps) {
  const navigate = useNavigate()

  const onSelectRun = useCallback(
    (runId: string) => {
      if (!projectId) return
      navigate(`/projects/${projectId}/process-runs/${runId}`)
    },
    [navigate, projectId],
  )

  const onOpenSettings = useCallback(() => {
    if (!projectId) return
    navigate(`/projects/${projectId}/settings?tab=processes`)
  }, [navigate, projectId])

  // A LEAF opens INSIDE the pipeline, not in the Chat tab: the pipeline draws
  // the "‹ Pipeline" head (and, for a verify attempt, its small sign-off) and
  // this renders the run's chat below it. `onBack` is handed to the chat so its
  // own "Back to pipeline" buttons return to the spine too. `onOpenAgentRun`
  // stays as the route fallback.
  const renderAgentRun = useCallback((ref: ProcessNodeRunRef, onBack: () => void) => {
    if (!ref.chatContextId) return null
    let context: ChatContext | null = null
    try {
      context = getChatContext(ref.chatContextId) ?? null
    } catch {
      context = null
    }
    if (!context) return null
    return <ChatBodyForContext context={context} onBackToPipeline={onBack} />
  }, [])

  const onOpenAgentRun = useCallback(
    (ref: ProcessNodeRunRef) => {
      if (!projectId || !ref.chatContextId) return
      navigate(`/projects/${projectId}/chat/${encodeURIComponent(ref.chatContextId)}`)
    },
    [navigate, projectId],
  )

  if (!projectId) return null

  return (
    <ProcessRunsView
      projectId={projectId}
      {...(selectedRunId ? { selectedRunId } : {})}
      onSelectRun={onSelectRun}
      onOpenSettings={onOpenSettings}
      onOpenAgentRun={onOpenAgentRun}
      renderAgentRun={renderAgentRun}
    />
  )
}
