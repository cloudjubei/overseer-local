import React, { useEffect, useState } from 'react'
import { FeatureForm, FeatureFormValues } from '../components/FeatureForm'
import { tasksService } from '../services/tasksService'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import type { Feature, Task } from 'src/types/tasks'

export default function FeatureEditView({ taskId, featureId, onRequestClose }: { taskId: number; featureId: string; onRequestClose?: () => void }) {
  const { toast } = useToast()
  const [initialValues, setInitialValues] = useState<Feature | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const doClose = () => {
    onRequestClose?.()
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const idx = await tasksService.getSnapshot()
        const task: Task | undefined = idx.tasksById[taskId]
        if (!task) throw new Error('Task not found')
        const feature = task.features.find((f: Feature) => f.id === featureId)
        if (!feature) throw new Error('Feature not found')
        if (!cancelled) setInitialValues(feature)
      } catch (e: any) {
        if (!cancelled) {
          setAlertMessage(`Failed to load feature: ${e.message || String(e)}`)
          setShowAlert(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [taskId, featureId])

  const onSubmit = async (values: FeatureFormValues) => {
    setSubmitting(true)
    try {
      const res = await tasksService.updateFeature(taskId, featureId, values)
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
      toast({ title: 'Success', description: 'Feature updated successfully', variant: 'success' })
      doClose()
    } catch (e: any) {
      setAlertMessage(`Failed to update feature: ${e?.message || String(e)}`)
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
            submitting={submitting}
            isCreate={false}
          />
        ) : (
          <div className="py-8 text-center text-sm text-neutral-600 dark:text-neutral-300">Loading feature…</div>
        )}
      </Modal>
      <AlertDialog isOpen={showAlert} onClose={() => setShowAlert(false)} description={alertMessage} />
    </>
  )
}
