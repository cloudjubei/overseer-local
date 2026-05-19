/**
 * Modal routes used by the Stories screen. Kept in a shared module so
 * `StoriesView` can open them and `StoriesModalHost` can render them without
 * a circular import.
 */
import type { Feature, GetStoryResponse } from 'thefactory-ui/headless/api'

import type { FeatureFormInitialValues } from '@ui/components/stories/FeatureForm'

export type StoryModalRoute =
  | { kind: 'create-story' }
  | { kind: 'edit-story'; story: GetStoryResponse }
  | { kind: 'delete-story'; story: GetStoryResponse }
  | {
      kind: 'create-feature'
      /** Pre-selects a story in the combobox; the user may still change it. */
      storyId?: string
      /** Optional pre-fill for the form fields (title/description/context/etc). */
      initialValues?: FeatureFormInitialValues
    }
  | { kind: 'edit-feature'; storyId: string; feature: Feature }
  | { kind: 'delete-feature'; storyId: string; feature: Feature }
