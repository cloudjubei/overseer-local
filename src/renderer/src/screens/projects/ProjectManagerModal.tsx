import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { projectsService } from '@renderer/services/projectsService'
import { useProjectContext } from '@renderer/contexts/ProjectContext'
import { Button } from '@renderer/components/ui/Button'
import { PROJECT_ICONS, renderProjectIcon } from './projectIcons'
import { IconDelete, IconEdit, IconPlus, IconArrowLeftMini, IconArrowRightMini, IconBack } from '@renderer/components/ui/Icons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/Select'
import { validateProjectClient } from './validateProject'
import { ProjectEditorForm } from './ProjectEditorForm'
import { useProjectsGroups } from '@renderer/contexts/ProjectsGroupsContext'

const ALL_GROUP_ID = '__all__'
const UNCATEGORIZED_ID = '__uncategorized__'

type ViewMode = 'list' | 'create' | 'edit' | 'groups'

export default function ProjectManagerModal({
  onRequestClose,
  initialMode,
  initialProjectId,
}: {
  onRequestClose?: () => void
  initialMode?: 'list' | 'create' | 'edit'
  initialProjectId?: string
}) {
  const { projects, getProjectById } = useProjectContext()
  const { groups, getGroupForProject, reorderProject, reorderGroup, createGroup, updateGroupTitle, deleteGroup, setProjectGroup } =
    useProjectsGroups()
  const [error, _] = useState<string | null>(null)

  const [mode, setMode] = useState<ViewMode>(initialMode || 'list')
  const [editingId, setEditingId] = useState<string | null>(initialProjectId || null)

  const [form, setForm] = useState<any>({
    id: '',
    title: '',
    description: '',
    path: '',
    repo_url: '',
    requirements: [],
    metadata: { icon: 'folder', githubCredentialsId: '' },
    codeInfo: undefined,
  })
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [initialGroupId, setInitialGroupId] = useState<string | null>(null)

  const [formErrors, setFormErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const doClose = () => {
    onRequestClose?.()
  }

  // Derive uncategorized list
  const groupedProjectIds = useMemo(() => new Set(groups.flatMap((g) => g.projects || [])), [groups])
  const uncategorized = useMemo(
    () => projects.filter((p) => !groupedProjectIds.has(p.id)),
    [projects, groupedProjectIds],
  )

  useEffect(() => {
    // If we were asked to open in edit mode for a specific project, populate form
    if ((initialMode === 'edit' || mode === 'edit') && (initialProjectId || editingId)) {
      const id = (initialProjectId || editingId) as string
      const p: any = getProjectById(id)
      if (p) {
        const existingIcon = p.metadata?.icon
        const normalizedIcon = PROJECT_ICONS.some((opt) => opt.value === existingIcon)
          ? existingIcon
          : 'folder'
        setForm({
          ...p,
          requirements: Array.isArray(p.requirements) ? p.requirements : [],
          metadata: {
            ...(p.metadata ?? {}),
            icon: normalizedIcon,
            githubCredentialsId: p.metadata?.githubCredentialsId || '',
          },
        })
        setEditingId(id)
        const g = getGroupForProject(id)
        setSelectedGroupId(g?.id ?? null)
        setInitialGroupId(g?.id ?? null)
        setMode('edit')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode, initialProjectId, getProjectById, groups])

  const projectsList = useMemo(() => projects || [], [projects])

  function resetForm() {
    setForm({
      id: '',
      title: '',
      description: '',
      path: '',
      repo_url: '',
      requirements: [],
      metadata: { icon: 'folder', githubCredentialsId: '' },
      codeInfo: undefined,
    })
    setFormErrors([])
    setSaving(false)
    setEditingId(null)
    setSelectedGroupId(null)
    setInitialGroupId(null)
  }

  function startCreate() {
    resetForm()
    // Default new project's group to currently selected group (if a real group)
    if (currentGroupId && currentGroupId !== ALL_GROUP_ID && currentGroupId !== UNCATEGORIZED_ID) {
      setSelectedGroupId(currentGroupId)
    }
    setMode('create')
  }

  function startEdit(p: any) {
    const existingIcon = p.metadata?.icon
    const normalizedIcon = PROJECT_ICONS.some((opt) => opt.value === existingIcon)
      ? existingIcon
      : 'folder'
    setForm({
      ...p,
      requirements: Array.isArray(p.requirements) ? p.requirements : [],
      metadata: {
        ...(p.metadata ?? {}),
        icon: normalizedIcon,
        githubCredentialsId: p.metadata?.githubCredentialsId || '',
      },
    })
    const g = getGroupForProject(p.id)
    setSelectedGroupId(g?.id ?? null)
    setInitialGroupId(g?.id ?? null)
    setEditingId(p.id)
    setMode('edit')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this project configuration?')) return
    setSaving(true)
    try {
      await projectsService.deleteProject(id)
    } catch (e) {
      alert('Failed to delete: ' + (e || 'Unknown error'))
    }
    setSaving(false)
    setMode('list')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormErrors([])

    // client-side validation
    const v = validateProjectClient(form)
    if (!v.valid) {
      setFormErrors(v.errors)
      return
    }

    // Additional: unique id on create
    if (mode === 'create' && projectsList.find((p) => p.id === form.id)) {
      setFormErrors([`Project id ${form.id} already exists`])
      return
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        await projectsService.createProject(form)
        // Assign to group if selected
        await setProjectGroup(form.id, selectedGroupId)
      } else if (mode === 'edit' && editingId) {
        await projectsService.updateProject(editingId, form)
        // Update group membership if changed
        if (selectedGroupId !== initialGroupId) {
          await setProjectGroup(editingId, selectedGroupId)
        }
      }
    } catch (e: any) {
      setFormErrors([e?.message || String(e)])
      setSaving(false)
      return
    }
    setSaving(false)
    setMode('list')
  }

  const formId = 'project-manager-form'

  // Group filter state (header)
  const [currentGroupId, setCurrentGroupId] = useState<string>(ALL_GROUP_ID)

  // Build options for header selector
  const headerGroupsOptions = useMemo(() => {
    return [
      { id: ALL_GROUP_ID, title: 'All' },
      { id: UNCATEGORIZED_ID, title: '--uncategorized--' },
      ...groups.map((g) => ({ id: g.id, title: g.title })),
    ]
  }, [groups])

  // Compute list to show in content based on currentGroupId
  const visibleProjects = useMemo(() => {
    if (currentGroupId === ALL_GROUP_ID) return projectsList
    if (currentGroupId === UNCATEGORIZED_ID) return uncategorized
    const group = groups.find((g) => g.id === currentGroupId)
    if (!group) return []
    const byId = new Map(projectsList.map((p) => [p.id, p]))
    return group.projects.map((pid) => byId.get(pid)).filter(Boolean) as typeof projectsList
  }, [currentGroupId, projectsList, groups, uncategorized])

  // Reorder handlers for groups
  const moveGroup = async (index: number, dir: -1 | 1) => {
    const fromIndex = index
    const toIndex = index + dir
    if (toIndex < 0 || toIndex >= groups.length) return
    await reorderGroup({ fromIndex, toIndex })
  }

  // Only show group controls in header when listing projects
  const headerActions = mode === 'list' && (
    <div className="flex items-center gap-2">
      <Select value={currentGroupId} onValueChange={(v) => setCurrentGroupId(v)}>
        <SelectTrigger className="ui-select min-w-[220px]">
          <SelectValue placeholder="Select group" />
        </SelectTrigger>
        <SelectContent>
          {headerGroupsOptions.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="secondary" size="icon" onClick={() => setMode('groups')} title="Edit groups">
        <IconEdit className="w-4 h-4" />
      </Button>
    </div>
  )

  // Footer content varies by view
  const footer = (
    <div className="flex justify-between items-center w-full">
      {/* Left-side contextual controls */}
      <div className="flex items-center gap-2">
        {mode === 'groups' && (
          <Button variant="secondary" size="icon" onClick={() => setMode('list')} title="Back to projects">
            <IconBack className="w-4 h-4" />
          </Button>
        )}
        {(mode === 'create' || mode === 'edit') && (
          <Button variant="secondary" onClick={() => setMode('list')}>Cancel</Button>
        )}
      </div>

      {/* Right-side primary actions */}
      <div className="flex items-center gap-2">
        {mode === 'list' && (
          <Button variant="primary" size="icon" onClick={() => startCreate()} title="Add project">
            <IconPlus className="w-4 h-4" />
          </Button>
        )}
        {mode === 'groups' && (
          <Button variant="primary" size="icon" onClick={async () => {
            const name = prompt('New group name?')?.trim()
            if (!name) return
            await createGroup(name)
          }} title="Add group">
            <IconPlus className="w-4 h-4" />
          </Button>
        )}
        {(mode === 'create' || mode === 'edit') && (
          <Button type="submit" form={formId} disabled={saving}>
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        )}
      </div>
    </div>
  )

  // Reorder within selected group (not All/Uncategorized)
  const onMoveProjectInGroup = async (index: number, dir: -1 | 1) => {
    if (!currentGroupId || currentGroupId === ALL_GROUP_ID || currentGroupId === UNCATEGORIZED_ID) return
    const group = groups.find((g) => g.id === currentGroupId)
    if (!group) return
    const toIndex = index + dir
    if (toIndex < 0 || toIndex >= group.projects.length) return
    await reorderProject(currentGroupId, { fromIndex: index, toIndex })
  }

  // Groups editor view content (within the same modal)
  const GroupsEditorView = () => {
    return (
      <div className="flex flex-col gap-2">
        {groups.length === 0 && <div className="empty">No groups yet.</div>}
        <ul className="divide-y divide-border" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {groups.map((g, idx) => (
            <li key={g.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <strong>{g.title}</strong>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="icon" onClick={() => moveGroup(idx, -1)} title="Move up">
                  <IconArrowLeftMini className="w-4 h-4 rotate-90" />
                </Button>
                <Button variant="secondary" size="icon" onClick={() => moveGroup(idx, +1)} title="Move down">
                  <IconArrowRightMini className="w-4 h-4 rotate-90" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={async () => {
                    const name = prompt('Rename group', g.title)?.trim()
                    if (!name || name === g.title) return
                    await updateGroupTitle(g.id, name)
                  }}
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
      </div>
    )
  }

  const hideHeader = mode === 'create' || mode === 'edit'

  return (
    <>
      <Modal
        title={mode === 'groups' ? 'Edit Groups' : 'Manage Projects'}
        onClose={doClose}
        isOpen={true}
        size="lg"
        initialFocusRef={titleRef as React.RefObject<HTMLElement>}
        headerActions={headerActions || undefined}
        footer={footer}
        hideHeader={hideHeader}
      >
        {error && (
          <div role="alert" style={{ color: 'var(--status-stuck-fg)' }}>
            Error: {error}
          </div>
        )}

        {mode === 'list' && (
          <div className="flex flex-col" style={{ gap: 12 }}>
            <div>
              {visibleProjects.length === 0 && <div className="empty">No projects.</div>}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {visibleProjects.map((p, idx) => (
                  <li
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border-subtle)',
                      padding: '8px 0',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div aria-hidden>{renderProjectIcon(p.metadata?.icon)}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {p.id} · {p.path}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center" style={{ gap: 8 }}>
                      {/* Reorder controls only when a specific group is selected */}
                      {currentGroupId !== ALL_GROUP_ID && currentGroupId !== UNCATEGORIZED_ID && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="secondary"
                            size="icon"
                            title="Move up"
                            onClick={() => onMoveProjectInGroup(idx, -1)}
                            disabled={idx === 0}
                          >
                            <IconArrowLeftMini className="w-4 h-4 rotate-90" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            title="Move down"
                            onClick={() => onMoveProjectInGroup(idx, +1)}
                            disabled={idx === visibleProjects.length - 1}
                          >
                            <IconArrowRightMini className="w-4 h-4 rotate-90" />
                          </Button>
                        </div>
                      )}

                      <Button variant="secondary" size="icon" onClick={() => startEdit(p)} title="Edit project">
                        <IconEdit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="danger"
                        size="icon"
                        disabled={saving}
                        onClick={() => handleDelete(p.id)}
                        title="Delete project"
                      >
                        <IconDelete className="w-4 h-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {mode === 'groups' && <GroupsEditorView />}

        {(mode === 'create' || mode === 'edit') && (
          <ProjectEditorForm
            mode={mode}
            form={form}
            setForm={setForm}
            formErrors={formErrors}
            formId={formId}
            onSubmit={handleSubmit}
            selectedGroupId={selectedGroupId}
            onSelectedGroupIdChange={setSelectedGroupId}
          />
        )}
      </Modal>
    </>
  )
}
