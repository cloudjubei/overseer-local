import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  InvalidRefError,
  ResolvedFeatureRef,
  ResolvedRef,
  ResolvedStoryRef,
  storiesService,
} from '../services/storiesService'
import { projectsService } from '../services/projectsService'
import { useActiveProject } from './ProjectContext'
import {
  Feature,
  ProjectSpec,
  Story,
  StoryCreateInput,
  StoryEditInput,
  FeatureCreateInput,
  FeatureEditInput,
  ReorderPayload,
} from 'thefactory-tools'

// Define the context value type based on useStories return value
export type StoriesContextValue = {
  storiesById: Record<string, Story>
  featuresById: Record<string, Feature>
  createStory: (updates: StoryCreateInput) => Promise<Story | undefined>
  updateStory: (storyId: string, updates: StoryEditInput) => Promise<Story | undefined>
  deleteStory: (storyId: string) => Promise<void>
  addFeature: (storyId: string, updates: FeatureCreateInput) => Promise<Story | undefined>
  updateFeature: (
    storyId: string,
    featureId: string,
    updates: FeatureEditInput,
  ) => Promise<Story | undefined>
  deleteFeature: (storyId: string, featureId: string) => Promise<Story | undefined>
  reorderFeatures: (storyId: string, payload: ReorderPayload) => Promise<Story | undefined>
  reorderStory: (payload: ReorderPayload) => Promise<ProjectSpec | undefined>
  getBlockers: (storyId: string, featureId?: string) => (ResolvedRef | InvalidRefError)[]
  getBlockersOutbound: (id: string) => ResolvedRef[]
  resolveDependency: (dependency: string) => ResolvedRef | InvalidRefError
  normalizeDependency: (dependency: string) => string
}

// Create the context
const StoriesContext = createContext<StoriesContextValue | null>(null)

function isUUID(v: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)
}

function normalizeDependencyInternal(
  project: ProjectSpec,
  storyDispToId: Record<string, string>,
  featureDispToIdByStory: Record<string, Record<string, string>>,
  storiesIdx: Record<string, Story>,
  featuresIdx: Record<string, Feature>,
  dependency: string,
): string {
  const parts = dependency.split('.')
  if (parts.length === 1) {
    const a = parts[0]
    if (isUUID(a) && storiesIdx[a]) return a
    const storyId = storyDispToId[a]
    return storyId || dependency
  } else if (parts.length > 1) {
    const a = parts[0]
    const b = parts.slice(1).join('.') // in case of extra dots, treat rest as feature token
    let storyId = a
    if (!isUUID(a)) {
      storyId = storyDispToId[a] || a
    }
    let featureId = b
    if (!isUUID(b)) {
      const fmap = featureDispToIdByStory[storyId] || {}
      featureId = fmap[b] || b
    }
    return `${storyId}.${featureId}`
  }
  return dependency
}

