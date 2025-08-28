import { useEffect, useState } from 'react'
import { TaskForm, TaskFormValues } from '../components/TaskForm'
import { tasksService } from '../services/tasksService'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import type { Task } from 'src/types/tasks'

export default function TaskEditView({ taskId, onRequestClose }: { taskId: number; onRequestClose?: () => void }) {
  const { toast } = useToast()
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
        const idx = await tasksService.getSnapshot()
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
      const res = await tasksService.updateTask(taskId, values)
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

  const handleDelete = () => {
    setShowDeleteConfirm(true)
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
            onDelete={handleDelete}
          />
        ) : (
          <div className="py-8 text-center text-sm text-neutral-600 dark:text-neutral-300">Loading task…</div>
        )}
      </Modal>
      <AlertDialog isOpen={showAlert} onClose={() => setShowAlert(false)} description={alertMessage} />
      {showDeleteConfirm && (
        <Modal title="Delete Task" onClose={() => setShowDeleteConfirm(false)} isOpen={true} size="sm">
          <p className="py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Are you sure you want to delete this task? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-destructive"
              disabled={deleting}
              onClick={async () => {
                setShowDeleteConfirm(false)
                setDeleting(true)
                try {
                  const res = await tasksService.deleteTask(taskId)
                  if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
                  toast({ title: 'Success', description: 'Task deleted successfully', variant: 'success' })
                  doClose()
                } catch (e: any) {
                  setAlertMessage(`Failed to delete task: ${e.message || String(e)}`)
                  setShowAlert(true)
                } finally {
                  setDeleting(false)
                }
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
