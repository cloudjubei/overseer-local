import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useActiveProject } from 'thefactory-ui/headless'
import { ReferenceRenderingProvider } from 'thefactory-ui/web'
import { useNavigateToResource } from '../hooks/useNavigateToResource'

/**
 * Shows what text points at — stories, features, notes, files — as chips that
 * open in place, everywhere in the app: story pages and cards, notes, markdown
 * files. Resolved in the project in view, or across a group on its pages; a
 * chat's own renderer wins inside it.
 */
export default function ProjectReferenceRendering({ children }: { children: ReactNode }) {
  const { projectId } = useActiveProject()
  const navigateToResource = useNavigateToResource()
  // On a group's page no project is in view: references resolve across the group.
  const groupId = /^\/groups\/([^/]+)/.exec(useLocation().pathname)?.[1]
  return (
    <ReferenceRenderingProvider
      projectId={groupId ? undefined : projectId}
      groupId={groupId ? decodeURIComponent(groupId) : undefined}
      onOpen={navigateToResource}
    >
      {children}
    </ReferenceRenderingProvider>
  )
}
