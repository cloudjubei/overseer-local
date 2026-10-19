import { useNavigate } from 'react-router-dom'
import { FeatureRequestFullView, Modal, StartWorkDialog } from 'thefactory-ui/web'
import {
  featureRequestChatContext,
  useCrossProjectRequests,
  useFeatureRequestStart,
  useIncomingFeatureRequest,
  useProjectWorkLaunch,
} from 'thefactory-ui/headless'
import { useNavigateToResource } from '@ui/hooks/useNavigateToResource'

/**
 * The whole of a cross-project request, opened from its card ("Open the full request") on either
 * side: every part written out, the decision, and who asked — with links to the story the work was
 * placed on and to the chat that asked.
 */
export default function FeatureRequestFullModal({
  requestId,
  onClose,
}: {
  requestId: string | undefined
  onClose: () => void
}) {
  const navigateToResource = useNavigateToResource()
  const incoming = useIncomingFeatureRequest(requestId)
  const { requestById } = useCrossProjectRequests()
  const { request } = incoming
  const storyId = request?.handling?.storyId
  const navigate = useNavigate()
  const launch = useProjectWorkLaunch(request?.targetProjectId)
  const requestStart = useFeatureRequestStart(request, incoming, (outcome) => {
    const projectId = request?.targetProjectId
    if (!projectId) return
    onClose()
    if (outcome.mode === 'process' && outcome.processRunId) {
      navigate(`/projects/${projectId}/process-runs/${outcome.processRunId}`)
    } else if (outcome.chatContextId) {
      navigate(`/projects/${projectId}/chat/${encodeURIComponent(outcome.chatContextId)}`)
    }
  }, launch.chatAgent)
  return (
    <>
      <StartWorkDialog
        start={requestStart.start}
        defaultMode={launch.defaultMode}
        chatRunner={launch.chatRunner}
      />
      <Modal isOpen={!!request} onClose={onClose} title="Feature request" size="xl">
        {request ? (
          <FeatureRequestFullView
            request={request}
            fromLabel={incoming.fromLabel}
            adopterLabels={incoming.adopterLabels}
            defaultMode={launch.defaultMode}
            onAccept={requestStart.onAccept}
            onStartWork={requestStart.onStartWork}
            onStartAgain={requestStart.onStartAgain}
            onReject={(reason) => void incoming.reject(reason)}
            onMarkDelivered={(input) => void incoming.markDelivered(input)}
            onHandOver={(input) => void incoming.handOver(input)}
            requestTitle={(id) => requestById(id)?.title}
            onOpenRequest={(id) => {
              const other = requestById(id)
              if (!other) return
              onClose()
              navigateToResource({ kind: 'chat', context: featureRequestChatContext(other) })
            }}
            busy={incoming.busy}
            error={incoming.error}
            placedOn={
              incoming.placedOnLabel && storyId
                ? {
                    label: incoming.placedOnLabel,
                    onOpen: () => {
                      onClose()
                      navigateToResource({
                        kind: 'story',
                        projectId: request.targetProjectId,
                        storyId,
                      })
                    },
                  }
                : undefined
            }
            onOpenAskingChat={() => {
              onClose()
              navigateToResource({ kind: 'chat', context: request.requestedBy.fromChatContext })
            }}
          />
        ) : null}
      </Modal>
    </>
  )
}
