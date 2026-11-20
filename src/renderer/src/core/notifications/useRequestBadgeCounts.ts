import { useMemo } from 'react'
import { useReconciledFeatureRequests } from '../chats/useReconciledFeatureRequests'

const IN_FLIGHT = new Set(['accepted', 'in_progress', 'in_review'])

/** Sidebar projection of the same reconciled records used by open request chats. */
export function useRequestBadgeCounts(): ReadonlyMap<string, number> {
  const requests = useReconciledFeatureRequests()

  return useMemo(() => {
    const counts = new Map<string, number>()
    for (const { status, targetProjectId } of requests.values()) {
      if (IN_FLIGHT.has(status)) counts.set(targetProjectId, (counts.get(targetProjectId) ?? 0) + 1)
    }
    return counts
  }, [requests])
}
