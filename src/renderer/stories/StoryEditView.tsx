import { useEffect, useState } from 'react'
import StoryForm, { StoryFormValues } from '../components/stories/StoryForm'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { useNavigator } from '../navigation/Navigator'
import { useStories } from '../contexts/StoriesContext'
import { Story } from 'thefactory-tools'

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

  const [hasChanges, setHasChanges] = useState(false)

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
      const story = await updateStory(storyId, values)
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
      const story = await deleteStory(storyId)
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

  return (
    <>
      <Modal title="Edit Story" onClose={attemptClose} isOpen={true}>
        {initialValues ? (
          <StoryForm
            id={`${initialValues.id}`}
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
        title="Delete Feature"
        description="Are you sure you want to delete this feature? This will also remove any blockers referencing it. This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
      />
    </>
  )
}
