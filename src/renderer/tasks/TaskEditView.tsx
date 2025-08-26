import React, { useEffect, useState } from 'react'
import { Modal, AlertDialog, useToast } from '../components/ui'
import { TaskForm } from '../components/TaskForm'
import { tasksService } from '../services/tasksService'

export default function TaskEditView({ taskId, onRequestClose }: { taskId: number; onRequestClose?: () => void }) {
  const { toast } = useToast()
  const [initialValues, setInitialValues] = useState<any>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const doClose = () => {
    onRequestClose?.()
  }

  useEffect(() => {
    ;(async () => {
      try {
        const idx = await tasksService.getSnapshot()
        const task = idx.tasksById[taskId]
        if (!task) throw new Error('Task not found')
        setInitialValues(task)
      } catch (e: any) {
        setAlertMessage(`Failed to load task: ${e.message || String(e)}`)
        setShowAlert(true)
      }
    })()
  }, [taskId])

  const onSubmit = async (values: any) => {
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

  if (!initialValues) return <div>Loading...</div>

  return (
    <>
      <Modal title="Edit Task" onClose={doClose} isOpen={true}>
        <TaskForm initialValues={initialValues} onSubmit={onSubmit} onCancel={doClose} submitting={submitting} isCreate={false} />
      </Modal>
      <AlertDialog isOpen={showAlert} onClose={() => setShowAlert(false)} description={alertMessage} />
    </>
  )
}
