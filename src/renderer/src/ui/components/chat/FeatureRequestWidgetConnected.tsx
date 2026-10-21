import { useState } from 'react'
import {
  canStartFeatureRequestWork,
  featureRequestChatContext,
  featureRequestCountsLine,
  featureRequestSettledLine,
  featureRequestSummary,
  featureRequestTakenOverLinks,
  featureRequestWaitCycleWarning,
  useCrossProjectRequests,
  useFeatureRequestDecision,
  useFeatureRequestStart,
  useProjectWorkLaunch,
} from 'thefactory-ui/headless'
import { useNavigate } from 'react-router-dom'
import { useNavigateToResource } from '@ui/hooks/useNavigateToResource'
import {
  FeatureRequestCard,
  type FeatureRequestCardData,
  type FeatureRequestCardStatus,
  StartWorkDialog,
} from 'thefactory-ui/web'
import FeatureRequestFullModal from './FeatureRequestFullModal'
import { renderLaunchModelChip } from '@ui/components/agents/RunModelChipConnected'

/**
 * Desktop connector for the cross-project request widget rendered inline in A's chat from a
 * `requestProjectFeature` tool result. Mirrors the web connector 1:1 — looks the LIVE record up by
 * `requestId` from the account-global store (kept fresh via `featureRequest:updated`) and owns
 * accept/reject; the frozen tool-result `status`/`cycle` cover the pre-seed window.
 */
export default function FeatureRequestWidgetConnected({
  requestId,
  status,
  cycleDetected,
}: {
  requestId: string
  status?: string
  cycleDetected?: boolean
}): React.JSX.Element {
  const { requestById, reject, markDelivered, handOver } = useCrossProjectRequests()
  const decision = useFeatureRequestDecision(requestId)
  const navigate = useNavigate()
  const launch = useProjectWorkLaunch(decision.request?.targetProjectId)
  const requestStart = useFeatureRequestStart(
    decision.request,
    decision,
    (outcome) => {
      const projectId = decision.request?.targetProjectId
      if (!projectId) return
      if (outcome.mode === 'process' && outcome.processRunId) {
        navigate(`/projects/${projectId}/process-runs/${outcome.processRunId}`)
      } else if (outcome.chatContextId) {
        navigate(`/projects/${projectId}/chat/${encodeURIComponent(outcome.chatContextId)}`)
      }
    },
    launch.chatAgent,
  )
  const navigateToResource = useNavigateToResource()
  const [busy, setBusy] = useState(false)
  const [showFull, setShowFull] = useState(false)
  const live = requestById(requestId)

  if (!live) {
    return (
      <div className="rounded-md border border-(--border-subtle) bg-(--surface-raised) px-3 py-2 text-xs text-(--text-secondary)">
        Feature request · {status ?? 'pending'}
      </div>
    )
  }

  const data: FeatureRequestCardData = {
    id: live.id,
    title: live.title,
    targetProjectId: live.targetProjectId,
    fromProjectId: live.requestedBy.fromProjectId,
    status: live.status as FeatureRequestCardStatus,
    cycleDetected: live.cycleFlag?.detected ?? cycleDetected,
    waitCycleWarning: featureRequestWaitCycleWarning(live),
    reviewBranch: live.result?.reviewBranch,
    summary: featureRequestSummary(live),
    countsLine: featureRequestCountsLine(live),
    rejectionReason: live.rejectionReason,
    statusReason: live.statusReason,
    settled: featureRequestSettledLine(live, (id) => requestById(id)?.title),
    takenOver: featureRequestTakenOverLinks(live, (id) => requestById(id)?.title),
    workNotStarted: canStartFeatureRequestWork(live),
  }

  const openRequest = (id: string): void => {
    const other = requestById(id)
    if (other) navigateToResource({ kind: 'chat', context: featureRequestChatContext(other) })
  }

  const decide = (fn: (id: string) => Promise<unknown>) => async () => {
    setBusy(true)
    try {
      await fn(requestId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <FeatureRequestCard
        request={data}
        busy={busy}
        defaultMode={launch.defaultMode}
        onAccept={requestStart.onAccept}
        onStartWork={requestStart.onStartWork}
        onStartAgain={requestStart.onStartAgain}
        onReject={decide(reject)}
        onOpenFull={() => setShowFull(true)}
        onMarkDelivered={(input) => void decide((id) => markDelivered(id, input))()}
        onHandOver={(input) => void decide((id) => handOver(id, input))()}
        onOpenRequest={openRequest}
      />
      <StartWorkDialog
        start={requestStart.start}
        defaultMode={launch.defaultMode}
        chatRunner={launch.chatRunner}
        renderModelChip={renderLaunchModelChip}
      />
      <FeatureRequestFullModal
        requestId={showFull ? requestId : undefined}
        onClose={() => setShowFull(false)}
      />
    </>
  )
}
