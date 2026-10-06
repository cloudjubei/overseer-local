import { useParams } from 'react-router-dom'
import { GroupNotesSettings } from 'thefactory-ui/web'

/**
 * A projects group's notes as a first-class surface, beside its Chat: context
 * the user writes once for the whole group, which its chats and every agent
 * working in one of its projects reach for (`listGroupNotes` → `readGroupNote`).
 */
export default function GroupNotesView() {
  const { groupId } = useParams<{ groupId: string }>()
  return (
    <div className="h-full min-h-0 overflow-auto p-4">
      <GroupNotesSettings groupId={groupId} />
    </div>
  )
}
