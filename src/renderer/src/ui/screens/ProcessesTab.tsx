import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProcessNodeRunRef } from 'thefactory-ui/headless'
import { ProcessRunsView } from 'thefactory-ui/web'

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
    />
  )
}
