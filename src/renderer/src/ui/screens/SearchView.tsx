import { useActiveProject } from 'thefactory-ui/headless'
import { ProjectSearchView } from 'thefactory-ui/web'
import { useNavigateToResource } from '@ui/hooks/useNavigateToResource'

/**
 * A project's Search tab: its files, stories, features and notes found from one
 * box. A file opens at the line that matched; the rest open where they live.
 */
export default function SearchView() {
  const { projectId } = useActiveProject()
  const navigateToResource = useNavigateToResource()
  return <ProjectSearchView projectId={projectId} onOpenResource={navigateToResource} />
}
