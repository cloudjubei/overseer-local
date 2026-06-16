import { useEffect, useMemo, useRef, useState } from 'react'
import { useActiveProject } from 'thefactory-ui/headless'
import { useStories } from 'thefactory-ui/headless'
import { useAgents } from 'thefactory-ui/headless'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { Button, ConfirmDialog, Modal, type StoryFormValues } from 'thefactory-ui/web'
import { IconDelete, IconSave } from 'thefactory-ui/web/icons'
import { StoryFormConnected as StoryForm } from 'thefactory-ui/web'
import FeatureForm from '@ui/components/stories/FeatureForm'
import RunAgentButtonConnected from '@ui/components/agents/RunAgentButtonConnected'
import ChatSidebarPanelConnected from '@ui/components/chat/ChatSidebarPanelConnected'
import type { StoryModalRoute } from './storyModals'

/**
 * Modal host for the Stories surface. Mirrors desktop's split into
 * `StoryCreateView` / `StoryEditView` / feature equivalents in terms of
 * modal titles, footer button layout, and unsaved-changes guard.
 */
export type StoriesModalHostProps = {
  route: StoryModalRoute | null
  onClose: () => void
}

export default function StoriesModalHost({ route, onClose }: StoriesModalHostProps) {
  if (!route) return null

  switch (route.kind) {
    case 'create-story':
      return <CreateStoryModal onClose={onClose} />
    case 'edit-story':
      return <EditStoryModal storyId={route.story.id} onClose={onClose} />
    case 'delete-story':
      return (
        <DeleteStoryModal storyId={route.story.id} title={route.story.title} onClose={onClose} />
      )
    case 'create-feature':
      return (
        <CreateFeatureModal
          storyId={route.storyId}
          initialValues={route.initialValues}
          onClose={onClose}
        />
      )
    case 'edit-feature':
      return (
        <EditFeatureModal storyId={route.storyId} featureId={route.feature.id} onClose={onClose} />
      )
    case 'delete-feature':
      return (
        <DeleteFeatureModal
          storyId={route.storyId}
          featureId={route.feature.id}
          title={route.feature.title}
          onClose={onClose}
        />
      )
  }
}

/** Shared "discard unsaved changes?" prompt — used by every modal that
 *  wraps a form, mirroring desktop's confirm-on-close behaviour. */
function useDirtyGuard(onClose: () => void) {
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  const attemptClose = () => {
    if (hasChanges) {
      setAlertMessage('You have unsaved changes. Do you really want to discard all changes?')
      setShowAlert(true)
      return
    }
    onClose()
  }

  // Per the user-policy: no Cancel — closing the dialog via X / Esc IS the
  // cancel ("keep editing"). The only footer action is the destructive
  // Discard.
  const dialog = (
    <ConfirmDialog
      isOpen={showAlert}
      onClose={() => setShowAlert(false)}
      title="Discard changes?"
      description={alertMessage}
      confirmLabel="Discard"
      destructive
      hideCancel
      closeOnOverlayClick={false}
      onConfirm={() => {
        setShowAlert(false)
        onClose()
      }}
    />
  )

  return { setHasChanges, setAlertMessage, setShowAlert, attemptClose, dialog }
}

