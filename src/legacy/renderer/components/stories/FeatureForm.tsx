import React, { useEffect, useRef, useState } from 'react'
import type { Status } from 'thefactory-tools'
import { StatusControl } from 'thefactory-ui/web'
import { useFeatureForm, type FeatureFormValues as PackageFeatureFormValues } from 'thefactory-ui/headless'
import { DependencySelector } from './DependencySelector'
import DependencyBullet from './DependencyBullet'
import { FileSelector } from '@renderer/components/ui/FileSelector'
import ContextFileChip from './ContextFileChip'
import { IconDelete, IconPlus, IconSave } from 'thefactory-ui/web/icons'
import FileMentionsTextarea from '@renderer/components/ui/FileMentionsTextarea'
import { useStories } from '../../contexts/StoriesContext'
import { Button, Modal } from 'thefactory-ui/web'
import ProjectChip from '../agents/ProjectChip'

export type FeatureFormValues = {
  title: string
  description?: string
  rejection?: string
  status: Status
  blockers?: string[]
  context: string[]
}

type Props = {
  initialValues?: Partial<FeatureFormValues>
  onSubmit: (values: FeatureFormValues) => void | Promise<void>
  onCancel: () => void
  onDelete?: () => void
  submitting?: boolean
  titleRef?: React.RefObject<HTMLInputElement | null>
  storyId: string
  featureId?: string
  hideActions?: boolean
  formId?: string
  onDirtyChange?: (dirty: boolean) => void
  focusDescription?: boolean
  projectId?: string
}

