import React, { useCallback, useRef, useState } from 'react'
import StoryForm, { StoryFormValues } from '../components/stories/StoryForm'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { useStories } from '../contexts/StoriesContext'
import { StoryCreateInput } from 'thefactory-tools'
import { useActiveProject } from '../contexts/ProjectContext'
import ContextualChatSidebar from '../components/Chat/ContextualChatSidebar'

export default function StoryCreateView({ onRequestClose }: { onRequestClose?: () => void }) {
  const { toast } = useToast()
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const { createStory } = useStories()
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
    async (values: StoryFormValues) => {
      setSubmitting(true)
      try {
        const story = await createStory({ ...values } as StoryCreateInput)
        toast({ title: 'Success', description: 'Story created successfully', variant: 'success' })
        doClose()
      } catch (e: any) {
        setAlertMessage(`Failed to create story: ${e?.message || String(e)}`)
        setShowAlert(true)
      } finally {
        setSubmitting(false)
      }
    },
    [toast, createStory],
  )

  // While creating a story, we don't yet have a storyId; use project-level chat context.
  const contextId = projectId

  return (
    <>
      <Modal
        title="Create New Story"
        onClose={attemptClose}
        isOpen={true}
        size={isChatOpen ? 'xl' : 'md'}
        initialFocusRef={titleRef as React.RefObject<HTMLElement>}
        headerActions={
          <button
            className="btn-secondary"
            onClick={() => setIsChatOpen((v) => !v)}
            aria-pressed={isChatOpen}
          >
            {isChatOpen ? 'Close Chat' : 'Chat'}
          </button>
        }
        contentClassName={isChatOpen ? 'flex-grow overflow-hidden p-0' : undefined}
      >
        {isChatOpen ? (
          <div className="w-full h-full flex">
            <div className="flex-1 min-w-0 max-h-full overflow-y-auto p-4">
              <StoryForm
                id="-1"
                initialValues={{}}
                onSubmit={onSubmit}
                onCancel={attemptClose}
                submitting={submitting}
                isCreate={true}
                titleRef={titleRef}
                onDirtyChange={setHasChanges}
              />
            </div>
            <div className="w-[320px] border-l border-border bg-surface-base">
              <ContextualChatSidebar contextId={contextId} chatContextTitle="Project Chat (New Story)" />
            </div>
          </div>
        ) : (
          <StoryForm
            id="-1"
            initialValues={{}}
            onSubmit={onSubmit}
            onCancel={attemptClose}
            submitting={submitting}
            isCreate={true}
            titleRef={titleRef}
            onDirtyChange={setHasChanges}
          />
        )}
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
