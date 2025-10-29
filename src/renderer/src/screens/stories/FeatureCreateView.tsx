import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FeatureForm, { FeatureFormValues } from '@renderer/components/stories/FeatureForm'
import { useToast } from '@renderer/components/ui/Toast'
import { AlertDialog, Modal } from '@renderer/components/ui/Modal'
import { useStories } from '@renderer/contexts/StoriesContext'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { ChatContext } from 'thefactory-tools'
import { ChatSidebarModalPanel } from '@renderer/components/chat'

export default function FeatureCreateView({
  storyId,
  onRequestClose,
  initialValues,
  focusDescription = false,
}: {
  storyId?: string
  onRequestClose?: () => void
  initialValues?: Partial<FeatureFormValues>
  focusDescription?: boolean
}) {
  const { toast } = useToast()
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const { addFeature, storiesById, storyIdsByProject } = useStories()
  const { projectId } = useActiveProject()

  const [hasChanges, setHasChanges] = useState(false)

  // Local selected story state (preselect if provided)
  const [selectedStoryId, setSelectedStoryId] = useState<string | ''>(storyId || '')
  const [storyQuery, setStoryQuery] = useState('')
  const storyInputRef = useRef<HTMLInputElement | null>(null)
  const [openStoryList, setOpenStoryList] = useState(false)

  useEffect(() => {
    // If no preselected story and we have exactly one story in project, preselect it for convenience
    if (!selectedStoryId && projectId) {
      const ids = storyIdsByProject[projectId] || []
      if (ids.length === 1) setSelectedStoryId(ids[0])
    }
  }, [projectId, storyIdsByProject, selectedStoryId])

  const projectStories = useMemo(() => {
    const ids = (projectId && storyIdsByProject[projectId]) || []
    return ids.map((id) => storiesById[id]).filter(Boolean)
  }, [projectId, storyIdsByProject, storiesById])

  const filteredStories = useMemo(() => {
    const q = storyQuery.trim().toLowerCase()
    if (!q) return projectStories
    return projectStories.filter((s) => {
      const t = `${s.title || ''}`.toLowerCase()
      return t.includes(q) || s.id.toLowerCase().includes(q)
    })
  }, [projectStories, storyQuery])

  const doClose = () => {
    onRequestClose?.()
  }

  const attemptClose = () => {
    if (hasChanges) {
      setAlertMessage('You have unsaved changes. Do you really want to discard all changes?')
      setShowAlert(true)
      return
    }
    doClose()
  }

  const onSubmit = useCallback(
    async (values: FeatureFormValues) => {
      if (!selectedStoryId) {
        setAlertMessage('Please select a story for this feature.')
        setShowAlert(true)
        return
      }
      setSubmitting(true)
      try {
        await addFeature(selectedStoryId, {
          ...values,
          description: values.description ?? '',
        })
        toast({ title: 'Success', description: 'Feature created successfully', variant: 'success' })
        doClose()
      } catch (e: any) {
        setAlertMessage(`Failed to create feature: ${e?.message || String(e)}`)
        setShowAlert(true)
      } finally {
        setSubmitting(false)
      }
    },
    [selectedStoryId, toast, addFeature],
  )

  const formId = 'feature-form-create'
  const context = useMemo(
    (): ChatContext => ({ type: 'STORY', projectId: projectId!, storyId: selectedStoryId || storyId || '' }),
    [projectId, selectedStoryId, storyId],
  )

  // Simple combobox-style dropdown for Story selection with search
  const storySelector = (
    <div className="flex flex-col gap-1">
      <label htmlFor="feature-story" className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Story
      </label>
      <div className="relative">
        <input
          id="feature-story"
          ref={storyInputRef}
          type="text"
          placeholder={selectedStoryId ? storiesById[selectedStoryId]?.title || 'Selected story' : 'Search story...'}
          value={storyQuery}
          onFocus={() => setOpenStoryList(true)}
          onChange={(e) => {
            setStoryQuery(e.target.value)
            setOpenStoryList(true)
          }}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ background: 'var(--surface-raised)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
          aria-expanded={openStoryList}
          aria-controls="feature-story-listbox"
          aria-autocomplete="list"
        />
        {openStoryList && (
          <ul
            id="feature-story-listbox"
            role="listbox"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-[var(--surface-raised)] shadow"
            style={{ borderColor: 'var(--border-default)' }}
          >
            {filteredStories.length === 0 && (
              <li className="px-3 py-2 text-sm text-text-muted">No stories found</li>
            )}
            {filteredStories.map((s) => (
              <li key={s.id} role="option" aria-selected={selectedStoryId === s.id}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-selected)] ${selectedStoryId === s.id ? 'bg-[var(--surface-selected)]' : ''}`}
                  onClick={() => {
                    setSelectedStoryId(s.id)
                    setStoryQuery('')
                    setOpenStoryList(false)
                    // focus title next
                    setTimeout(() => titleRef.current?.focus(), 0)
                  }}
                >
                  <div className="font-medium">{s.title || '(untitled story)'}</div>
                  <div className="text-xs text-text-muted">{s.id}</div>
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
  )

  return (
    <>
      <Modal
        title="Create New Feature"
        onClose={attemptClose}
        isOpen={true}
        size={'lg'}
        initialFocusRef={titleRef as React.RefObject<HTMLElement>}
        footer={
          <div className="flex justify-between gap-2">
            <span />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={attemptClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn"
                form={formId}
                disabled={submitting || !selectedStoryId}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                title="Cmd/Ctrl+Enter to submit"
              >
                Save Changes
              </button>
            </div>
          </div>
        }
        contentClassName="p-4 min-h-0 overflow-y-auto"
      >
        <div className="flex flex-col gap-3">
          {storySelector}
          {selectedStoryId ? (
            <FeatureForm
              onSubmit={onSubmit}
              onCancel={attemptClose}
              submitting={submitting}
              titleRef={titleRef}
              storyId={selectedStoryId}
              hideActions
              formId={formId}
              onDirtyChange={setHasChanges}
              initialValues={initialValues}
              focusDescription={focusDescription}
              projectId={projectId}
            />
          ) : (
            <div className="text-sm text-text-muted">
              Choose a story to start describing the feature.
            </div>
          )}
        </div>
      </Modal>

      {/* Always mount the chat panel; it starts collapsed by default */}
      <ChatSidebarModalPanel
        context={context}
        chatContextTitle="Story Chat (New Feature)"
        initialWidth={360}
      />

      <AlertDialog
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        description={alertMessage}
        confirmText="DISCARD ALL"
        cancelText="Go Back"
        destructiveConfirm
        disableOutsideClose
        onConfirm={() => {
          setShowAlert(false)
          doClose()
        }}
      />
    </>
  )
}
