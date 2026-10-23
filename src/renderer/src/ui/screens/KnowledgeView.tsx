import { useActiveProject } from 'thefactory-ui/headless'
import { ProjectKnowledgeViewConnected } from 'thefactory-ui/web'

/**
 * What the project's overview says — purpose, capabilities, main modules, recorded work and work planned in its
 * documents — as the map upkeep last wrote it, the same overview agents read with `getProjectOverview`.
 */
export default function KnowledgeView(): React.JSX.Element | null {
  const { projectId } = useActiveProject()
  if (!projectId) return null
  return <ProjectKnowledgeViewConnected projectId={projectId} />
}
