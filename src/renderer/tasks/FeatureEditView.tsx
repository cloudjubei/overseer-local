import React, { useCallback, useEffect, useState } from 'react'
import { FeatureForm, FeatureFormValues } from '../components/FeatureForm'
import { taskService } from '../services/taskService'
import { projectsService } from '../services/projectsService'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import type { Feature, Task } from 'src/types/tasks'
import { useActiveProject } from '../projects/ProjectContext'

export default function FeatureEditView({ taskId, featureId, onRequestClose }: { taskId: string; featureId: string; onRequestClose?: () => void }) {
  const { toast } = useToast()
  const [task, setTask] = useState<Task | null>(null)
  const [initialValues, setInitialValues] = useState<Feature | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { project } = useActiveProject()

  const doClose = () => {
    onRequestClose?.()
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const idx = await taskService.getSnapshot()
        const loadedTask: Task | undefined = idx.tasksById[taskId]
        if (!loadedTask) throw new Error('Task not found')
        const feature = loadedTask.features.find((f: Feature) => f.id === featureId)
        if (!feature) throw new Error('Feature not found')
        if (!cancelled) {
          setTask(loadedTask)
          setInitialValues(feature)
          setSnapshot(idx)
        }
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

  const onSubmit = useCallback(
    async (values: FeatureFormValues) => {
      if (!project) {
        setAlertMessage('No project selected.')
        setShowAlert(true)
        return
      }
      setSubmitting(true)
      try {
        const res = await taskService.updateFeature(project, taskId, featureId, values)
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
    [taskId, toast, project]
  )

  const handleDelete = async () => {
    setShowDeleteConfirm(false)
    setSubmitting(true)
    try {
      if (!task) throw new Error('Task not found')
      const dependents = task.features.filter(f => f.dependencies?.includes(featureId) ?? false)
      for (const dep of dependents) {
        const newDeps = dep.dependencies.filter(d => d !== featureId)
        await taskService.updateFeature(taskId, dep.id, { dependencies: newDeps })
      }
      const res = await taskService.deleteFeature(taskId, featureId)
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
            isCreate={false}
            allTasksSnapshot={snapshot}
            allProjectsSnapshot={projectsSnapshot}
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
        description="Are you sure you want to delete this feature? This will also remove any dependencies referencing it. This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
      />
    </>
  )
}