export default function FeatureForm({
  initialValues,
  onSubmit,
  onCancel,
  onDelete,
  submitting = false,
  titleRef,
  storyId,
  featureId,
  hideActions = false,
  formId,
  onDirtyChange,
  focusDescription = false,
  projectId,
}: Props) {
  const { normalizeDependency } = useStories()

  const form = useFeatureForm({
    initialValues: {
      title: initialValues?.title,
      description: initialValues?.description,
      rejection: initialValues?.rejection,
      status: initialValues?.status,
      blockers: initialValues?.blockers,
      context: initialValues?.context,
    },
    onSubmit: async (v: PackageFeatureFormValues) => {
      await onSubmit({
        title: v.title,
        description: v.description,
        rejection: v.rejection,
        status: v.status as Status,
        blockers: v.blockers,
        context: v.context,
      })
    },
    onDirty: onDirtyChange,
    normalizeDependency,
  })

  const [showSelector, setShowSelector] = useState(false)
  const [showFileSelector, setShowFileSelector] = useState(false)
  const localTitleRef = useRef<HTMLInputElement | null>(null)
  const combinedTitleRef = titleRef ?? localTitleRef
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null)
  const isCreate = featureId == null

  useEffect(() => {
    if (focusDescription && descriptionRef.current) {
      const el = descriptionRef.current
      el.focus()
      const len = el.value?.length ?? 0
      try {
        el.setSelectionRange(len, len)
      } catch {
        // ignore selection errors on some browsers
      }
      return
    }
    combinedTitleRef.current?.focus()
    combinedTitleRef.current?.select?.()
  }, [combinedTitleRef, focusDescription])

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      onKeyDown={form.onKeyDown}
      className="flex flex-col min-h-0"
      aria-label={isCreate ? 'Create Feature' : 'Edit Feature'}
    >
      <div className="grid grid-cols-1 gap-3">
        <div className="flex justify-between items-center">
          <StatusControl status={form.values.status} onChange={form.setStatus} />
          <div>{projectId && <ProjectChip projectId={projectId} nonActionable />}</div>
          <DependencyBullet dependency={storyId} interactive={false} />
        </div>
        <div className="flex items-center gap-3">
          <label
            htmlFor="feature-title"
            className="text-xs flex-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            Title
          </label>
        </div>
        <input
          id="feature-title"
          ref={combinedTitleRef}
          type="text"
          placeholder="What is this feature?"
          value={form.values.title}
          onChange={(e) => form.setTitle(e.target.value)}
          disabled={submitting}
          className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
          style={{
            background: 'var(--surface-raised)',
            borderColor: form.error
              ? 'var(--status-stuck-soft-border)'
              : 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
          aria-invalid={!!form.error}
          aria-describedby={form.error ? 'feature-title-error' : undefined}
        />
        {form.error ? (
          <div
            id="feature-title-error"
            className="text-xs"
            style={{ color: 'var(--status-stuck-fg)' }}
          >
            {form.error}
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="feature-description"
            className="text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Description
          </label>
          <FileMentionsTextarea
            id="feature-description"
            rows={4}
            placeholder="Optional details or acceptance criteria. Tip: @ to reference files, # to reference stories/features"
            value={form.values.description}
            onChange={form.setDescription}
            disabled={submitting}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60 resize-y max-h-64"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
            ariaLabel="Feature description"
            onFileMentionSelected={form.addContextFile}
            onReferenceSelected={form.addBlocker}
            inputRef={descriptionRef}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="feature-rejection"
            className="text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Rejection Reason
          </label>
          <FileMentionsTextarea
            id="feature-rejection"
            rows={3}
            placeholder="Optional reason for rejection (leave blank to remove). Tip: @ files, # stories/features"
            value={form.values.rejection}
            onChange={form.setRejection}
            disabled={submitting}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60 resize-y max-h-64"
            style={{
              background: 'var(--surface-raised)',
              borderColor: 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
            ariaLabel="Feature rejection reason"
            onFileMentionSelected={form.addContextFile}
            onReferenceSelected={form.addBlocker}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Context Files
          </label>
          <div
            className="flex flex-wrap items-start gap-2 border rounded-md min-h-[3rem] p-2"
            style={{ borderColor: 'var(--border-default)', background: 'var(--surface-raised)' }}
          >
            {form.values.context.map((p, idx) => (
              <ContextFileChip
                key={p}
                path={p}
                onRemove={() => form.removeContextAt(idx)}
                warn={!form.mentionedPaths.has(p)}
              />
            ))}
            <button
              type="button"
              onClick={() => setShowFileSelector(true)}
              className="chip chip--ok"
              title="Add context files"
            >
              <IconPlus className="w-3 h-6" />
              <span>Add</span>
            </button>
          </div>
          <div className="text-xs text-text-muted">
            Select any files across the project that provide useful context for this feature. Tip:
            type @ in description to quickly reference files.
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="feature-blockers"
            className="text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Blockers
          </label>
          <div
            id="feature-blockers"
            className="chips-list border rounded-md min-h-[3rem] p-2"
            style={{
              borderColor: 'var(--border-default)',
              background: 'var(--surface-raised)',
            }}
          >
            {form.values.blockers.map((dep, idx) => (
              <DependencyBullet
                key={dep}
                dependency={dep}
                onRemove={() => form.removeBlockerAt(idx)}
                interactive={false}
              />
            ))}
            <button
              type="button"
              onClick={() => setShowSelector(true)}
              className="chip chip--ok"
              title="Add blocker"
            >
              <IconPlus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
          <div className="text-xs text-text-muted">
            Tip: Type # to quickly reference a story or feature; it will be added as a blocker
            automatically.
          </div>
        </div>
      </div>

      {!hideActions && (
        <div className="flex-shrink-0 flex justify-between gap-2 p-4 border-t border-border">
          {onDelete && !isCreate ? (
            <Button
              className="btn-secondary"
              variant="danger"
              onClick={onDelete}
              disabled={submitting}
            >
              <div className="flex items-center gap-2">
                <IconDelete className="w-3 h-3" />
                Delete
              </div>
            </Button>
          ) : null}
          <div className="flex justify-end gap-2 flex-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onCancel()}
              disabled={submitting}
            >
              Cancel
            </Button>
            {isCreate ? (
              <Button
                type="submit"
                disabled={!form.canSubmit}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                title="Cmd/Ctrl+Enter to submit"
              >
                Create Feature
              </Button>
            ) : (
              <Button
                type="submit"
                variant="secondary"
                size="icon"
                disabled={!form.canSubmit}
                aria-keyshortcuts="Control+Enter Meta+Enter"
                title="Save (Cmd/Ctrl+Enter)"
                aria-label="Save"
              >
                <IconSave className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {showSelector && (
        <Modal title="Select Blocker" onClose={() => setShowSelector(false)} isOpen size="md">
          <DependencySelector
            onConfirm={(deps) => {
              for (const d of deps) form.addBlocker(d)
              setShowSelector(false)
            }}
            currentStoryId={storyId}
            currentFeatureId={featureId}
            existingDeps={form.values.blockers}
          />
        </Modal>
      )}

      {showFileSelector && (
        <Modal
          title="Select Context Files"
          onClose={() => setShowFileSelector(false)}
          isOpen
          size="lg"
        >
          <FileSelector
            selected={form.values.context}
            onCancel={() => setShowFileSelector(false)}
            onConfirm={(paths) => {
              for (const p of paths) form.addContextFile(p)
              setShowFileSelector(false)
            }}
            allowMultiple
          />
        </Modal>
      )}
    </form>
  )
}
