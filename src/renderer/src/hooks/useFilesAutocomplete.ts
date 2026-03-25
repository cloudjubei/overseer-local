import { useEffect, useMemo, useRef, useState } from 'react'

type CursorPosition = { left: number; top: number } | null

export function useFilesAutocomplete(params: {
  filesList: string[]
  input: string
  setInput: (v: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  mirrorRef: React.RefObject<HTMLDivElement | null>
}) {
  const { filesList, input, setInput, textareaRef, mirrorRef } = params

  const [isOpen, setIsOpen] = useState(false)
  const [matches, setMatches] = useState<string[]>([])
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [position, setPosition] = useState<CursorPosition>(null)

  // Debounce expensive work during typing.
  const debounceTimerRef = useRef<number | null>(null)

  const filesIndex = useMemo(() => {
    return (filesList || []).map((path) => {
      const parts = path.split('/').filter(Boolean)
      const basename = parts[parts.length - 1] || path
      const isFolder = !basename.includes('.')
      return {
        path,
        lower: path.toLowerCase(),
        basename,
        basenameLower: basename.toLowerCase(),
        isFolder,
      }
    })
  }, [filesList])

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

    stylesToCopy.forEach((key) => {
      mirror.style[key] = style[key]
    })

    mirror.style.overflowWrap = 'break-word'
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.wordBreak = 'break-word'
    mirror.style.height = 'auto'

    // NOTE: avoid layout work unless we actually need to display suggestions.
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

  const checkForMention = (text: string, pos: number) => {
    let start = pos
    while (start > 0 && text[start - 1] !== ' ' && text[start - 1] !== '\n') {
      start--
    }

    const word = text.slice(start, pos)

    if (!word.startsWith('@')) {
      setIsOpen(false)
      setMentionStart(null)
      return
    }

    const query = word.slice(1)
    const queryLower = query.toLowerCase()

    // Avoid doing heavy filtering when user hasn't actually typed a query yet.
    if (queryLower.length < 1) {
      setMatches([])
      setIsOpen(false)
      setMentionStart(start)
      return
    }

    const filtered = filesIndex
      .filter((it) => it.lower.includes(queryLower) || it.basenameLower.includes(queryLower))
      .sort((a, b) => {
        const aBaseStarts = a.basenameLower.startsWith(queryLower) ? 0 : 1
        const bBaseStarts = b.basenameLower.startsWith(queryLower) ? 0 : 1
        if (aBaseStarts !== bBaseStarts) return aBaseStarts - bBaseStarts

        const aPathStarts = a.lower.startsWith(queryLower) ? 0 : 1
        const bPathStarts = b.lower.startsWith(queryLower) ? 0 : 1
        if (aPathStarts !== bPathStarts) return aPathStarts - bPathStarts

        const aSegmentExact = a.basenameLower === queryLower ? 0 : 1
        const bSegmentExact = b.basenameLower === queryLower ? 0 : 1
        if (aSegmentExact !== bSegmentExact) return aSegmentExact - bSegmentExact

        const aFolderBoost = a.isFolder ? 0 : 1
        const bFolderBoost = b.isFolder ? 0 : 1
        if (aFolderBoost !== bFolderBoost && queryLower.includes('/')) return aFolderBoost - bFolderBoost

        if (a.basename.length !== b.basename.length) return a.basename.length - b.basename.length

        if (a.basenameLower !== b.basenameLower) {
          const baseCmp = a.basenameLower.localeCompare(b.basenameLower)
          if (baseCmp !== 0) return baseCmp
        }

        if (a.path.length !== b.path.length) return a.path.length - b.path.length
        return a.path.localeCompare(b.path)
      })
      .slice(0, 50)
      .map((it) => it.path)

    setMatches(filtered)
    setMentionStart(start)

      // Only now do we pay the DOM-measurement cost to position the dropdown.
      // This keeps normal typing fast when no dropdown is needed.
    if (filtered.length > 0) {
      const textarea = textareaRef.current
      if (!textarea) return

      const coords = getCursorCoordinates(textarea, pos)
      const textareaRect = textarea.getBoundingClientRect()
      const cursorLeft = textareaRect.left + coords.x
      const topAboveTextarea = textareaRect.top + window.scrollY - 8 // 8px gap above input
      setPosition({ left: cursorLeft, top: topAboveTextarea })
      setIsOpen(true)
      return
    }

    setIsOpen(false)
  }

  const onSelect = (path: string) => {
    const textarea = textareaRef.current
    if (!textarea || mentionStart === null) return
    const currentText = textarea.value
    const currentPos = textarea.selectionStart ?? 0
    const wordEnd = currentPos
    const beforeMention = currentText.slice(0, mentionStart)
    const afterMention = currentText.slice(wordEnd)

    const newText = `${beforeMention}@${path} ${afterMention}`
    setInput(newText)

    const newPos = beforeMention.length + 1 + path.length + 1
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
    // Include filesIndex so new/removed files reflect.
  }, [input, filesIndex, textareaRef])

  return { isOpen, matches, position, onSelect }
}
