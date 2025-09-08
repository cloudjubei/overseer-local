import { useCallback, useEffect, useState } from 'react'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import type { Feature } from 'thefactory-tools';
import { useTasks } from '../hooks/useTasks'
import FeatureForm, { FeatureFormValues } from '../components/tasks/FeatureForm'

export default function FeatureEditView({ taskId, featureId, onRequestClose }: { taskId: string; featureId: string; onRequestClose?: () => void }) {
  const { toast } = useToast()
  const [initialValues, setInitialValues] = useState<Feature | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { featuresById, updateFeature, deleteFeature } = useTasks()

  const doClose = () => {
    onRequestClose?.()
  }

  useEffect(() => {
    if (taskId && featuresById) {
      const f = featuresById[featureId]
      setInitialValues(f)
    } else {
      setInitialValues(null)
    }
  }, [taskId, featureId, featuresById])

  const onSubmit = useCallback(
    async (values: FeatureFormValues) => {
      setSubmitting(true)
      try {
        const res = await updateFeature(taskId, featureId, values)
        if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
        toast({ title: 'Success', description: 'Feature updated successfully', variant: 'success' })
        doClose()
      } catch (e: any) {
        setAlertMessage(`Failed to update feature: ${e?.message || String(e)}`)
        setShowAlert(true)
      } finally {
        setSubmitting(false)
      }
    },
    [taskId, featureId, toast, updateFeature]
  )

  const handleDelete = async () => {
    setShowDeleteConfirm(false)
    setSubmitting(true)
    try {
      const res = await deleteFeature(taskId, featureId)
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
      toast({ title: 'Success', description: 'Feature deleted successfully', variant: 'success' })
      doClose()
    } catch (e: any) {
      setAlertMessage(`Failed to delete feature: ${e.message || String(e)}`)
      setShowAlert(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Modal title="Edit Feature" onClose={doClose} isOpen={true}>
        {initialValues ? (
          <FeatureForm
            initialValues={initialValues}
            onSubmit={onSubmit}
            onCancel={doClose}
            onDelete={() => setShowDeleteConfirm(true)}
            submitting={submitting}
            taskId={taskId}
            featureId={featureId}
          />
        ) : (
          <div className="py-8 text-center text-sm text-neutral-600 dark:text-neutral-300">Loading feature…</div>
        )}
      </Modal>
      <AlertDialog isOpen={showAlert} onClose={() => setShowAlert(false)} description={alertMessage} />
      <AlertDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Feature"
        description="Are you sure you want to delete this feature? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
      />
    </>
  )
}
