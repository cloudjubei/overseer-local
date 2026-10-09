import { useActiveProject } from 'thefactory-ui/headless'
import { DesignView as SharedDesignView } from 'thefactory-ui/web'
import { useNavigateToResource } from '@ui/hooks/useNavigateToResource'

/**
 * A project's Design: its apps and screens, the drafts of how each should look
 * (one approved) and the versions runs built. Discuss opens the project chat
 * with the reference in its draft.
 */
export default function DesignView() {
  const { projectId } = useActiveProject()
  const navigateToResource = useNavigateToResource()
  return <SharedDesignView projectId={projectId} onOpenResource={navigateToResource} />
}
