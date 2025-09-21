import React, { useCallback, useRef, useState } from 'react'
import StoryForm, { StoryFormValues } from '../components/stories/StoryForm'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { useStories } from '../contexts/StoriesContext'
import { StoryCreateInput } from 'thefactory-tools'

export default function StoryCreateView({ onRequestClose }: { onRequestClose?: () => void }) {
  const { toast } = useToast()
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const { createStory } = useStories()

  const [hasChanges, setHasChanges] = useState(false)

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
    async (values: StoryFormValues) => {
      setSubmitting(true)
      try {
        const story = await createStory({ ...values } as StoryCreateInput)
        toast({ title: 'Success', description: 'Story created successfully', variant: 'success' })
        doClose()
      } catch (e: any) {
        setAlertMessage(`Failed to create story: ${e?.message || String(e)}`)
        setShowAlert(true)
      } finally {
        setSubmitting(false)
      }
    },
    [toast, createStory],
  )

  return (
    <>
      <Modal
        title="Create New Story"
        onClose={attemptClose}
        isOpen={true}
        size="md"
        initialFocusRef={titleRef as React.RefObject<HTMLElement>}
      >
        <StoryForm
          id="-1"
          initialValues={{}}
          onSubmit={onSubmit}
          onCancel={attemptClose}
          submitting={submitting}
          isCreate={true}
          titleRef={titleRef}
          onDirtyChange={setHasChanges}
        />
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
    </>
  )
}
