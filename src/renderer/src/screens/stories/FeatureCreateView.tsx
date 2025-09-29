import React, { useCallback, useMemo, useRef, useState } from 'react'
import FeatureForm, { FeatureFormValues } from '@renderer/components/stories/FeatureForm'
import { useToast } from '@renderer/components/ui/Toast'
import { AlertDialog, Modal } from '@renderer/components/ui/Modal'
import { useStories } from '@renderer/contexts/StoriesContext'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { ChatSidebarOverlay } from '@renderer/components/chat'
import { IconChat } from '@renderer/components/ui/Icons'
import { ChatContext } from 'thefactory-tools'

export default function FeatureCreateView({
  storyId,
  onRequestClose,
  initialValues,
  focusDescription = false,
}: {
  storyId: string
  onRequestClose?: () => void
  initialValues?: Partial<FeatureFormValues>
  focusDescription?: boolean
}) {
  const { toast } = useToast()
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const { addFeature } = useStories()
  const { projectId } = useActiveProject()

  const [hasChanges, setHasChanges] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

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
    async (values: FeatureFormValues) => {
      if (!storyId) {
        setAlertMessage('No valid Story ID provided.')
        setShowAlert(true)
        return
      }
      setSubmitting(true)
      try {
        await addFeature(storyId, {
          ...values,
          description: values.description ?? '',
        })
        toast({ title: 'Success', description: 'Feature created successfully', variant: 'success' })
        doClose()
      } catch (e: any) {
        setAlertMessage(`Failed to create feature: ${e?.message || String(e)}`)
        setShowAlert(true)
      } finally {
        setSubmitting(false)
      }
    },
    [storyId, toast, addFeature],
  )

  if (!storyId) {
    return <div>Error: No Story ID provided.</div>
  }

  const formId = 'feature-form-create'
  const context = useMemo(
    (): ChatContext => ({ type: 'STORY', projectId: projectId!, storyId }),
    [projectId, storyId],
  )

  return (
    <>
      <Modal
        title="Create New Feature"
        onClose={attemptClose}
        isOpen={true}
        size={'lg'}
        initialFocusRef={titleRef as React.RefObject<HTMLElement>}
        headerActions={
          <button
            className="btn-secondary btn-icon"
            onClick={() => setIsChatOpen((v) => !v)}
            aria-pressed={isChatOpen}
            aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
            title={isChatOpen ? 'Close chat' : 'Open chat'}
          >
            <IconChat className="w-4 h-4" />
          </button>
        }
        contentClassName="flex-grow overflow-hidden p-0 min-h-0"
        footer={
          <div className="flex justify-between gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={attemptClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              form={formId}
              disabled={submitting}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              title="Cmd/Ctrl+Enter to submit"
            >
              Create Feature
            </button>
          </div>
        }
      >
        <div className="w-full h-full flex min-h-0">
          <div className="flex-1 min-w-0 min-h-0 h-full flex">
            <FeatureForm
              onSubmit={onSubmit}
              onCancel={attemptClose}
              submitting={submitting}
              titleRef={titleRef}
              storyId={storyId}
              hideActions
              formId={formId}
              onDirtyChange={setHasChanges}
              initialValues={initialValues}
              focusDescription={focusDescription}
            />
          </div>
        </div>
      </Modal>

      <ChatSidebarOverlay
        isOpen={isChatOpen}
        context={context}
        chatContextTitle="Story Chat (New Feature)"
        initialWidth={360}
      />

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
