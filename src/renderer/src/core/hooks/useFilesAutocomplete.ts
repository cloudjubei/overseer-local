import { useMemo } from 'react'
import { useFiles } from '../contexts/FilesContext'
import { applyMention, parseMention, rankMentionMatches, type MentionParse } from '../files/mention'

export type FilesAutocompleteState = {
  /** The active mention parse, or `null` if the cursor is not in one. */
  parse: MentionParse | null
  /** Up to `limit` ranked path suggestions for the current token. */
  suggestions: string[]
  /** Helper that returns `{ text, cursor }` after replacing the parse with `path`. */
  complete: (text: string, parse: MentionParse, path: string) => { text: string; cursor: number }
}

/**
 * Pure autocomplete state for `@`-mentions. Given a chat input's text and
 * cursor, returns the parse, ranked suggestions from the active project's
 * files list, and a helper to apply a chosen suggestion. Has no DOM.
 */
export function useFilesAutocomplete(
  text: string,
  cursor: number,
  limit = 8,
): FilesAutocompleteState {
  const { paths } = useFiles()
  const parse = useMemo(() => parseMention(text, cursor), [text, cursor])
  const suggestions = useMemo(
    () => (parse ? rankMentionMatches(paths, parse.token, limit) : []),
    [parse, paths, limit],
  )
  return { parse, suggestions, complete: applyMention }
}
