// Mention parsing helpers live in the uikit so the @-mention components can
// be extracted with the package. The `@core` import path stays for tests
// and `useFilesAutocomplete`, which is project-aware via `useFiles`.
export {
  applyMention,
  parseMention,
  rankMentionMatches,
  type MentionParse,
} from 'thefactory-ui/web'