// Create the provider component
export function StoriesProvider({ children }: { children: React.ReactNode }) {
  const { project } = useActiveProject()

  const [storiesById, setStoriesById] = useState<Record<string, Story>>({})
  const [featuresById, setFeaturesById] = useState<Record<string, Feature>>({})
  const [blockersOutboundById, setReferencesById] = useState<Record<string, ResolvedRef[]>>({})
  const [storyDisplayToId, setStoryDisplayToId] = useState<Record<string, string>>({})
  const [featureDisplayToIdByStory, setFeatureDisplayToIdByStory] = useState<
    Record<string, Record<string, string>>
  >({})

  const updateCurrentProjectStories = useCallback((project: ProjectSpec, stories: Story[]) => {
    const newStoriesById: Record<string, Story> = {}
    const newFeaturesById: Record<string, Feature> = {}
    const storyDisplayMap: Record<string, string> = {}
    const featureDisplayMapByStory: Record<string, Record<string, string>> = {}
    for (const t of stories) {
      newStoriesById[t.id] = t
      const tDisplay = `${project.storyIdToDisplayIndex[t.id]}`
      storyDisplayMap[tDisplay] = t.id
      const featureMap: Record<string, string> = {}
      for (const f of t.features) {
        newFeaturesById[f.id] = f
        const fDisplay = `${t.featureIdToDisplayIndex[f.id]}`
        featureMap[fDisplay] = f.id
      }
      featureDisplayMapByStory[t.id] = featureMap
    }
    setStoriesById(newStoriesById)
    setFeaturesById(newFeaturesById)
    setStoryDisplayToId(storyDisplayMap)
    setFeatureDisplayToIdByStory(featureDisplayMapByStory)

    const outbound: Record<string, ResolvedRef[]> = {}
    for (const story of stories) {
      for (const d of story.blockers || []) {
        const norm = normalizeDependencyInternal(
          project,
          storyDisplayMap,
          featureDisplayMapByStory,
          newStoriesById,
          newFeaturesById,
          d,
        )
        const parts = norm.split('.')
        if (parts.length > 1) {
          if (!outbound[parts[1]]) outbound[parts[1]] = []
          outbound[parts[1]].push({
            kind: 'story',
            id: story.id,
            storyId: story.id,
            story: story,
            display: `${project.storyIdToDisplayIndex[story.id]}`,
          } as ResolvedStoryRef)
        } else {
          if (!outbound[parts[0]]) outbound[parts[0]] = []
          outbound[parts[0]].push({
            kind: 'story',
            id: story.id,
            storyId: story.id,
            story: story,
            display: `${project.storyIdToDisplayIndex[story.id]}`,
          } as ResolvedStoryRef)
        }
      }
      for (const feature of story.features) {
        for (const d of feature.blockers || []) {
          const norm = normalizeDependencyInternal(
            project,
            storyDisplayMap,
            featureDisplayMapByStory,
            newStoriesById,
            newFeaturesById,
            d,
          )
          const parts = norm.split('.')
          if (parts.length > 1) {
            if (!outbound[parts[1]]) outbound[parts[1]] = []
            outbound[parts[1]].push({
              kind: 'feature',
              id: `${story.id}.${feature.id}`,
              storyId: story.id,
              featureId: feature.id,
              story,
              feature,
              display: `${project.storyIdToDisplayIndex[story.id]}.${story.featureIdToDisplayIndex[feature.id]}`,
            } as ResolvedFeatureRef)
          } else {
            if (!outbound[parts[0]]) outbound[parts[0]] = []
            outbound[parts[0]].push({
              kind: 'feature',
              id: `${story.id}.${feature.id}`,
              storyId: story.id,
              featureId: feature.id,
              story,
              feature,
              display: `${project.storyIdToDisplayIndex[story.id]}.${story.featureIdToDisplayIndex[feature.id]}`,
            } as ResolvedFeatureRef)
          }
        }
      }
    }
    setReferencesById(outbound)
  }, [])

  useEffect(() => {
    if (!project) {
      setStoriesById({})
      setFeaturesById({})
      setReferencesById({})
      setStoryDisplayToId({})
      setFeatureDisplayToIdByStory({})
      return
    }

    let isMounted = true

    const updateForProject = async () => {
      const stories = await storiesService.listStories(project.id)
      if (isMounted) {
        updateCurrentProjectStories(project, stories)
      }
    }

    updateForProject()

    const unsubscribe = storiesService.subscribe(() => {
      if (isMounted) {
        updateForProject()
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [project, updateCurrentProjectStories])

  const normalizeDependency = useCallback(
    (dependency: string): string => {
      if (!project) return dependency
      return normalizeDependencyInternal(
        project,
        storyDisplayToId,
        featureDisplayToIdByStory,
        storiesById,
        featuresById,
        dependency,
      )
    },
    [project, storyDisplayToId, featureDisplayToIdByStory, storiesById, featuresById],
  )

  const resolveDependency = useCallback(
    (dependency: string): ResolvedRef | InvalidRefError => {
      if (!project) {
        return { id: dependency, code: 'EMPTY', message: "Story wasn't found" }
      }

      const normalized = normalizeDependencyInternal(
        project,
        storyDisplayToId,
        featureDisplayToIdByStory,
        storiesById,
        featuresById,
        dependency,
      )

      const parts = normalized.split('.')
      const story = storiesById[parts[0]]
      if (!story) {
        return { id: normalized, code: 'STORY_NOT_FOUND', message: "Story wasn't found" }
      }
      if (parts.length > 1) {
        const feature = featuresById[parts[1]]
        if (!feature) {
          return { id: normalized, code: 'FEATURE_NOT_FOUND', message: "Feature wasn't found" }
        }
        return {
          kind: 'feature',
          id: normalized,
          storyId: parts[0],
          featureId: parts[1],
          story,
          feature,
          display: `${project.storyIdToDisplayIndex[story.id]}.${story.featureIdToDisplayIndex[feature.id]}`,
        } as ResolvedFeatureRef
      }
      return {
        kind: 'story',
        id: normalized,
        storyId: parts[0],
        story,
        display: `${project.storyIdToDisplayIndex[story.id]}`,
      } as ResolvedStoryRef
    },
    [project, storyDisplayToId, featureDisplayToIdByStory, storiesById, featuresById],
  )

  const createStory = useCallback(
    async (updates: StoryCreateInput): Promise<Story | undefined> => {
      if (project) {
        const normalized: any = { ...updates }
        if (Array.isArray((updates as any).blockers)) {
          normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
        }
        return await storiesService.createStory(project.id, normalized)
      }
    },
    [project, normalizeDependency],
  )

  const updateStory = useCallback(
    async (storyId: string, updates: StoryEditInput): Promise<Story | undefined> => {
      if (project) {
        const normalized: any = { ...updates }
        if (Array.isArray((updates as any).blockers)) {
          normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
        }
        return await storiesService.updateStory(project.id, storyId, normalized)
      }
    },
    [project, normalizeDependency],
  )

  const deleteStory = useCallback(
    async (storyId: string): Promise<void> => {
      if (project) {
        return await storiesService.deleteStory(project.id, storyId)
      }
    },
    [project],
  )

  const addFeature = useCallback(
    async (storyId: string, updates: FeatureCreateInput): Promise<Story | undefined> => {
      if (project) {
        const normalized: any = { ...updates }
        if (Array.isArray((updates as any).blockers)) {
          normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
        }
        return await storiesService.addFeature(project.id, storyId, normalized)
      }
    },
    [project, normalizeDependency],
  )

  const updateFeature = useCallback(
    async (
      storyId: string,
      featureId: string,
      updates: FeatureEditInput,
    ): Promise<Story | undefined> => {
      if (project) {
        const normalized: any = { ...updates }
        if (Array.isArray((updates as any).blockers)) {
          normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
        }
        return await storiesService.updateFeature(project.id, storyId, featureId, normalized)
      }
    },
    [project, normalizeDependency],
  )

  const deleteFeature = useCallback(
    async (storyId: string, featureId: string): Promise<Story | undefined> => {
      if (project) {
        return await storiesService.deleteFeature(project.id, storyId, featureId)
      }
    },
    [project],
  )

  const reorderFeatures = useCallback(
    async (storyId: string, payload: ReorderPayload): Promise<Story | undefined> => {
      if (project) {
        return await storiesService.reorderFeatures(project.id, storyId, payload)
      }
    },
    [project],
  )

  const reorderStory = useCallback(
    async (payload: ReorderPayload): Promise<ProjectSpec | undefined> => {
      console.log('StoryContext reorderStory payload: ', payload, ' project: ', project)
      if (project) {
        return await projectsService.reorderStory(project.id, payload)
      }
    },
    [project],
  )

  const getBlockers = useCallback(
    (storyId: string, featureId?: string): (ResolvedRef | InvalidRefError)[] => {
      if (featureId) {
        return featuresById[featureId]?.blockers?.map((d) => resolveDependency(d)) ?? []
      }
      return storiesById[storyId]?.blockers?.map((d) => resolveDependency(d)) ?? []
    },
    [featuresById, storiesById, resolveDependency],
  )

  const getBlockersOutbound = useCallback(
    (id: string): ResolvedRef[] => {
      return blockersOutboundById[id] ?? []
    },
    [blockersOutboundById],
  )

  const value = useMemo<StoriesContextValue>(
    () => ({
      storiesById,
      featuresById,
      createStory,
      updateStory,
      deleteStory,
      addFeature,
      updateFeature,
      deleteFeature,
      reorderFeatures,
      reorderStory,
      getBlockersOutbound,
      getBlockers,
      resolveDependency,
      normalizeDependency,
    }),
    [
      storiesById,
      featuresById,
      createStory,
      updateStory,
      deleteStory,
      addFeature,
      updateFeature,
      deleteFeature,
      reorderFeatures,
      reorderStory,
      getBlockersOutbound,
      getBlockers,
      resolveDependency,
      normalizeDependency,
    ],
  )

  return <StoriesContext.Provider value={value}>{children}</StoriesContext.Provider>
}

// Create the consumer hook
export function useStories(): StoriesContextValue {
  const ctx = useContext(StoriesContext)
  if (!ctx) throw new Error('useStories must be used within StoriesProvider')
  return ctx
}
