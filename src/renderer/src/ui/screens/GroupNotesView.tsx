import { useParams, useSearchParams } from 'react-router-dom'
import { NOTE_LINK_PARAM } from 'thefactory-ui/headless'
import { GroupNotesSettings } from 'thefactory-ui/web'

/**
 * A projects group's notes as a first-class surface, beside its Chat: context
 * the user writes once for the whole group, which its chats and every agent
 * working in one of its projects reach for (`listGroupNotes` → `readGroupNote`).
 * A `?note=` link opens it on that note, selected and scrolled to.
 */
export default function GroupNotesView() {
  const { groupId } = useParams<{ groupId: string }>()
  const [params] = useSearchParams()
  const selectedNoteId = params.get(NOTE_LINK_PARAM) ?? undefined
  return (
    <div className="h-full min-h-0 overflow-auto p-4">
      <GroupNotesSettings groupId={groupId} {...(selectedNoteId ? { selectedNoteId } : {})} />
    </div>
  )
}
