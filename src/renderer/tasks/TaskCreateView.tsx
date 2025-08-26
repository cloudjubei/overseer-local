import React, { useCallback, useRef, useState } from 'react'
import { TaskForm, TaskFormValues } from '../components/TaskForm'
import { useNextTaskId } from '../hooks/useNextTaskId'
import { tasksService } from '../services/tasksService'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'

export default function TaskCreateView({ onRequestClose }: { onRequestClose?: () => void }) {
  const { toast } = useToast()
  const defaultId = useNextTaskId()
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const doClose = () => {
    onRequestClose?.()
  }

  const onSubmit = useCallback(
    async (values: TaskFormValues) => {
      if (!Number.isInteger(values.id) || (values.id as number) <= 0) {
        setAlertMessage('Please provide a valid positive integer ID')
        setShowAlert(true)
        return
      }
      setSubmitting(true)
      try {
        const res = await tasksService.addTask({ ...values })
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
    [toast]
  )

  return (
    <>
      <Modal title="Create New Task" onClose={doClose} isOpen={true} size="md" initialFocusRef={titleRef as React.RefObject<HTMLElement>}>
        <TaskForm
          initialValues={{ id: defaultId }}
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
