import {
  featureRequestStoryLabel,
  useIncomingFeatureRequest,
  useProjects,
  useStories,
  type IncomingFeatureRequestState,
} from 'thefactory-ui/headless'
import { useReconciledFeatureRequests } from '@core/chats/useReconciledFeatureRequests'

/** Keep shared decisions (including their immediate mutation replies) and reconcile missed records. */
export function useReconciledIncomingFeatureRequest(
  requestId: string | undefined,
): IncomingFeatureRequestState {
  const incoming = useIncomingFeatureRequest(requestId)
  const requests = useReconciledFeatureRequests(!!requestId, incoming.request)
  const { projects } = useProjects()
  const { getStory, storyDisplayIndex } = useStories()
  const recovered = requestId ? requests.get(requestId) : undefined
  // A cached tie loses; writes observed after mount go through the feed as live updates.
  if (!recovered || (incoming.request && incoming.request.updatedAt > recovered.updatedAt)) {
    return incoming
  }

  const projectLabel = (id: string): string =>
    projects.find((project) => project.id === id)?.title ?? id
  const storyId = recovered.handling?.storyId
  return {
    ...incoming,
    request: recovered,
    fromLabel: projectLabel(recovered.requestedBy.fromProjectId),
    adopterLabels: recovered.adopters?.map(projectLabel),
    placedOnLabel: storyId
      ? featureRequestStoryLabel(getStory(storyId)?.title, storyDisplayIndex(storyId))
      : undefined,
  }
}
