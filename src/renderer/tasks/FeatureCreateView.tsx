import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FeatureForm, FeatureFormValues } from '../components/FeatureForm'
import { tasksService } from '../services/tasksService'
import { projectsService } from '../services/projectsService'
import { useToast } from '../components/ui/Toast'
import { AlertDialog, Modal } from '../components/ui/Modal'
import type { TasksIndexSnapshot } from '../services/tasksService'
import type { ProjectsIndexSnapshot } from '../services/projectsService'

export default function FeatureCreateView({ taskId, onRequestClose }: { taskId: number; onRequestClose?: () => void }) {
  const { toast } = useToast()
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [snapshot, setSnapshot] = useState<TasksIndexSnapshot | null>(null)
  const [projectsSnapshot, setProjectsSnapshot] = useState<ProjectsIndexSnapshot | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchSnapshots = async () => {
      const [tasksSnap, projectsSnap] = await Promise.all([
        tasksService.getSnapshot(),
        projectsService.getSnapshot()
      ])
      setSnapshot(tasksSnap)
      setProjectsSnapshot(projectsSnap)
    }
    fetchSnapshots()
  }, [])

  const doClose = () => {
    onRequestClose?.()
  }

  const onSubmit = useCallback(
    async (values: FeatureFormValues) => {
      if (!taskId || !Number.isInteger(taskId)) {
        setAlertMessage('No valid Task ID provided.')
        setShowAlert(true)
        return
      }
      setSubmitting(true)
      try {
        const res = await tasksService.addFeature(taskId, values)
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
    [taskId, toast]
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
          isCreate={true}
          titleRef={titleRef}
          allTasksSnapshot={snapshot}
          allProjectsSnapshot={projectsSnapshot}
          taskId={taskId}
        />
      </Modal>
      <AlertDialog isOpen={showAlert} onClose={() => setShowAlert(false)} description={alertMessage} />
    </>
  )
}
