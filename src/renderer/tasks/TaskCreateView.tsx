import React, { useCallback, useRef, useState } from 'react'
import TaskForm, { TaskFormValues } from '../components/tasks/TaskForm'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { useTasks } from '../contexts/TasksContext'
import { TaskCreateInput } from 'thefactory-tools'

export default function TaskCreateView({ onRequestClose }: { onRequestClose?: () => void }) {
  const { toast } = useToast()
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const { createTask } = useTasks()

  const [hasChanges, setHasChanges] = useState(false)

  const doClose = () => {
    onRequestClose?.()
  }

  const attemptClose = () => {
    if (hasChanges) {
      setAlertMessage('You have unsaved changes. Do you really want to discard all changes?')
      setShowAlert(true)
      return
    }
    doClose()
  }

  const onSubmit = useCallback(
    async (values: TaskFormValues) => {
      setSubmitting(true)
      try {
        const task = await createTask({ ...values } as TaskCreateInput)
        toast({ title: 'Success', description: 'Task created successfully', variant: 'success' })
        doClose()
      } catch (e: any) {
        setAlertMessage(`Failed to create task: ${e?.message || String(e)}`)
        setShowAlert(true)
      } finally {
        setSubmitting(false)
      }
    },
    [toast, createTask],
  )

  return (
    <>
      <Modal
        title="Create New Task"
        onClose={attemptClose}
        isOpen={true}
        size="md"
        initialFocusRef={titleRef as React.RefObject<HTMLElement>}
      >
        <TaskForm
          id="-1"
          initialValues={{}}
          onSubmit={onSubmit}
          onCancel={attemptClose}
          submitting={submitting}
          isCreate={true}
          titleRef={titleRef}
          onDirtyChange={setHasChanges}
        />
      </Modal>
      <AlertDialog
        isOpen={showAlert}
        onClose={() => setShowAlert(false)}
        description={alertMessage}
        confirmText="DISCARD ALL"
        cancelText="Go Back"
        destructiveConfirm
        disableOutsideClose
        onConfirm={() => {
          setShowAlert(false)
          doClose()
        }}
      />
    </>
  )
}