function CreateStoryModal({ onClose }: { onClose: () => void }) {
  const { projectId } = useActiveProject()
  const { createStory } = useStories()
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const { setHasChanges, setAlertMessage, setShowAlert, attemptClose, dialog } =
    useDirtyGuard(onClose)

  const formId = 'story-create-form'

  const handleSubmit = async (values: StoryFormValues) => {
    setSubmitting(true)
    try {
      await createStory({
        title: values.title,
        description: values.description ?? '',
      })
      onClose()
    } catch (e) {
      setAlertMessage(`Failed to create story: ${e instanceof Error ? e.message : String(e)}`)
      setShowAlert(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Modal
        title="Create New Story"
        onClose={attemptClose}
        isOpen
        size="md"
        initialFocusRef={titleRef as React.RefObject<HTMLElement>}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              form={formId}
              disabled={submitting}
              loading={submitting}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              title="Cmd/Ctrl+Enter to submit"
            >
              Create Story
            </Button>
          </div>
        }
      >
        <StoryForm
          onSubmit={handleSubmit}
          submitting={submitting}
          isCreate
          titleRef={titleRef}
          onDirtyChange={setHasChanges}
          formId={formId}
          projectId={projectId ?? undefined}
        />
      </Modal>
      {dialog}
    </>
  )
}

function EditStoryModal({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const { projectId } = useActiveProject()
  const { stories, updateStory, deleteStory } = useStories()
  const { runsActive } = useAgents()
  const story = stories.find((s) => s.id === storyId) ?? null

  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { setHasChanges, setAlertMessage, setShowAlert, attemptClose, dialog } =
    useDirtyGuard(onClose)

  const formId = 'story-edit-form'

  const storyHasActiveRun = runsActive.some(
    (r) => r.context.storyId === storyId && !r.context.featureId,
  )

  const handleSubmit = async (values: StoryFormValues) => {
    setSubmitting(true)
    try {
      await updateStory(storyId, {
        title: values.title,
        description: values.description ?? '',
        status: values.status,
      })
      onClose()
    } catch (e) {
      setAlertMessage(`Failed to update story: ${e instanceof Error ? e.message : String(e)}`)
      setShowAlert(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setShowDeleteConfirm(false)
    setDeleting(true)
    try {
      await deleteStory(storyId)
      onClose()
    } catch (e) {
      setAlertMessage(`Failed to delete story: ${e instanceof Error ? e.message : String(e)}`)
      setShowAlert(true)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Modal
        title="Edit Story"
        onClose={attemptClose}
        isOpen
        footer={
          <div className="grid grid-cols-3 items-center gap-2">
            <div className="justify-self-start">
              {story && (
                <Button
                  variant="danger"
                  size="icon"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={submitting || deleting}
                  aria-label="Delete"
                  title="Delete"
                >
                  <IconDelete className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="justify-self-center">
              {projectId && !storyHasActiveRun && (
                <RunAgentButtonConnected projectId={projectId} storyId={storyId} />
              )}
            </div>
            <div className="justify-self-end">
              <Button
                type="submit"
                form={formId}
                variant="secondary"
                size="icon"
                disabled={submitting || deleting}
                loading={submitting}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                title="Save (Cmd/Ctrl+Enter)"
                aria-label="Save"
              >
                <IconSave className="w-4 h-4" />
              </Button>
            </div>
          </div>
        }
      >
        {story ? (
          <StoryForm
            initialValues={{
              status: story.status,
              title: story.title,
              description: story.description,
            }}
            onSubmit={handleSubmit}
            submitting={submitting || deleting}
            isCreate={false}
            onDirtyChange={setHasChanges}
            formId={formId}
            projectId={projectId ?? undefined}
          />
        ) : (
          <div className="py-8 text-center text-sm text-(--text-secondary)">Loading story…</div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Story"
        description="Are you sure you want to delete this story? This will also remove any features and blockers referencing it. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
      {dialog}
    </>
  )
}

function DeleteStoryModal({
  storyId,
  title,
  onClose,
}: {
  storyId: string
  title: string
  onClose: () => void
}) {
  const { deleteStory } = useStories()
  return (
    <ConfirmDialog
      isOpen
      onClose={onClose}
      title="Delete Story"
      description={`This permanently removes "${title}" and all its features. This cannot be undone.`}
      confirmLabel="Delete"
      destructive
      onConfirm={() => deleteStory(storyId)}
    />
  )
}

function CreateFeatureModal({
  storyId: initialStoryId,
  initialValues,
  onClose,
}: {
  storyId?: string
  initialValues?: import('@ui/components/stories/FeatureForm').FeatureFormInitialValues
  onClose: () => void
}) {
  const { stories, createFeature } = useStories()
  const [submitting, setSubmitting] = useState(false)
  const { setHasChanges, setAlertMessage, setShowAlert, attemptClose, dialog } =
    useDirtyGuard(onClose)
  const titleRef = useRef<HTMLInputElement>(null)

  // Story selection state — mirrors desktop's `FeatureCreateView`. If
  // `initialStoryId` is provided (e.g. the modal was opened from a story's
  // "+ Feature" button), preselect it; otherwise fall back to the latest
  // story in the project.
  const [selectedStoryId, setSelectedStoryId] = useState<string>(
    initialStoryId || stories[stories.length - 1]?.id || '',
  )
  const [storyQuery, setStoryQuery] = useState('')
  const [openStoryList, setOpenStoryList] = useState(false)
  const storySelectorRef = useRef<HTMLDivElement | null>(null)
  const storyInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!storySelectorRef.current) return
      if (!storySelectorRef.current.contains(e.target as Node)) {
        setOpenStoryList(false)
        setStoryQuery('')
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  const filteredStories = useMemo(() => {
    const q = storyQuery.trim().toLowerCase()
    if (!q) return stories
    return stories.filter((s) => `${s.title || ''}`.toLowerCase().includes(q))
  }, [stories, storyQuery])

  const selectedStoryTitle = selectedStoryId
    ? stories.find((s) => s.id === selectedStoryId)?.title || '(untitled story)'
    : ''
  const inputValue = storyQuery !== '' ? storyQuery : selectedStoryTitle

  const formId = 'feature-create-form'

  return (
    <>
      <Modal
        title="Create New Feature"
        onClose={attemptClose}
        isOpen
        size="lg"
        initialFocusRef={titleRef as React.RefObject<HTMLElement>}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              form={formId}
              disabled={submitting || !selectedStoryId}
              loading={submitting}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              title="Cmd/Ctrl+Enter to submit"
            >
              Create Feature
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {/* Story selector — combobox with type-to-filter. */}
          <div className="flex flex-col gap-1" ref={storySelectorRef}>
            <label
              htmlFor="feature-story"
              className="text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              Story
            </label>
            <div className="relative">
              <input
                id="feature-story"
                ref={storyInputRef}
                type="text"
                placeholder={!selectedStoryId ? 'Search story...' : ''}
                value={inputValue}
                onFocus={() => {
                  setStoryQuery('')
                  setOpenStoryList(true)
                }}
                onChange={(e) => {
                  setStoryQuery(e.target.value)
                  setOpenStoryList(true)
                }}
                onBlur={() => {
                  requestAnimationFrame(() => {
                    if (!storySelectorRef.current) return
                    if (!storySelectorRef.current.contains(document.activeElement)) {
                      setOpenStoryList(false)
                      setStoryQuery('')
                    }
                  })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    setOpenStoryList(false)
                    setStoryQuery('')
                    ;(e.currentTarget as HTMLInputElement).blur()
                  }
                }}
                className="w-full rounded-md border px-3 py-2 text-sm"
                style={{
                  background: 'var(--surface-raised)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
                aria-expanded={openStoryList}
                aria-controls="feature-story-listbox"
                aria-autocomplete="list"
              />
              {openStoryList && (
                <ul
                  id="feature-story-listbox"
                  role="listbox"
                  className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border shadow"
                  style={{
                    background: 'var(--surface-raised)',
                    borderColor: 'var(--border-default)',
                  }}
                >
                  {filteredStories.length === 0 && (
                    <li className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      No stories found
                    </li>
                  )}
                  {filteredStories.map((s) => (
                    <li key={s.id} role="option" aria-selected={selectedStoryId === s.id}>
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-(--surface-hover) ${
                          selectedStoryId === s.id ? 'bg-(--surface-hover)' : ''
                        }`}
                        onClick={() => {
                          setSelectedStoryId(s.id)
                          setStoryQuery('')
                          setOpenStoryList(false)
                          setTimeout(() => titleRef.current?.focus(), 0)
                        }}
                      >
                        <div className="font-medium">{s.title || '(untitled story)'}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {!selectedStoryId && (
              <div className="text-xs" style={{ color: 'var(--status-stuck-fg)' }}>
                Please select a story to attach this feature to.
              </div>
            )}
          </div>

          {selectedStoryId ? (
            <FeatureForm
              mode={{
                kind: 'create',
                initialValues,
                onSubmit: async (input) => {
                  setSubmitting(true)
                  try {
                    await createFeature(selectedStoryId, input)
                    onClose()
                  } catch (e) {
                    setAlertMessage(
                      `Failed to create feature: ${e instanceof Error ? e.message : String(e)}`,
                    )
                    setShowAlert(true)
                  } finally {
                    setSubmitting(false)
                  }
                },
              }}
              storyId={selectedStoryId}
              submitting={submitting}
              onDirty={setHasChanges}
              formId={formId}
            />
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Choose a story to start describing the feature.
            </div>
          )}
        </div>
      </Modal>
      {dialog}
    </>
  )
}

function EditFeatureModal({
  storyId,
  featureId,
  onClose,
}: {
  storyId: string
  featureId: string
  onClose: () => void
}) {
  const { projectId } = useActiveProject()
  const { stories, updateFeature, deleteFeature } = useStories()
  const { runsActive } = useAgents()
  const story = stories.find((s) => s.id === storyId)
  const feature = story?.features.find((f) => f.id === featureId)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { setHasChanges, setAlertMessage, setShowAlert, attemptClose, dialog } =
    useDirtyGuard(onClose)

  if (!feature) {
    return (
      <Modal title="Edit Feature" onClose={onClose} isOpen size="md">
        <div className="py-8 text-center text-sm text-(--text-secondary)">Feature not found.</div>
      </Modal>
    )
  }

  const formId = 'feature-edit-form'

  const featureChatContext: ChatContext | null = projectId
    ? { type: 'FEATURE', projectId, storyId, featureId }
    : null
  const featureChatTitle = feature.title || 'Feature'

  const storyHasActiveRun = runsActive.some(
    (r) => r.context.storyId === storyId && !r.context.featureId,
  )
  const featureHasActiveRun = runsActive.some((r) => r.context.featureId === featureId)

  const handleDelete = async () => {
    setShowDeleteConfirm(false)
    setDeleting(true)
    try {
      await deleteFeature(storyId, featureId)
      onClose()
    } catch (e) {
      setAlertMessage(`Failed to delete feature: ${e instanceof Error ? e.message : String(e)}`)
      setShowAlert(true)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Modal
        title="Edit Feature"
        onClose={attemptClose}
        isOpen
        size="md"
        sidePanel={
          featureChatContext ? (
            <ChatSidebarPanelConnected
              context={featureChatContext}
              chatContextTitle={featureChatTitle}
              attached
            />
          ) : undefined
        }
        footer={
          <div className="grid grid-cols-3 items-center gap-2">
            <div className="justify-self-start">
              <Button
                variant="danger"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={submitting || deleting}
                aria-label="Delete"
                title="Delete"
              >
                <IconDelete className="w-4 h-4" />
              </Button>
            </div>
            <div className="justify-self-center">
              {projectId && !storyHasActiveRun && !featureHasActiveRun && (
                <RunAgentButtonConnected
                  projectId={projectId}
                  storyId={storyId}
                  featureId={featureId}
                />
              )}
            </div>
            <div className="justify-self-end">
              <Button
                type="submit"
                form={formId}
                variant="secondary"
                size="icon"
                disabled={submitting || deleting}
                loading={submitting}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                title="Save (Cmd/Ctrl+Enter)"
                aria-label="Save"
              >
                <IconSave className="w-4 h-4" />
              </Button>
            </div>
          </div>
        }
      >
        <FeatureForm
          mode={{
            kind: 'edit',
            feature,
            onSubmit: async (patch) => {
              setSubmitting(true)
              try {
                await updateFeature(storyId, featureId, patch)
                onClose()
              } catch (e) {
                setAlertMessage(
                  `Failed to update feature: ${e instanceof Error ? e.message : String(e)}`,
                )
                setShowAlert(true)
              } finally {
                setSubmitting(false)
              }
            },
          }}
          storyId={storyId}
          submitting={submitting || deleting}
          onDirty={setHasChanges}
          formId={formId}
        />
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Feature"
        description="Are you sure you want to delete this feature? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
      {dialog}
    </>
  )
}

function DeleteFeatureModal({
  storyId,
  featureId,
  title,
  onClose,
}: {
  storyId: string
  featureId: string
  title: string
  onClose: () => void
}) {
  const { deleteFeature } = useStories()
  return (
    <ConfirmDialog
      isOpen
      onClose={onClose}
      title="Delete Feature"
      description={`This permanently removes "${title}" from this story.`}
      confirmLabel="Delete"
      destructive
      onConfirm={() => deleteFeature(storyId, featureId)}
    />
  )
}
