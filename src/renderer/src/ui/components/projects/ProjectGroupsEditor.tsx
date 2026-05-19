import { useRef, useState } from 'react'
import {
  Alert,
  Button,
  ConfirmDialog,
  Input,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from 'thefactory-ui/web'
import {
  IconArrowLeftMini,
  IconArrowRightMini,
  IconDelete,
  IconEdit,
  IconPlus,
  IconSave,
} from 'thefactory-ui/web/icons'
import {
  useProjectsGroups,
  type GroupType,
  type ProjectsGroup,
} from '@core/contexts/ProjectsGroupsContext'
import { extractErrorMessage } from 'thefactory-ui/headless/api'

function GroupNameModal({
  title,
  initialName = '',
  confirmText = 'Save',
  onConfirm,
  onClose,
}: {
  title: string
  initialName?: string
  confirmText?: string
  onConfirm: (name: string) => Promise<void> | void
  onClose: () => void
}) {
  const [name, setName] = useState(initialName)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm(n)
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not save this group. Try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={submitting ? () => undefined : onClose}
      title={title}
      size="sm"
      initialFocusRef={inputRef as React.RefObject<HTMLElement>}
    >
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        {error && <Alert>{error}</Alert>}
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New group"
          autoFocus
        />
        <div className="flex justify-end mt-1">
          {confirmText === 'Save' ? (
            <Button
              type="submit"
              variant="secondary"
              size="icon"
              loading={submitting}
              disabled={!name.trim() || submitting}
              title="Save"
              aria-label="Save"
            >
              <IconSave className="w-4 h-4" />
            </Button>
          ) : (
            <Button type="submit" loading={submitting} disabled={!name.trim() || submitting}>
              {confirmText}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}

export default function ProjectGroupsEditor() {
  const { groups, createGroup, updateGroup, deleteGroup, reorderGroup } = useProjectsGroups()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<ProjectsGroup | null>(null)
  const renameTarget = groups.find((g) => g.id === renameTargetId) ?? null

  const moveGroup = async (index: number, dir: -1 | 1) => {
    const fromIndex = index
    const toIndex = index + dir
    if (toIndex < 0 || toIndex >= groups.length) return
    await reorderGroup(fromIndex, toIndex)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">Groups</div>
        <Button size="icon" title="Add group" onClick={() => setIsAddOpen(true)}>
          <IconPlus className="w-4 h-4" />
        </Button>
      </div>

      {groups.length === 0 && <div className="text-sm text-(--text-secondary)">No groups yet.</div>}

      <ul
        className="divide-y divide-(--border-subtle)"
        style={{ listStyle: 'none', margin: 0, padding: 0 }}
      >
        {groups.map((g, idx) => (
          <li
            key={g.id}
            className="flex flex-col py-2 gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <strong className="truncate max-w-[200px]" title={g.title}>
                {g.title}
              </strong>
              <div className="flex items-center gap-3">
                <Select
                  value={g.type || 'MAIN'}
                  onValueChange={(val) => void updateGroup(g.id, { type: val as GroupType })}
                >
                  <SelectTrigger className="w-[90px] h-7 text-xs px-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAIN">MAIN</SelectItem>
                    <SelectItem value="SCOPE">SCOPE</SelectItem>
                  </SelectContent>
                </Select>
                <Switch
                  checked={g.active !== false}
                  onCheckedChange={(val) => void updateGroup(g.id, { active: val })}
                  label={g.active !== false ? 'Active' : 'Inactive'}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <Button
                variant="outline"
                size="icon"
                onClick={() => void moveGroup(idx, -1)}
                title="Move up"
                disabled={idx === 0}
              >
                <IconArrowLeftMini className="w-4 h-4 rotate-90" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => void moveGroup(idx, +1)}
                title="Move down"
                disabled={idx === groups.length - 1}
              >
                <IconArrowRightMini className="w-4 h-4 rotate-90" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setRenameTargetId(g.id)}
                title="Rename group"
              >
                <IconEdit className="w-4 h-4" />
              </Button>
              <Button
                variant="danger"
                size="icon"
                onClick={() => setDeleteCandidate(g)}
                title="Delete group"
              >
                <IconDelete className="w-4 h-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {isAddOpen && (
        <GroupNameModal
          title="New Group"
          confirmText="Create"
          onConfirm={async (name) => {
            // Throw so GroupNameModal's catch surfaces the backend message
            // (a silent failure here was the original "nothing happens" bug).
            await createGroup({ title: name, type: 'MAIN', active: true, projects: [] })
            setIsAddOpen(false)
          }}
          onClose={() => setIsAddOpen(false)}
        />
      )}

      {renameTarget && (
        <GroupNameModal
          title="Rename Group"
          confirmText="Save"
          initialName={renameTarget.title}
          onConfirm={async (name) => {
            await updateGroup(renameTarget.id, { title: name })
            setRenameTargetId(null)
          }}
          onClose={() => setRenameTargetId(null)}
        />
      )}

      {deleteCandidate && (
        <ConfirmDialog
          isOpen
          onClose={() => setDeleteCandidate(null)}
          title="Delete group"
          description={`Delete "${deleteCandidate.title}"? Projects in it will remain — they'll just become uncategorized.`}
          confirmLabel="Delete"
          destructive
          onConfirm={async () => {
            const id = deleteCandidate.id
            setDeleteCandidate(null)
            await deleteGroup(id)
          }}
        />
      )}
    </div>
  )
}
