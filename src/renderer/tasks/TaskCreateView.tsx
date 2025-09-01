import React, { useCallback, useRef, useState } from 'react'
import { TaskForm, TaskFormValues } from '../components/TaskForm'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { useTasks } from '../hooks/useTasks'
import { TaskCreateInput } from '../services/tasksService'

export default function TaskCreateView({ onRequestClose }: { onRequestClose?: () => void }) {
  const { toast } = useToast()
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const { createTask } = useTasks()

  const doClose = () => {
    onRequestClose?.()
  }

  const onSubmit = useCallback(
    async (values: TaskFormValues) => {
      setSubmitting(true)
      try {
        const res = await createTask({ ...values } as TaskCreateInput)
        if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
        toast({ title: 'Success', description: 'Task created successfully', variant: 'success' })
        doClose()
      } catch (e: any) {
        setAlertMessage(`Failed to create task: ${e?.message || String(e)}`)
        setShowAlert(true)
      } finally {
        setSubmitting(false)
      }
    },
    [toast, createTask]
  )

  return (
    <>
      <Modal title="Create New Task" onClose={doClose} isOpen={true} size="md" initialFocusRef={titleRef as React.RefObject<HTMLElement>}>
        <TaskForm
          id="-1"
          initialValues={{ }}
          onSubmit={onSubmit}
          onCancel={doClose}
          submitting={submitting}
          isCreate={true}
          titleRef={titleRef}
        />
      </Modal>
      <AlertDialog isOpen={showAlert} onClose={() => setShowAlert(false)} description={alertMessage} />
    </>
  )
}
