import React, { useCallback, useMemo } from 'react'
import {
  FileMentionsTextarea as FileMentionsTextareaPackage,
  rankMentionMatches,
  type ReferenceSuggestion,
} from 'thefactory-ui/web'
import { useFiles } from '../../contexts/FilesContext'
import { useStories } from '../../contexts/StoriesContext'
import { useActiveProject } from '../../contexts/ProjectContext'

// Local connected wrapper around `thefactory-ui`'s decoupled
// `FileMentionsTextarea`. Wires:
//   - `onSearchFiles` to the local `FilesContext`
//   - `onSearchReferences` to the local `StoriesContext` so `#`-tokens match
//     stories and features by display index (e.g. `#3.2`) and by title
//
// References resolve to the *display* form (`#<display>` such as `#3.2`),
// matching what the legacy local hook did — that's what `DependencyBullet`
// understands. `onReferenceSelected` (legacy prop name) fires with the
// display form for consumer-side side effects (e.g. push to blockers).

export type FileMentionsTextareaProps = {
  id?: string
  value: string
  disableAutocomplete?: boolean
  onChange: (val: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  ariaLabel?: string
  onFileMentionSelected?: (path: string) => void
  onReferenceSelected?: (ref: string) => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null>
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>
  onSelect?: React.ReactEventHandler<HTMLTextAreaElement>
  onMouseUp?: React.MouseEventHandler<HTMLTextAreaElement>
  onFocus?: React.FocusEventHandler<HTMLTextAreaElement>
}

const MAX_FILE_SUGGESTIONS = 8
const MAX_REF_SUGGESTIONS = 20

export default function FileMentionsTextarea({
  id,
  value,
  disableAutocomplete,
  onChange,
  placeholder,
  rows,
  disabled,
  className,
  style,
  ariaLabel,
  onFileMentionSelected,
  onReferenceSelected,
  inputRef,
  onKeyDown,
  onSelect,
  onMouseUp,
  onFocus,
}: FileMentionsTextareaProps) {
  const { files } = useFiles()
  const { project, projectId } = useActiveProject()
  const { storiesById, getStoryDisplayIndex, getFeatureDisplayIndex } = useStories()

  // Flat reference index — rebuilt only when stories or the active project change.
  const references = useMemo<ReferenceSuggestion[]>(() => {
    if (!project) return []
    const out: ReferenceSuggestion[] = []
    for (const story of Object.values(storiesById)) {
      const storyDisplay = `${getStoryDisplayIndex(story.id)}`
      const storyTitle = story.title || ''
      out.push({
        value: storyDisplay,
        label: `#${storyDisplay} ${storyTitle}`.trim(),
        description: 'Story',
      })
      for (const f of story.features || []) {
        const featureDisplay = `${storyDisplay}.${getFeatureDisplayIndex(story.id, f.id)}`
        out.push({
          value: featureDisplay,
          label: `#${featureDisplay} ${f.title || ''}`.trim(),
          description: `Feature of "${storyTitle}"`,
        })
      }
    }
    return out
  }, [storiesById, project, projectId, getStoryDisplayIndex, getFeatureDisplayIndex])

  const paths = useMemo(() => (files ?? []).map((f) => f.relativePath!).filter(Boolean), [files])

  const onSearchFiles = useCallback(
    (token: string) =>
      disableAutocomplete ? [] : rankMentionMatches(paths, token, MAX_FILE_SUGGESTIONS),
    [paths, disableAutocomplete],
  )

  const onSearchReferences = useCallback(
    (token: string) => {
      if (disableAutocomplete) return []
      // Match `@`-mention behavior: on a bare `#` with no token, surface the
      // first N references so the dropdown appears immediately.
      if (token.length === 0) return references.slice(0, MAX_REF_SUGGESTIONS)
      const q = token.toLowerCase()
      const out: ReferenceSuggestion[] = []
      for (const ref of references) {
        // Prefix-match the display token (`3.2`), infix-match the label (title).
        if (ref.value.toLowerCase().startsWith(q) || ref.label.toLowerCase().includes(q)) {
          out.push(ref)
          if (out.length >= MAX_REF_SUGGESTIONS) break
        }
      }
      return out
    },
    [references, disableAutocomplete],
  )

  return (
    <div id={id} style={style}>
      <FileMentionsTextareaPackage
        ref={inputRef}
        value={value}
        onChange={onChange}
        onSearchFiles={onSearchFiles}
        onSearchReferences={onSearchReferences}
        onAcceptFileMention={onFileMentionSelected}
        onAcceptReference={onReferenceSelected}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={className}
        ariaLabel={ariaLabel}
        onKeyDown={onKeyDown}
        onSelect={onSelect}
        onMouseUp={onMouseUp}
        onFocus={onFocus}
      />
    </div>
  )
}
