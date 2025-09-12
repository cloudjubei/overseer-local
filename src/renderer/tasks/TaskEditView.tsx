import { useEffect, useState } from 'react'
import TaskForm, { TaskFormValues } from '../components/tasks/TaskForm'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { useNavigator } from '../navigation/Navigator'
import { useTasks } from '../contexts/TasksContext'
import { Task } from 'thefactory-tools';

export default function TaskEditView({ taskId, onRequestClose }: { taskId: string; onRequestClose?: () => void }) {
  const { toast } = useToast()
  const navigator = useNavigator()
  const [initialValues, setInitialValues] = useState<Task | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { tasksById, updateTask, deleteTask } = useTasks()

  useEffect(() => {
    if (taskId && tasksById) {
      const t = tasksById[taskId]
      setInitialValues(t)
    } else {
      setInitialValues(null)
    }
  }, [taskId, tasksById])

  const doClose = () => {
    onRequestClose?.()
  }

  const onSubmit = async (values: TaskFormValues) => {
    setSubmitting(true)
    try {
      const res = await updateTask(taskId, values)
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
      const res = await deleteTask(taskId)
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
        description="Are you sure you want to delete this feature? This will also remove any blockers referencing it. This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
      />
    </>
  )
}
