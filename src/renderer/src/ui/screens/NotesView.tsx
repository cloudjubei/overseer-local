import { useSearchParams } from 'react-router-dom'
import { NOTE_LINK_PARAM, useActiveProject } from 'thefactory-ui/headless'
import { ProjectNotesSettings } from 'thefactory-ui/web'

/**
 * Project notes as a first-class surface rather than a settings sub-page.
 *
 * Notes are standing context an AGENT reads (`listProjectNotes` →
 * `readProjectNote`) — test logins, build flavours, conventions — so they are
 * working material alongside Files, not a preference buried in Settings.
 * A `?note=` link opens it on that note, selected and scrolled to.
 */
export default function NotesView() {
  const { projectId } = useActiveProject()
  const [params] = useSearchParams()
  const selectedNoteId = params.get(NOTE_LINK_PARAM) ?? undefined
  return (
    <div className="h-full min-h-0 overflow-auto p-4">
      <ProjectNotesSettings projectId={projectId} {...(selectedNoteId ? { selectedNoteId } : {})} />
    </div>
  )
}
