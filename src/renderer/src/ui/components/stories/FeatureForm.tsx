import { useEffect, useMemo, useRef, useState } from 'react'
import type { Feature, FeatureCreateInput, FeatureEditInput } from 'thefactory-ui/headless/api'
import {
  FileSelector,
  Modal,
  ProjectChip,
  StatusControl,
  type StoryStatus as Status,
  type UikitFileMeta,
} from 'thefactory-ui/web'
import { IconPlus } from 'thefactory-ui/web/icons'
import { useFeatureForm, type FeatureFormValues } from 'thefactory-ui/headless'
import { useActiveProject, useProjects } from 'thefactory-ui/headless'
import { useStories } from 'thefactory-ui/headless'
import { useFiles } from 'thefactory-ui/headless'
import { DependencyBullet } from 'thefactory-ui/web'
import DependencySelector from './DependencySelector'
import ContextFileChip from './ContextFileChip'
import FileMentionsTextarea from '@ui/components/ui/FileMentionsTextarea'

/**
 * Feature form — visual parity with desktop's `FeatureForm`. Status pill +
 * project chip + parent-story dependency chip in the header, then title,
 * description, rejection reason, context-files chip list, blockers chip list.
 * The host modal owns the action buttons; the form binds them via `formId`.
 *
 * State + dirty + validation come from the shared headless `useFeatureForm`
 * hook so web/desktop/RN render the same machinery with different chrome.
 */

export type FeatureFormInitialValues = {
  title?: string
  description?: string
  rejection?: string
  status?: Status
  blockers?: string[]
  context?: string[]
}

type FeatureFormMode =
  | {
      kind: 'create'
      initialValues?: FeatureFormInitialValues
      onSubmit: (input: FeatureCreateInput) => Promise<unknown>
    }
  | { kind: 'edit'; feature: Feature; onSubmit: (patch: FeatureEditInput) => Promise<unknown> }

export type FeatureFormProps = {
  mode: FeatureFormMode
  storyId: string
  submitting?: boolean
  onDirty?: (dirty: boolean) => void
  /** Unique `id` shared with a `<button type="submit" form={formId}>` rendered
   *  in the host modal's footer (matches desktop's CreateView/EditView). */
  formId?: string
}

export default function FeatureForm({
  mode,
  storyId,
  submitting = false,
  onDirty,
  formId,
}: FeatureFormProps) {
  const initial = mode.kind === 'edit' ? mode.feature : null
  const seed: FeatureFormInitialValues | null =
    mode.kind === 'create' ? (mode.initialValues ?? null) : null
  const initialValues: FeatureFormInitialValues = {
    title: initial?.title ?? seed?.title ?? '',
    description: initial?.description ?? seed?.description ?? '',
    rejection: (initial as { rejection?: string } | null)?.rejection ?? seed?.rejection ?? '',
    status: (initial?.status as Status) ?? seed?.status ?? '-',
    blockers: initial?.blockers ?? seed?.blockers ?? [],
    context: initial?.context ?? seed?.context ?? [],
  }

  const { normalizeDependency } = useStories()

  const form = useFeatureForm({
    initialValues,
    onDirty,
    normalizeDependency,
    onSubmit: async (v: FeatureFormValues) => {
      const shared = {
        title: v.title,
        description: v.description,
        status: v.status,
        blockers: v.blockers,
        // Send the empty string when the field is cleared (not `undefined`),
        // otherwise JSON.stringify drops the key and the backend treats it
        // as "leave unchanged" — the rejection would never get removed.
        rejection: v.rejection,
      }
      if (mode.kind === 'create') {
        await mode.onSubmit({ ...shared, context: v.context })
      } else {
        await mode.onSubmit({ ...shared, context: v.context } as FeatureEditInput)
      }
    },
  })

  const { projectId } = useActiveProject()
  const { projects } = useProjects()
  const { files } = useFiles()
  const project = projects.find((p) => p.id === projectId)

  const titleRef = useRef<HTMLInputElement>(null)
  const isCreate = mode.kind === 'create'
  const featureId = mode.kind === 'edit' ? mode.feature.id : undefined

  useEffect(() => {
    titleRef.current?.focus()
    titleRef.current?.select?.()
  }, [])

  const fileMetas = useMemo<UikitFileMeta[]>(
    () =>
      files.map((f) => ({
        name: f.name,
        relativePath: f.relativePath,
        absolutePath: f.absolutePath,
        type: f.type ?? f.ext ?? null,
        size: f.size,
        mtime: f.mtime,
      })),
    [files],
  )

  const [showSelector, setShowSelector] = useState(false)
  const [showFileSelector, setShowFileSelector] = useState(false)

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
      onKeyDown={form.onKeyDown}
      className="flex flex-col min-h-0 space-y-4"
      aria-label={isCreate ? 'Create Feature' : 'Edit Feature'}
    >
      <div className="grid grid-cols-1 gap-3">
        <div className="flex justify-between items-center">
          <StatusControl
            status={form.values.status}
            onChange={(s) => form.setStatus(s as Status)}
          />
          <div>
            {project ? (
              <ProjectChip label={project.title} description={project.description} nonActionable />
            ) : null}
          </div>
          <DependencyBullet dependency={storyId} interactive={false} />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="feature-title"
            className="text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Title
          </label>
          <input
            id="feature-title"
            ref={titleRef}
            type="text"
            placeholder="What is this feature?"
            value={form.values.title}
            onChange={(e) => form.setTitle(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            style={{
              background: 'var(--surface-raised)',
              borderColor: form.error ? 'var(--status-stuck-soft-border)' : 'var(--border-default)',
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
        </div>

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
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Context Files
            </label>
            <button
              type="button"
              onClick={() => setShowFileSelector(true)}
              className="chip chip--ok"
              title="Add context files"
            >
              <IconPlus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
          <div
            className="flex flex-wrap items-start gap-2 border rounded-md min-h-12 p-2"
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
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Select any files across the project that provide useful context for this feature. Tip:
            type @ in description to quickly reference files.
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Blockers
            </label>
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
          <div
            className="chips-list border rounded-md min-h-12 p-2"
            style={{ borderColor: 'var(--border-default)', background: 'var(--surface-raised)' }}
          >
            {form.values.blockers.map((dep, idx) => (
              <DependencyBullet
                key={dep}
                dependency={dep}
                onRemove={() => form.removeBlockerAt(idx)}
                interactive={false}
              />
            ))}
          </div>
        </div>
      </div>

      {showSelector && (
        <Modal title="Select Blocker" onClose={() => setShowSelector(false)} isOpen size="md">
          <DependencySelector
            currentStoryId={storyId}
            currentFeatureId={featureId}
            existingDeps={form.values.blockers}
            onConfirm={(deps) => {
              for (const d of deps) form.addBlocker(d)
              setShowSelector(false)
            }}
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
            files={fileMetas}
            initialSelected={form.values.context}
            onConfirm={(picked) => {
              for (const p of picked) form.addContextFile(p)
              setShowFileSelector(false)
            }}
            allowMultiple
          />
        </Modal>
      )}
    </form>
  )
}
