import { useEffect, useMemo, useRef, useState } from 'react'
import { useStories } from '../contexts/StoriesContext'
import { useActiveProject } from '../contexts/ProjectContext'

type RefItem = {
  ref: string
  display: string
  title: string
  titleLower: string
  displayLower: string
  type: 'story' | 'feature'
}

type CursorPosition = { left: number; top: number } | null

export function useReferencesAutocomplete(params: {
  input: string
  setInput: (v: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  mirrorRef: React.RefObject<HTMLDivElement | null>
}) {
  const { project } = useActiveProject()
  const { input, setInput, textareaRef, mirrorRef } = params
  const { storiesById } = useStories()

  // Build a reference index and pre-normalize search fields.
  // NOTE: This can still be sizable, but it only recomputes when stories/project change.
  const references = useMemo<RefItem[]>(() => {
    if (!project) return []

    const refs: RefItem[] = []
    for (const story of Object.values(storiesById)) {
      const storyDisplay = `${project.storyIdToDisplayIndex[story.id]}`
      const storyTitle = story.title || ''
      refs.push({
        ref: `${story.id}`,
        display: storyDisplay,
        title: storyTitle,
        titleLower: storyTitle.toLowerCase(),
        displayLower: storyDisplay.toLowerCase(),
        type: 'story',
      })

      for (const f of story.features || []) {
        const featureDisplay = `${story.featureIdToDisplayIndex[f.id]}`
        const display = `${storyDisplay}.${featureDisplay}`
        const title = f.title || ''
        refs.push({
          ref: `${story.id}.${f.id}`,
          display,
          title,
          titleLower: title.toLowerCase(),
          displayLower: display.toLowerCase(),
          type: 'feature',
        })
      }
    }

    // Sorting is fine here (rare) but keep it stable.
    refs.sort((a, b) => a.ref.localeCompare(b.ref))
    return refs
  }, [storiesById, project])

  const [isOpen, setIsOpen] = useState(false)
  const [matches, setMatches] = useState<RefItem[]>([])
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [position, setPosition] = useState<CursorPosition>(null)

  // Debounce expensive work during typing.
  const debounceTimerRef = useRef<number | null>(null)

  function getCursorCoordinates(textarea: HTMLTextAreaElement, pos: number) {
    const mirror = mirrorRef.current
    if (!mirror) return { x: 0, y: 0 }

    const style = window.getComputedStyle(textarea)
    const stylesToCopy = [
      'boxSizing',
      'borderBottomWidth',
      'borderLeftWidth',
      'borderRightWidth',
      'borderTopWidth',
      'fontFamily',
      'fontSize',
      'fontStyle',
      'fontWeight',
      'letterSpacing',
      'lineHeight',
      'paddingBottom',
      'paddingLeft',
      'paddingRight',
      'paddingTop',
      'textDecoration',
      'textTransform',
      'width',
    ] as const

    for (const key of stylesToCopy) mirror.style[key] = style[key]

    mirror.style.overflowWrap = 'break-word'
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.wordBreak = 'break-word'
    mirror.style.height = 'auto'

    mirror.textContent = input.slice(0, pos)

    const marker = document.createElement('span')
    marker.style.display = 'inline-block'
    marker.style.width = '0'
    marker.textContent = ''
    mirror.appendChild(marker)

    const mirrorRect = mirror.getBoundingClientRect()
    const markerRect = marker.getBoundingClientRect()

    const x = markerRect.left - mirrorRect.left
    const y = markerRect.top - mirrorRect.top

    mirror.textContent = ''

    return { x, y }
  }

  // Treat common punctuation and whitespace as boundaries, but allow '.' for display refs like 1.2
  const isBoundaryChar = (ch: string) => {
    return /[\s\n\t\(\)\[\]\{\}<>,!?:;\"'`]/.test(ch) // '.' intentionally excluded
  }

  const checkForMention = (text: string, pos: number) => {
    let start = pos
    while (start > 0 && !isBoundaryChar(text[start - 1])) start--
    const word = text.slice(start, pos)

    if (!word.startsWith('#')) {
      setIsOpen(false)
      setMentionStart(null)
      return
    }

    const queryLower = word.slice(1).toLowerCase()

    // Avoid heavy filtering on empty query ('#').
    if (queryLower.length < 1) {
      setMatches([])
      setIsOpen(false)
      setMentionStart(start)
      return
    }

    const filtered: RefItem[] = []
    for (let i = 0; i < references.length; i++) {
      const item = references[i]
      if (item.displayLower.startsWith(queryLower) || item.titleLower.includes(queryLower)) {
        filtered.push(item)
        if (filtered.length >= 50) break
      }
    }

    setMatches(filtered)
    setMentionStart(start)

    const textarea = textareaRef.current
    if (!textarea) return

    // Only now do we pay the DOM-measurement cost to position the dropdown.
    // This keeps normal typing fast when no dropdown is needed.

    const coords = getCursorCoordinates(textarea, pos)
    const textareaRect = textarea.getBoundingClientRect()
    const cursorLeft = textareaRect.left + window.scrollX + coords.x
    const topAboveTextarea = textareaRect.top + window.scrollY - 8
    setPosition({ left: cursorLeft, top: topAboveTextarea })
    setIsOpen(filtered.length > 0)
  }

  // selectedRef should be the DISPLAY form (e.g., 3.2) so that the text shows as #3.2
  const onSelect = (selectedRefDisplay: string) => {
    const textarea = textareaRef.current
    if (!textarea || mentionStart === null) return
    const currentText = textarea.value
    const currentPos = textarea.selectionStart
    const before = currentText.slice(0, mentionStart)
    const after = currentText.slice(currentPos)

    // Insert display-based reference and add a trailing space for UX consistency
    const newText = `${before}#${selectedRefDisplay} ${after}`
    setInput(newText)
    const newPos = before.length + 1 + selectedRefDisplay.length + 1 // include space
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newPos, newPos)
    }, 0)

    setIsOpen(false)
    setMentionStart(null)
  }

  // Recompute suggestions from the controlled input.
  // NOTE: We intentionally avoid a global 'selectionchange' listener for performance.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const pos = textarea.selectionStart ?? 0

    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null
      checkForMention(input, pos)
    }, 75)

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [input, references, textareaRef])

  return { isOpen, matches, position, onSelect }
}
