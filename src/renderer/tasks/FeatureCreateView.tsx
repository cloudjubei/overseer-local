import React, { useCallback, useRef, useState } from 'react'
import FeatureForm, { FeatureFormValues } from '../components/tasks/FeatureForm'
import { useToast } from '../components/ui/Toast'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useTasks } from '../contexts/TasksContext'

export default function FeatureCreateView({
  taskId,
  onRequestClose,
}: {
  taskId: string
  onRequestClose?: () => void
}) {
  const { toast } = useToast()
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const { addFeature } = useTasks()

  const doClose = () => {
    onRequestClose?.()
  }

  const onSubmit = useCallback(
    async (values: FeatureFormValues) => {
      if (!taskId) {
        setAlertMessage('No valid Task ID provided.')
        setShowAlert(true)
        return
      }
      setSubmitting(true)
      try {
        const res = await addFeature(taskId, values)
        if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
        toast({ title: 'Success', description: 'Feature created successfully', variant: 'success' })
        doClose()
      } catch (e: any) {
        setAlertMessage(`Failed to create feature: ${e?.message || String(e)}`)
        setShowAlert(true)
      } finally {
        setSubmitting(false)
      }
    },
    [taskId, toast, addFeature],
  )

  if (!taskId) {
    return <div>Error: No Task ID provided.</div>
  }

  const formId = 'feature-form-create'

  return (
    <>
      <Modal
        title="Create New Feature"
        onClose={doClose}
        isOpen={true}
        size="lg"
        initialFocusRef={titleRef as React.RefObject<HTMLElement>}
        footer={
          <div className="flex justify-between gap-2">
            <button type="button" className="btn-secondary" onClick={doClose} disabled={submitting}>
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
          onCancel={doClose}
          submitting={submitting}
          titleRef={titleRef}
          taskId={taskId}
          hideActions
          formId={formId}
        />
      </Modal>
      <AlertDialog
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        description={alertMessage}
      />
    </>
  )
}
