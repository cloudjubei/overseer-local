import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Alert,
  Button,
  ConfirmDialog,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  renderProjectIcon,
} from 'thefactory-ui/web'
import {
  IconArrowLeftMini,
  IconArrowRightMini,
  IconBack,
  IconDelete,
  IconEdit,
  IconPlus,
  IconSave,
} from 'thefactory-ui/web/icons'
import {
  createProject,
  deleteProject,
  updateProject,
  extractErrorMessage,
} from 'thefactory-ui/headless/api'
import type { GetProjectResponse } from 'thefactory-ui/headless/api'
import { useProjects } from '@core/contexts/ProjectsContext'
import { useProjectsGroups } from '@core/contexts/ProjectsGroupsContext'
import {
  ProjectEditorForm,
  blankProjectForm,
  projectToFormState,
  type ProjectFormState,
} from './ProjectEditorForm'
import ProjectGroupsEditor from './ProjectGroupsEditor'

const ALL_GROUP_ID = '__all__'
const UNCATEGORIZED_ID = '__uncategorized__'

type ViewMode = 'list' | 'create' | 'edit' | 'groups'

const TITLE_BY_MODE: Record<ViewMode, string> = {
  list: 'Manage Projects',
  groups: 'Edit Groups',
  create: 'Create Project',
  edit: 'Edit Project',
}

/**
 * Web port of `overseer-local`'s `ProjectManagerModal`. Same four views:
 * `list`, `create`, `edit`, `groups`. Same header pattern (group filter +
 * group-editor button when listing) and same footer pattern (back / add /
 * save) — kept structurally identical so a reader can switch between the
 * two files and follow the parity rule.
 */
