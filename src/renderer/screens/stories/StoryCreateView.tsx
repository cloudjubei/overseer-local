import React, { useCallback, useMemo, useRef, useState } from 'react'
import StoryForm, { StoryFormValues } from '../../components/Stories/StoryForm'
import { AlertDialog, Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useStories } from '../../contexts/StoriesContext'
import { ChatContext, StoryCreateInput } from 'thefactory-tools'
import { useActiveProject } from '../../contexts/ProjectContext'
import ChatSidebar from '../../components/Chat/ChatSidebar'
import { IconChat } from '../../components/ui/Icons'

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
  const [chatWidth, setChatWidth] = useState<number>(360)
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null)

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
    (): ChatContext => ({ type: 'PROJECT', projectId: projectId! }),
    [projectId],
  )

  // Resize handlers
  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isChatOpen) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    resizingRef.current = { startX: e.clientX, startWidth: chatWidth }
    window.addEventListener('pointermove', onResizeMove)
    window.addEventListener('pointerup', onResizeEnd)
  }
  const onResizeMove = (e: PointerEvent) => {
    if (!resizingRef.current) return
    const { startX, startWidth } = resizingRef.current
    const dx = e.clientX - startX
    const next = startWidth - dx
    const clamped = Math.max(280, Math.min(640, next))
    setChatWidth(clamped)
  }
  const onResizeEnd = (_e: PointerEvent) => {
    resizingRef.current = null
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeEnd)
  }

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
            className="btn-secondary btn-icon"
            onClick={() => setIsChatOpen((v) => !v)}
            aria-pressed={isChatOpen}
            aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
            title={isChatOpen ? 'Close chat' : 'Open chat'}
          >
            <IconChat className="w-4 h-4" />
          </button>
        }
        contentClassName="flex-grow overflow-hidden p-0"
      >
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
          <div
            className="relative flex-shrink-0 border-l border-border bg-surface-base"
            style={{ width: isChatOpen ? chatWidth : 0, transition: 'width 240ms ease' }}
            aria-hidden={!isChatOpen}
          >
            {isChatOpen && (
              <div
                onPointerDown={onResizeStart}
                className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--border-subtle)]"
                style={{ zIndex: 1 }}
                aria-label="Resize chat sidebar"
                role="separator"
                aria-orientation="vertical"
              />
            )}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                opacity: isChatOpen ? 1 : 0,
                transition: 'opacity 200ms ease 80ms',
                pointerEvents: isChatOpen ? 'auto' : 'none',
              }}
            >
              {isChatOpen && (
                <ChatSidebar context={context} chatContextTitle="Project Chat (New Story)" />
              )}
            </div>
          </div>
        </div>
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
