import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FeatureForm, FeatureFormValues } from '../components/FeatureForm'
import { tasksService } from '../services/tasksService'
import { projectsService } from '../services/projectsService'
import { useToast } from '../components/ui/Toast'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useActiveProject } from '../projects/ProjectContext'

export default function FeatureCreateView({ taskId, onRequestClose }: { taskId: string; onRequestClose?: () => void }) {
  const { toast } = useToast()
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const { project } = useActiveProject()

  const doClose = () => {
    onRequestClose?.()
  }

  const onSubmit = useCallback(
    async (values: FeatureFormValues) => {
      if (!project) {
        setAlertMessage('No project selected.')
        setShowAlert(true)
        return
      }
      if (!taskId) {
        setAlertMessage('No valid Task ID provided.')
        setShowAlert(true)
        return
      }
      setSubmitting(true)
      try {
        const res = await taskService.addFeature(project, taskId, values)
        if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
        toast({ title: 'Success', description: 'Feature created successfully', variant: 'success' })
        doClose()
      } catch (e: any) {
        setAlertMessage(`Failed to create feature: ${e?.message || String(e)}`)
        setShowAlert(true)
      } finally {
        setSubmitting(false)
      }
    },
    [taskId, toast, project]
  )

  if (!taskId) {
    return <div>Error: No Task ID provided.</div>
  }

  return (
    <>
      <Modal title="Create New Feature" onClose={doClose} isOpen={true} size="lg" initialFocusRef={titleRef as React.RefObject<HTMLElement>}>
        <FeatureForm
          onSubmit={onSubmit}
          onCancel={doClose}
          submitting={submitting}
          titleRef={titleRef}
          taskId={taskId}
        />
      </Modal>
      <AlertDialog isOpen={showAlert} onClose={() => setShowAlert(false)} description={alertMessage} />
    </>
  )
}