export default function ProjectManagerModal({ onRequestClose }: { onRequestClose: () => void }) {
  const { projects, refresh: refreshProjects } = useProjects()
  const { groups, reorderProject, refresh: refreshGroups } = useProjectsGroups()

  const [mode, setMode] = useState<ViewMode>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectFormState>(blankProjectForm())
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<GetProjectResponse | null>(null)
  const [currentGroupId, setCurrentGroupId] = useState<string>(ALL_GROUP_ID)
  const [discardOpen, setDiscardOpen] = useState(false)
  // Flips to true on the first user-driven setForm in create/edit mode.
  // Background resets (resetForm, startCreate, startEdit) flip it back to false.
  const formDirtyRef = useRef(false)
  const setFormTouched: typeof setForm = (next) => {
    formDirtyRef.current = true
    setForm(next)
  }

  const mainGroups = useMemo(() => groups.filter((g) => g.type === 'MAIN'), [groups])
  const groupedProjectIds = useMemo(
    () => new Set(mainGroups.flatMap((g) => g.projects)),
    [mainGroups],
  )
  const uncategorized = useMemo(
    () => projects.filter((p) => !groupedProjectIds.has(p.id)),
    [projects, groupedProjectIds],
  )

  const headerGroupsOptions = useMemo(
    () => [
      { id: ALL_GROUP_ID, title: 'All' },
      { id: UNCATEGORIZED_ID, title: '— uncategorized —' },
      ...groups.map((g) => ({ id: g.id, title: g.title })),
    ],
    [groups],
  )

  const visibleProjects = useMemo(() => {
    if (currentGroupId === ALL_GROUP_ID) return projects
    if (currentGroupId === UNCATEGORIZED_ID) return uncategorized
    const group = groups.find((g) => g.id === currentGroupId)
    if (!group) return []
    const byId = new Map(projects.map((p) => [p.id, p]))
    return group.projects.map((id) => byId.get(id)).filter(Boolean) as GetProjectResponse[]
  }, [currentGroupId, projects, groups, uncategorized])

  const resetForm = () => {
    setForm(blankProjectForm())
    setFormErrors([])
    setEditingId(null)
    formDirtyRef.current = false
  }

  const startCreate = () => {
    const next = blankProjectForm()
    // Default the MAIN group to whichever group is currently filtered to
    // (when it's an actual MAIN group, not All / uncategorized).
    if (currentGroupId !== ALL_GROUP_ID && currentGroupId !== UNCATEGORIZED_ID) {
      const g = groups.find((gg) => gg.id === currentGroupId)
      if (g?.type === 'MAIN') next.mainGroupId = g.id
    }
    setForm(next)
    setFormErrors([])
    setEditingId(null)
    formDirtyRef.current = false
    setMode('create')
  }

  const startEdit = (p: GetProjectResponse) => {
    const next = projectToFormState(p)
    setForm(next)
    setFormErrors([])
    setEditingId(p.id)
    formDirtyRef.current = false
    setMode('edit')
  }

  /**
   * Called when the user tries to exit the create/edit form (Back button or
   * the modal's X / overlay click). If unsaved changes exist, shows a
   * confirm-discard dialog; otherwise drops back to the list.
   */
  const attemptExitForm = () => {
    if (formDirtyRef.current) setDiscardOpen(true)
    else {
      resetForm()
      setMode('list')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormErrors([])

    const errors: string[] = []
    if (mode === 'create') {
      if (!form.id.trim()) errors.push('ID is required.')
      if (projects.some((p) => p.id === form.id.trim()))
        errors.push(`Project id "${form.id}" already exists.`)
    }
    if (!form.title.trim()) errors.push('Title is required.')
    if (!form.description.trim()) errors.push('Description is required.')
    if (errors.length > 0) {
      setFormErrors(errors)
      return
    }

    setSaving(true)
    try {
      // The backend atomically maintains the bidirectional
      // project↔group relationship for both MAIN and SCOPE memberships
      // when `mainGroupId` / `scopeGroupIds` are passed — no need to
      // call `updateGroup` here. `mainGroupId: null` is the explicit
      // "no main group" choice (the backend distinguishes it from
      // `undefined`, which means "leave alone").
      if (mode === 'create') {
        await createProject({
          body: {
            id: form.id.trim(),
            title: form.title.trim(),
            description: form.description.trim(),
            repo_url: form.repo_url.trim() || undefined,
            active: form.active,
            metadata: { ...form.metadata },
            codeInfo: form.codeInfo,
            mainGroupId: form.mainGroupId ?? undefined,
            scopeGroupIds: form.scopeGroupIds,
          },
          throwOnError: true,
        })
      } else if (editingId) {
        await updateProject({
          path: { id: editingId },
          body: {
            title: form.title.trim(),
            description: form.description.trim(),
            repo_url: form.repo_url.trim() || undefined,
            active: form.active,
            metadata: { ...form.metadata },
            codeInfo: form.codeInfo,
            // Pass the user's choice through verbatim — including `null`,
            // which the backend treats as an explicit clear.
            mainGroupId: form.mainGroupId,
            scopeGroupIds: form.scopeGroupIds,
          },
          throwOnError: true,
        })
      }
      await refreshProjects()
      await refreshGroups()
      formDirtyRef.current = false
      resetForm()
      setMode('list')
    } catch (err) {
      setFormErrors([
        extractErrorMessage(err, 'Could not save this project. Check the values and try again.'),
      ])
    } finally {
      setSaving(false)
    }
  }

  const onMoveProjectInGroup = async (index: number, dir: -1 | 1) => {
    if (currentGroupId === ALL_GROUP_ID || currentGroupId === UNCATEGORIZED_ID) return
    const group = groups.find((g) => g.id === currentGroupId)
    if (!group) return
    const toIndex = index + dir
    if (toIndex < 0 || toIndex >= group.projects.length) return
    await reorderProject(currentGroupId, index, toIndex)
  }

  const formId = 'project-manager-form'

  const headerActions = mode === 'list' && (
    <div className="flex items-center gap-2">
      <Select value={currentGroupId} onValueChange={setCurrentGroupId}>
        <SelectTrigger className="min-w-55">
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
      <Button variant="outline" size="icon" onClick={() => setMode('groups')} title="Edit groups">
        <IconEdit className="w-4 h-4" />
      </Button>
    </div>
  )

  const footer = (
    <div className="flex justify-between items-center w-full">
      <div className="flex items-center gap-2">
        {mode === 'groups' && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              resetForm()
              setMode('list')
            }}
            title="Back to projects"
          >
            <IconBack className="w-4 h-4" />
          </Button>
        )}
        {(mode === 'create' || mode === 'edit') && (
          <Button variant="outline" size="icon" onClick={attemptExitForm} title="Back to projects">
            <IconBack className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {mode === 'list' && (
          <Button size="icon" onClick={startCreate} title="Add project" aria-label="Add project">
            <IconPlus className="w-4 h-4" />
          </Button>
        )}
        {mode === 'create' && (
          <Button type="submit" form={formId} loading={saving} disabled={saving}>
            Create
          </Button>
        )}
        {mode === 'edit' && (
          <Button
            type="submit"
            form={formId}
            variant="secondary"
            size="icon"
            loading={saving}
            disabled={saving}
            title="Save"
            aria-label="Save"
          >
            <IconSave className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )

  const onModalClose = () => {
    // When inside the create/edit form, route through the dirty-check so the
    // user gets the discard-changes warning before losing edits.
    if (mode === 'create' || mode === 'edit') {
      if (formDirtyRef.current) {
        setDiscardOpen(true)
        return
      }
    }
    onRequestClose()
  }

  return (
    <Modal
      isOpen
      onClose={onModalClose}
      title={TITLE_BY_MODE[mode]}
      size="lg"
      headerActions={headerActions || undefined}
      footer={footer}
    >
      <div className="relative min-h-75">
        {saving && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-(--surface-base)/60">
            <Spinner size={32} />
            <div className="mt-4 font-medium">Saving changes...</div>
          </div>
        )}

        {mode === 'list' && (
          <div className="flex flex-col gap-3">
            {visibleProjects.length === 0 ? (
              <Alert>No projects in this view.</Alert>
            ) : (
              <ul className="flex flex-col" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {visibleProjects.map((p, idx) => {
                  const iconKey =
                    p.metadata && typeof (p.metadata as Record<string, unknown>).icon === 'string'
                      ? ((p.metadata as Record<string, unknown>).icon as string)
                      : 'folder'
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 py-2 border-b border-(--border-subtle)"
                      style={{ opacity: p.active === false ? 0.5 : 1 }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span aria-hidden>{renderProjectIcon(iconKey)}</span>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {p.title}
                            {p.active === false && (
                              <span className="text-xs text-(--text-secondary) font-normal ml-2">
                                (Inactive)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-(--text-secondary) truncate">
                            {p.id}
                            {p.path ? ` · ${p.path}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {currentGroupId !== ALL_GROUP_ID && currentGroupId !== UNCATEGORIZED_ID && (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              title="Move up"
                              onClick={() => void onMoveProjectInGroup(idx, -1)}
                              disabled={idx === 0}
                            >
                              <IconArrowLeftMini className="w-4 h-4 rotate-90" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              title="Move down"
                              onClick={() => void onMoveProjectInGroup(idx, +1)}
                              disabled={idx === visibleProjects.length - 1}
                            >
                              <IconArrowRightMini className="w-4 h-4 rotate-90" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => startEdit(p)}
                          title="Edit project"
                        >
                          <IconEdit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="danger"
                          size="icon"
                          onClick={() => setDeleteCandidate(p)}
                          title="Delete project"
                          disabled={saving}
                        >
                          <IconDelete className="w-4 h-4" />
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {mode === 'groups' && <ProjectGroupsEditor />}

        {(mode === 'create' || mode === 'edit') && (
          <ProjectEditorForm
            mode={mode}
            form={form}
            setForm={setFormTouched}
            formErrors={formErrors}
            formId={formId}
            onSubmit={handleSubmit}
          />
        )}
      </div>

      <ConfirmDialog
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false)
          formDirtyRef.current = false
          resetForm()
          setMode('list')
        }}
        title="Discard changes?"
        description="You have unsaved changes in this project. Going back now will lose them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
      />
      {deleteCandidate && (
        <ConfirmDialog
          isOpen
          onClose={() => setDeleteCandidate(null)}
          title="Delete project"
          description={`Remove "${deleteCandidate.title}" from your project registry? Files on disk are not touched.`}
          confirmLabel="Delete"
          destructive
          onConfirm={async () => {
            const id = deleteCandidate.id
            setDeleteCandidate(null)
            await deleteProject({ path: { id }, throwOnError: true })
            await refreshProjects()
            await refreshGroups()
          }}
        />
      )}
    </Modal>
  )
}
