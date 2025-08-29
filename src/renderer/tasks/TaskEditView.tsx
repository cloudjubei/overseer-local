import { useEffect, useState } from 'react'
import { TaskForm, TaskFormValues } from '../components/TaskForm'
import { taskService } from '../services/taskService'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { useNavigator } from '../navigation/Navigator'
import type { Task } from 'src/types/tasks'

export default function TaskEditView({ taskId, onRequestClose }: { taskId: number; onRequestClose?: () => void }) {
  const { toast } = useToast()
  const navigator = useNavigator()
  const [initialValues, setInitialValues] = useState<Task | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const doClose = () => {
    onRequestClose?.()
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const idx = await taskService.getSnapshot()
        const task = idx.tasksById[taskId]
        if (!task) throw new Error('Task not found')
        if (!cancelled) setInitialValues(task)
      } catch (e: any) {
        if (!cancelled) {
          setAlertMessage(`Failed to load task: ${e.message || String(e)}`)
          setShowAlert(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [taskId])

  const onSubmit = async (values: TaskFormValues) => {
    setSubmitting(true)
    try {
      const res = await taskService.updateTask(taskId, values)
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
      toast({ title: 'Success', description: 'Task updated successfully', variant: 'success' })
      doClose()
    } catch (e: any) {
      setAlertMessage(`Failed to update task: ${e?.message || String(e)}`)
      setShowAlert(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setShowDeleteConfirm(false)
    setDeleting(true)
    try {
      const res = await taskService.deleteTask(taskId)
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
      toast({ title: 'Success', description: 'Task deleted successfully', variant: 'success' })
      navigator.navigateView('Home')
      doClose()
    } catch (e: any) {
      setAlertMessage(`Failed to delete task: ${e.message || String(e)}`)
      setShowAlert(true)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Modal title="Edit Task" onClose={doClose} isOpen={true}>
        {initialValues ? (
          <TaskForm
            id={`${initialValues.id}`}
            initialValues={{ status: initialValues.status, title: initialValues.title, description: initialValues.description }}
            onSubmit={onSubmit}
            onCancel={doClose}
            submitting={submitting || deleting}
            isCreate={false}
            onDelete={() => setShowDeleteConfirm(true)}
          />
        ) : (
          <div className="py-8 text-center text-sm text-neutral-600 dark:text-neutral-300">Loading task…</div>
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
