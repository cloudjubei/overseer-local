import React, { useRef, useState } from 'react'
import { useProjectsGroups } from '@renderer/contexts/ProjectsGroupsContext'
import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { IconArrowLeftMini, IconArrowRightMini, IconDelete, IconEdit, IconPlus } from '@renderer/components/ui/Icons'

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
  onConfirm: (name: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Modal isOpen={true} onClose={onClose} title={title} size="sm" initialFocusRef={inputRef as React.RefObject<HTMLElement>}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const n = name.trim()
          if (!n) return
          onConfirm(n)
        }}
      >
        <div className="form-row">
          <label htmlFor="group-name">Group name</label>
          <input
            id="group-name"
            ref={inputRef}
            className="ui-input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New group"
          />
        </div>
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            {confirmText}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function ProjectGroupsEditor() {
  const { groups, reorderGroup, createGroup, updateGroupTitle, deleteGroup } = useProjectsGroups()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)
  const renameTarget = groups.find((g) => g.id === renameTargetId) || null

  const moveGroup = async (index: number, dir: -1 | 1) => {
    const fromIndex = index
    const toIndex = index + dir
    if (toIndex < 0 || toIndex >= groups.length) return
    await reorderGroup({ fromIndex, toIndex })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Local header */}
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">Groups</div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="icon"
            title="Add group"
            onClick={() => setIsAddOpen(true)}
          >
            <IconPlus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {groups.length === 0 && <div className="empty">No groups yet.</div>}

      <ul className="divide-y divide-border" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {groups.map((g, idx) => (
          <li key={g.id} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <strong>{g.title}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => moveGroup(idx, -1)}
                title="Move up"
                disabled={idx === 0}
              >
                <IconArrowLeftMini className="w-4 h-4 rotate-90" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => moveGroup(idx, +1)}
                title="Move down"
                disabled={idx === groups.length - 1}
              >
                <IconArrowRightMini className="w-4 h-4 rotate-90" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setRenameTargetId(g.id)}
                title="Rename group"
              >
                <IconEdit className="w-4 h-4" />
              </Button>
              <Button
                variant="danger"
                size="icon"
                onClick={async () => {
                  if (!confirm('Delete this group? Projects will remain uncategorized.')) return
                  await deleteGroup(g.id)
                }}
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
            await createGroup(name)
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
            await updateGroupTitle(renameTarget.id, name)
            setRenameTargetId(null)
          }}
          onClose={() => setRenameTargetId(null)}
        />
      )}
    </div>
  )
}
