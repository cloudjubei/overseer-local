import { useEffect, useMemo, useRef, useState } from 'react'
import StoryForm, { StoryFormValues } from '@renderer/components/stories/StoryForm'
import { AlertDialog, Modal } from '@renderer/components/ui/Modal'
import { useToast } from '@renderer/components/ui/Toast'
import { useNavigator } from '@renderer/navigation/Navigator'
import { useStories } from '@renderer/contexts/StoriesContext'
import { ChatContext, Story } from 'thefactory-tools'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { ChatSidebarModalPanel } from '@renderer/components/chat'
import { IconChat } from '@renderer/components/ui/Icons'

export default function StoryEditView({
  storyId,
  onRequestClose,
}: {
  storyId: string
  onRequestClose?: () => void
}) {
  const { toast } = useToast()
  const navigator = useNavigator()
  const [initialValues, setInitialValues] = useState<Story | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { storiesById, updateStory, deleteStory } = useStories()
  const { projectId } = useActiveProject()

  const [hasChanges, setHasChanges] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => {
    if (storyId && storiesById) {
      const t = storiesById[storyId]
      setInitialValues(t)
    } else {
      setInitialValues(null)
    }
  }, [storyId, storiesById])

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

  const onSubmit = async (values: StoryFormValues) => {
    setSubmitting(true)
    try {
      await updateStory(storyId, values)
      toast({ title: 'Success', description: 'Story updated successfully', variant: 'success' })
      doClose()
    } catch (e: any) {
      setAlertMessage(`Failed to update story: ${e?.message || String(e)}`)
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
      toast({ title: 'Success', description: 'Story deleted successfully', variant: 'success' })
      navigator.navigateView('Home')
      doClose()
    } catch (e: any) {
      setAlertMessage(`Failed to delete story: ${e.message || String(e)}`)
      setShowAlert(true)
    } finally {
      setDeleting(false)
    }
  }

  const context = useMemo(
    (): ChatContext => ({ type: 'STORY', projectId: projectId!, storyId }),
    [projectId, storyId],
  )

  return (
    <>
      <Modal
        title="Edit Story"
        onClose={attemptClose}
        isOpen={true}
        headerActions={
          <button
            className="btn-secondary btn-icon"
            onClick={() => setIsChatOpen((v) => !v)}
            aria-pressed={isChatOpen}
            aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
            title={isChatOpen ? 'Close chat' : 'Open chat'}
          >
            <IconChat className="w-4 h-4" />
          </button>
        }
        contentClassName="p-4 min-h-0 overflow-y-auto"
      >
        {initialValues ? (
          <StoryForm
            initialValues={{
              status: initialValues.status,
              title: initialValues.title,
              description: initialValues.description,
            }}
            onSubmit={onSubmit}
            onCancel={attemptClose}
            submitting={submitting || deleting}
            isCreate={false}
            onDelete={() => setShowDeleteConfirm(true)}
            onDirtyChange={setHasChanges}
          />
        ) : (
          <div className="py-8 text-center text-sm text-neutral-600 dark:text-neutral-300">
            Loading story…
          </div>
        )}
      </Modal>

      <ChatSidebarModalPanel
        isOpen={isChatOpen}
        context={context}
        chatContextTitle="Story Chat"
        initialWidth={380}
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
      <AlertDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Story"
        description="Are you sure you want to delete this story? This will also remove any features and blockers referencing it. This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
      />
    </>
  )
}
