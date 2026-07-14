import { useState } from 'react'
import { useCrossProjectRequests } from 'thefactory-ui/headless'
import {
  FeatureRequestCard,
  type FeatureRequestCardData,
  type FeatureRequestCardStatus,
} from 'thefactory-ui/web'

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
}) {
  const { requestById, accept, reject } = useCrossProjectRequests()
  const [busy, setBusy] = useState(false)
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
    reviewBranch: live.result?.reviewBranch,
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
    <FeatureRequestCard
      request={data}
      busy={busy}
      onAccept={decide(accept)}
      onReject={decide(reject)}
    />
  )
}
