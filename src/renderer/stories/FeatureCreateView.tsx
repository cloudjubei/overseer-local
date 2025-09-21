import React, { useCallback, useRef, useState } from 'react'
import FeatureForm, { FeatureFormValues } from '../components/stories/FeatureForm'
import { useToast } from '../components/ui/Toast'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useStories } from '../contexts/StoriesContext'
import { Status } from 'thefactory-tools'

export default function FeatureCreateView({
  storyId,
  onRequestClose,
}: {
  storyId: string
  onRequestClose?: () => void
}) {
  const { toast } = useToast()
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const { addFeature } = useStories()

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
    async (values: FeatureFormValues) => {
      if (!storyId) {
        setAlertMessage('No valid Story ID provided.')
        setShowAlert(true)
        return
      }
      setSubmitting(true)
      try {
        const story = await addFeature(storyId, {
          title: values.title,
          status: values.status ?? '-',
          description: values.description ?? '',
          context: values.context ?? [],
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
    [storyId, toast, addFeature],
  )

  if (!storyId) {
    return <div>Error: No Story ID provided.</div>
  }

  const formId = 'feature-form-create'

  return (
    <>
      <Modal
        title="Create New Feature"
        onClose={attemptClose}
        isOpen={true}
        size="lg"
        initialFocusRef={titleRef as React.RefObject<HTMLElement>}
        footer={
          <div className="flex justify-between gap-2">
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
              disabled={submitting}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              title="Cmd/Ctrl+Enter to submit"
            >
              Create Feature
            </button>
          </div>
        }
      >
        <FeatureForm
          onSubmit={onSubmit}
          onCancel={attemptClose}
          submitting={submitting}
          titleRef={titleRef}
          storyId={storyId}
          hideActions
          formId={formId}
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
