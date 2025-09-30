import React, { useCallback, useMemo, useRef, useState } from 'react'
import StoryForm, { StoryFormValues } from '@renderer/components/stories/StoryForm'
import { AlertDialog, Modal } from '@renderer/components/ui/Modal'
import { useToast } from '@renderer/components/ui/Toast'
import { useStories } from '@renderer/contexts/StoriesContext'
import { ChatContext, StoryCreateInput } from 'thefactory-tools'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { ChatSidebarModalPanel } from '@renderer/components/chat'
import { IconChat } from '@renderer/components/ui/Icons'

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
        await createStory({ ...values } as StoryCreateInput)
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
  const context = useMemo(
    (): ChatContext => ({
      type: 'PROJECT_TOPIC',
      projectId: projectId!,
      projectTopic: 'create_story',
    }),
    [projectId],
  )

  return (
    <>
      <Modal
        title="Create New Story"
        onClose={attemptClose}
        isOpen={true}
        size={'md'}
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
        contentClassName="p-4 min-h-0 overflow-y-auto"
      >
        <StoryForm
          initialValues={{}}
          onSubmit={onSubmit}
          onCancel={attemptClose}
          submitting={submitting}
          isCreate={true}
          titleRef={titleRef}
          onDirtyChange={setHasChanges}
        />
      </Modal>

      <ChatSidebarModalPanel
        isOpen={isChatOpen}
        context={context}
        chatContextTitle="Project Chat (New Story)"
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
