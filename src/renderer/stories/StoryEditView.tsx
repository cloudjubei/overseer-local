import { useEffect, useMemo, useRef, useState } from 'react'
import StoryForm, { StoryFormValues } from '../components/stories/StoryForm'
import { AlertDialog, Modal } from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { useNavigator } from '../navigation/Navigator'
import { useStories } from '../contexts/StoriesContext'
import { Story } from 'thefactory-tools'
import { useActiveProject } from '../contexts/ProjectContext'
import ChatSidebar from '../components/Chat/ChatSidebar'
import { IconChat } from '../components/ui/Icons'

export default function StoryEditView({
  storyId,
  onRequestClose,
}: {
  storyId: string
  onRequestClose?: () => void
}) {
  const { toast } = useToast()
  const navigator = useNavigator()
  const [initialValues, setInitialValues] = useState<Story | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { storiesById, updateStory, deleteStory } = useStories()
  const { projectId } = useActiveProject()

  const [hasChanges, setHasChanges] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatWidth, setChatWidth] = useState<number>(380)
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    if (storyId && storiesById) {
      const t = storiesById[storyId]
      setInitialValues(t)
    } else {
      setInitialValues(null)
    }
  }, [storyId, storiesById])

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

  const onSubmit = async (values: StoryFormValues) => {
    setSubmitting(true)
    try {
      await updateStory(storyId, values)
      toast({ title: 'Success', description: 'Story updated successfully', variant: 'success' })
      doClose()
    } catch (e: any) {
      setAlertMessage(`Failed to update story: ${e?.message || String(e)}`)
      setShowAlert(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setShowDeleteConfirm(false)
    setDeleting(true)
    try {
      await deleteStory(storyId)
      toast({ title: 'Success', description: 'Story deleted successfully', variant: 'success' })
      navigator.navigateView('Home')
      doClose()
    } catch (e: any) {
      setAlertMessage(`Failed to delete story: ${e.message || String(e)}`)
      setShowAlert(true)
    } finally {
      setDeleting(false)
    }
  }

  const contextId = useMemo(() => `${projectId}/${storyId}`, [projectId, storyId])

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
        title="Edit Story"
        onClose={attemptClose}
        isOpen={true}
        size={isChatOpen ? 'xl' : undefined}
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
            {initialValues ? (
              <StoryForm
                id={`${initialValues.id}`}
                initialValues={{
                  status: initialValues.status,
                  title: initialValues.title,
                  description: initialValues.description,
                }}
                onSubmit={onSubmit}
                onCancel={attemptClose}
                submitting={submitting || deleting}
                isCreate={false}
                onDelete={() => setShowDeleteConfirm(true)}
                onDirtyChange={setHasChanges}
              />
            ) : (
              <div className="py-8 text-center text-sm text-neutral-600 dark:text-neutral-300">
                Loading story…
              </div>
            )}
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
              {isChatOpen && <ChatSidebar contextId={contextId} chatContextTitle="Story Chat" />}
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
      <AlertDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Feature"
        description="Are you sure you want to delete this feature? This will also remove any blockers referencing it. This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
      />
    </>
  )
}
