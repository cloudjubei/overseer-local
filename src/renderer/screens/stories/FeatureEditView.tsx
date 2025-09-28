import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChatSidebar } from '../../components/Chat'
import FeatureForm, { FeatureFormValues } from '../../components/Stories/FeatureForm'
import { Button } from '../../components/ui/Button'
import { IconChat, IconDelete } from '../../components/ui/Icons'
import { AlertDialog, Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useActiveProject } from '../../contexts/ProjectContext'
import { useStories } from '../../contexts/StoriesContext'
import type { ChatContext, Feature } from 'thefactory-tools'

export default function FeatureEditView({
  storyId,
  featureId,
  onRequestClose,
}: {
  storyId: string
  featureId: string
  onRequestClose?: () => void
}) {
  const { toast } = useToast()
  const [initialValues, setInitialValues] = useState<Feature | null>(null)
  const [showAlert, setShowAlert] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { featuresById, updateFeature, deleteFeature } = useStories()
  const { projectId } = useActiveProject()

  const [hasChanges, setHasChanges] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatWidth, setChatWidth] = useState<number>(380)
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

  useEffect(() => {
    if (storyId && featuresById) {
      const f = featuresById[featureId]
      setInitialValues(f)
    } else {
      setInitialValues(null)
    }
  }, [storyId, featureId, featuresById])

  const onSubmit = useCallback(
    async (values: FeatureFormValues) => {
      setSubmitting(true)
      try {
        await updateFeature(storyId, featureId, values)
        toast({ title: 'Success', description: 'Feature updated successfully', variant: 'success' })
        doClose()
      } catch (e: any) {
        setAlertMessage(`Failed to update feature: ${e?.message || String(e)}`)
        setShowAlert(true)
      } finally {
        setSubmitting(false)
      }
    },
    [storyId, featureId, toast, updateFeature],
  )

  const handleDelete = async () => {
    setShowDeleteConfirm(false)
    setSubmitting(true)
    try {
      await deleteFeature(storyId, featureId)
      toast({ title: 'Success', description: 'Feature deleted successfully', variant: 'success' })
      doClose()
    } catch (e: any) {
      setAlertMessage(`Failed to delete feature: ${e.message || String(e)}`)
      setShowAlert(true)
    } finally {
      setSubmitting(false)
    }
  }

  const formId = 'feature-form-edit'
  const context = useMemo(
    (): ChatContext => ({
      type: 'FEATURE',
      projectId: projectId!,
      storyId,
      featureId,
    }),
    [projectId, storyId, featureId],
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
    // Handle is on the left edge; moving left (dx < 0) increases width
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
        title="Edit Feature"
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
        footer={
          <div className="flex justify-between gap-2">
            {!initialValues ? (
              <span />
            ) : (
              <Button
                className="btn-secondary"
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={submitting}
              >
                <div className="flex items-center gap-2">
                  <IconDelete className="w-4 h-4" />
                  Delete
                </div>
              </Button>
            )}
            <div className="flex justify-end gap-2">
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
                Save Changes
              </button>
            </div>
          </div>
        }
      >
        <div className="w-full h-full flex">
          <div className="flex-1 min-w-0 max-h-full overflow-y-auto p-4">
            {initialValues ? (
              <FeatureForm
                initialValues={initialValues}
                onSubmit={onSubmit}
                onCancel={attemptClose}
                onDelete={() => setShowDeleteConfirm(true)}
                submitting={submitting}
                storyId={storyId}
                featureId={featureId}
                hideActions
                formId={formId}
                onDirtyChange={setHasChanges}
              />
            ) : (
              <div className="py-8 text-center text-sm text-neutral-600 dark:text-neutral-300">
                Loading feature…
              </div>
            )}
          </div>
          {/* Animated, resizable chat sidebar */}
          <div
            className="relative flex-shrink-0 border-l border-border bg-surface-base"
            style={{ width: isChatOpen ? chatWidth : 0, transition: 'width 240ms ease' }}
            aria-hidden={!isChatOpen}
          >
            {/* Resize handle at the left edge */}
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
              {isChatOpen && <ChatSidebar context={context} chatContextTitle="Feature Chat" />}
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
        description="Are you sure you want to delete this feature? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
      />
    </>
  )
}
