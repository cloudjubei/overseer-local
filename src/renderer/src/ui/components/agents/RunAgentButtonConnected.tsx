import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectWorkLaunch, useStartWork, type StartWorkOutcome } from 'thefactory-ui/headless'
import { RunAgentButton as RunAgentButtonUI, StartWorkDialog } from 'thefactory-ui/web'
import { renderLaunchModelChip } from './RunModelChipConnected'

type Props = {
  projectId: string
  storyId: string
  featureId?: string
  className?: string
}

/**
 * The Run button of a story or a feature: the one start-work choice — a process run (its launch
 * card) or in this chat — then where the work went is opened: the run's pipeline, or the chat.
 */
export default function RunAgentButtonConnected({
  projectId,
  storyId,
  featureId,
  className,
}: Props) {
  const navigate = useNavigate()
  const { defaultMode, chatRunner, chatAgent } = useProjectWorkLaunch(projectId)
  const onStarted = useCallback(
    (outcome: StartWorkOutcome) => {
      if (outcome.mode === 'process' && outcome.processRunId) {
        navigate(`/projects/${projectId}/process-runs/${outcome.processRunId}`)
        return
      }
      if (outcome.chatContextId) {
        navigate(`/projects/${projectId}/chat/${encodeURIComponent(outcome.chatContextId)}`)
      }
    },
    [navigate, projectId],
  )
  const start = useStartWork(onStarted, chatAgent)

  return (
    <div className={`relative inline-flex items-center gap-1 ${className ?? ''}`}>
      <RunAgentButtonUI
        onClick={() =>
          start.open({ projectId, storyId, ...(featureId ? { featureIds: [featureId] } : {}) })
        }
      />
      <StartWorkDialog
        start={start}
        defaultMode={defaultMode}
        chatRunner={chatRunner}
        renderModelChip={renderLaunchModelChip}
      />
    </div>
  )
}
