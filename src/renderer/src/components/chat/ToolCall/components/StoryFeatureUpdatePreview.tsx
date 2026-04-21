import React, { useMemo } from 'react'
import type { Feature, ProjectSpec, Story } from 'thefactory-tools'
import { buildSimpleUnifiedDiff, extract, tryString } from '../utils'
import { InlineTextDiff } from '../../tool-popups/InlineTextDiff'
import { SimpleSplitText } from '../../tool-popups/SimpleUnifiedDiff'
import { SectionTitle } from './SectionTitle'
import { StoryCardRaw } from '@renderer/components/stories/StoryCard'
import { FeatureCardRaw } from '@renderer/components/stories/FeatureCard'

type StoryField = 'title' | 'description' | 'status' | 'blockers' | 'rejection' | 'completedAt'
type FeatureField =
  | 'title'
  | 'description'
  | 'status'
  | 'context'
  | 'plan'
  | 'acceptance'
  | 'blockers'
  | 'rejection'
  | 'completedAt'
  | 'files'

const STORY_FIELDS: StoryField[] = [
  'title',
  'description',
  'status',
  'blockers',
  'rejection',
  'completedAt',
]
const FEATURE_FIELDS: FeatureField[] = [
  'title',
  'description',
  'status',
  'context',
  'plan',
  'acceptance',
  'blockers',
  'rejection',
  'completedAt',
  'files',
]

function SmallBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-[var(--border-subtle)] bg-[var(--surface-base)] px-1 py-0 text-[10px] font-medium text-[var(--text-secondary)]">
      {children}
    </span>
  )
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '(empty)'
    return value.map((item) => `- ${String(item)}`).join('\n')
  }

  if (value == null || value === '') return '(empty)'
  return String(value)
}

function changedKeys<T extends string>(patch: Record<string, unknown>, allowed: readonly T[]): T[] {
  return Object.keys(patch).filter((key): key is T => allowed.includes(key as T))
}

function FieldDiff({
  label,
  before,
  after,
  sideBySide,
}: {
  label: string
  before: unknown
  after: unknown
  sideBySide: boolean
}) {
  const beforeText = formatValue(before)
  const afterText = formatValue(after)
  const hasChanges = beforeText !== afterText
  const patch = useMemo(
    () => buildSimpleUnifiedDiff(label, beforeText, afterText),
    [label, beforeText, afterText],
  )

  return (
    <div className="space-y-1 min-w-0">
      <SectionTitle>{label}</SectionTitle>
      {sideBySide ? (
        <SimpleSplitText
          oldText={beforeText}
          newText={hasChanges ? afterText : '(no changes)'}
          oldLabel="Current"
          newLabel="Updated"
        />
      ) : patch ? (
        <InlineTextDiff patch={patch} intraline="word" showDeletions={true} />
      ) : (
        <div className="text-[11px] text-[var(--text-secondary)]">No visible changes</div>
      )}
    </div>
  )
}

export function StoryUpdatePreview({
  project,
  story,
  patch,
  result,
  sideBySide,
  isComplete,
}: {
  project?: ProjectSpec
  story?: Story
  patch: Record<string, unknown>
  result: any
  sideBySide: boolean
  isComplete: boolean
}) {
  const resultObject =
    result?.patch && typeof result?.patch === 'string' ? JSON.parse(result.patch) : result
  const resultStory =
    resultObject && typeof resultObject === 'object' && !Array.isArray(resultObject)
      ? (resultObject as Story)
      : undefined
  const nextStory = resultStory ?? (story ? ({ ...story, ...patch } as Story) : undefined)
  const patchKeys = changedKeys(patch, STORY_FIELDS)

  if (!story && !nextStory) {
    return <div className="text-[11px] text-[var(--text-secondary)]">No story data</div>
  }

  if (isComplete && project && nextStory) {
    return <StoryCardRaw project={project} story={nextStory} />
  }

  return (
    <div className="space-y-2 text-xs min-w-0">
      <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-base)] p-2">
        <div className="flex items-center gap-2 flex-wrap">
          <SmallBadge>story</SmallBadge>
          {story?.id || nextStory?.id ? (
            <span className="font-mono text-[11px] text-[var(--text-secondary)]">
              {story?.id || nextStory?.id}
            </span>
          ) : null}
        </div>
      </div>

      {patchKeys.length > 0 ? (
        <div className="space-y-2 min-w-0">
          {patchKeys.map((key) => (
            <FieldDiff
              key={key}
              label={key}
              before={story?.[key]}
              after={nextStory?.[key]}
              sideBySide={sideBySide}
            />
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-[var(--text-secondary)]">No changed story fields</div>
      )}
    </div>
  )
}

export function FeatureUpdatePreview({
  project,
  story,
  feature,
  patch,
  result,
  sideBySide,
  isComplete,
}: {
  project?: ProjectSpec
  story?: Story
  feature?: Feature
  patch: Record<string, unknown>
  result: any
  sideBySide: boolean
  isComplete: boolean
}) {
  const resultStory =
    result && typeof result === 'object' && !Array.isArray(result) ? (result as Story) : undefined
  const featureIdFromPatch = tryString(extract(patch, ['id']))
  const targetFeatureId = feature?.id || featureIdFromPatch
  const resultFeature = resultStory?.features?.find((item) => item.id === targetFeatureId)
  const nextFeature = resultFeature ?? (feature ? ({ ...feature, ...patch } as Feature) : undefined)
  const patchKeys = changedKeys(patch, FEATURE_FIELDS)

  if (!feature && !nextFeature) {
    return <div className="text-[11px] text-[var(--text-secondary)]">No feature data</div>
  }

  if (isComplete && project && story && nextFeature) {
    return <FeatureCardRaw project={project} story={story} feature={nextFeature} />
  }

  return (
    <div className="space-y-2 text-xs min-w-0">
      <div className="rounded border border-[var(--border-subtle)] bg-[var(--surface-base)] p-2 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <SmallBadge>feature</SmallBadge>
          {feature?.id || nextFeature?.id ? (
            <span className="font-mono text-[11px] text-[var(--text-secondary)]">
              {feature?.id || nextFeature?.id}
            </span>
          ) : null}
        </div>
        {story?.id || resultStory?.id ? (
          <div className="text-[11px] text-[var(--text-secondary)]">
            Story: <span className="font-mono">{story?.id || resultStory?.id}</span>
          </div>
        ) : null}
      </div>

      {patchKeys.length > 0 ? (
        <div className="space-y-2 min-w-0">
          {patchKeys.map((key) => (
            <FieldDiff
              key={key}
              label={key}
              before={feature?.[key]}
              after={nextFeature?.[key]}
              sideBySide={sideBySide}
            />
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-[var(--text-secondary)]">No changed feature fields</div>
      )}
    </div>
  )
}
