import type {
  Feature,
  FeatureCreateInput,
  FeatureEditInput,
  ReorderPayload,
  Story,
  StoryCreateInput,
  StoryEditInput,
  StoryUpdate,
} from 'thefactory-tools'

export type ReferenceKind = 'story' | 'feature'

export interface ResolvedStoryRef {
  kind: 'story'
  id: string
  storyId: string
  story: Story
  display: string
}

export interface ResolvedFeatureRef {
  kind: 'feature'
  id: string
  storyId: string
  featureId: string
  story: Story
  feature: Feature
  display: string
}

export type ResolvedRef = ResolvedStoryRef | ResolvedFeatureRef

export interface InvalidRefError {
  id: string
  code: 'EMPTY' | 'BAD_FORMAT' | 'BAD_STORY_ID' | 'STORY_NOT_FOUND' | 'FEATURE_NOT_FOUND'
  message: string
}

export type StoriesService = {
  subscribe: (callback: (storyUpdate: StoryUpdate) => Promise<void>) => () => void
  listStories: (projectId: string) => Promise<Story[]>
  getStory: (projectId: string, storyId: string) => Promise<Story | undefined>
  createStory: (projectId: string, input: StoryCreateInput) => Promise<Story>
  updateStory: (
    projectId: string,
    storyId: string,
    patch: StoryEditInput,
  ) => Promise<Story | undefined>
  deleteStory: (projectId: string, storyId: string) => Promise<void>
  getFeature: (projectId: string, featureId: string) => Promise<Feature | undefined>
  addFeature: (
    projectId: string,
    storyId: string,
    input: FeatureCreateInput,
  ) => Promise<Story | undefined>
  updateFeature: (
    projectId: string,
    storyId: string,
    featureId: string,
    patch: FeatureEditInput,
  ) => Promise<Story | undefined>
  deleteFeature: (
    projectId: string,
    storyId: string,
    featureId: string,
  ) => Promise<Story | undefined>
  reorderFeatures: (
    projectId: string,
    storyId: string,
    payload: ReorderPayload,
  ) => Promise<Story | undefined>
}

export const storiesService: StoriesService = { ...window.storiesService }
