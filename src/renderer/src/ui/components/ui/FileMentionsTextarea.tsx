import React, { useCallback, useMemo } from 'react'
import {
  FileMentionsTextarea as FileMentionsTextareaPackage,
  type ReferenceSuggestion,
} from 'thefactory-ui/web'
import { rankMentionMatches } from 'thefactory-ui/headless'
import { useFiles } from 'thefactory-ui/headless'
import { useStories } from 'thefactory-ui/headless'
import { useActiveProject } from 'thefactory-ui/headless'

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
  const { paths } = useFiles()
  const { project, projectId } = useActiveProject()
  const { stories, storyDisplayIndex, featureDisplayIndex } = useStories()

  const references = useMemo<ReferenceSuggestion[]>(() => {
    if (!project) return []
    const out: ReferenceSuggestion[] = []
    for (const story of stories) {
      const storyDisplay = `${storyDisplayIndex(story.id)}`
      const storyTitle = story.title || ''
      out.push({
        value: storyDisplay,
        label: `#${storyDisplay} ${storyTitle}`.trim(),
        description: 'Story',
      })
      for (const f of story.features || []) {
        const featureDisplay = `${storyDisplay}.${featureDisplayIndex(story.id, f.id)}`
        out.push({
          value: featureDisplay,
          label: `#${featureDisplay} ${f.title || ''}`.trim(),
          description: `Feature of "${storyTitle}"`,
        })
      }
    }
    return out
  }, [stories, project, projectId, storyDisplayIndex, featureDisplayIndex])

  const onSearchFiles = useCallback(
    (token: string) =>
      disableAutocomplete ? [] : rankMentionMatches(paths, token, MAX_FILE_SUGGESTIONS),
    [paths, disableAutocomplete],
  )

  const onSearchReferences = useCallback(
    (token: string) => {
      if (disableAutocomplete) return []
      if (token.length === 0) return references.slice(0, MAX_REF_SUGGESTIONS)
      const q = token.toLowerCase()
      const out: ReferenceSuggestion[] = []
      for (const ref of references) {
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
    <FileMentionsTextareaPackage
      ref={inputRef}
      id={id}
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
      style={style}
      ariaLabel={ariaLabel}
      onKeyDown={onKeyDown}
      onSelect={onSelect}
      onMouseUp={onMouseUp}
      onFocus={onFocus}
    />
  )
}
