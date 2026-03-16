import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  InvalidRefError,
  ResolvedFeatureRef,
  ResolvedRef,
  ResolvedStoryRef,
  storiesService,
} from '../services/storiesService'
import { projectsService } from '../services/projectsService'
import { useProjectContext } from './ProjectContext'
import {
  Feature,
  ProjectSpec,
  Story,
  StoryCreateInput,
  StoryEditInput,
  FeatureCreateInput,
  FeatureEditInput,
  ReorderPayload,
  StoryUpdate,
  Status,
} from 'thefactory-tools'

// Define the context value type based on useStories return value
export type StoriesContextValue = {
  storyIdsByProject: Record<string, string[]>
  storiesById: Record<string, Story>
  featuresById: Record<string, Feature>
  createStory: (updates: StoryCreateInput) => Promise<Story | undefined>
  updateStory: (storyId: string, updates: StoryEditInput) => Promise<Story | undefined>
  updateStoryStatus: (storyId: string, status: Status) => Promise<Story | undefined>
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
  getFeatureDisplayIndex: (storyId: string, featureId: string) => number | undefined
}

// Create the context
const StoriesContext = createContext<StoriesContextValue | null>(null)

function isUUID(v: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)
}

function normalizeDependencyInternal(
  storyDisplayToId: Record<string, string>,
  featureDisplayToIdByStory: Record<string, Record<string, string>>,
  storiesById: Record<string, Story>,
  dependency: string,
): string {
  const parts = dependency.split('.')
  if (parts.length === 1) {
    const a = parts[0]
    if (isUUID(a) && storiesById[a]) return a
    const storyId = storyDisplayToId[a]
    return storyId || dependency
  } else if (parts.length > 1) {
    const a = parts[0]
    const b = parts.slice(1).join('.') // in case of extra dots, treat rest as feature token
    let storyId = a
    if (!isUUID(a)) {
      storyId = storyDisplayToId[a] || a
    }
    let featureId = b
    if (!isUUID(b)) {
      const fmap = featureDisplayToIdByStory[storyId] || {}
      featureId = fmap[b] || b
    }
    return `${storyId}.${featureId}`
  }
  return dependency
}

type InternalStoryUpdate = {
  storyId: string
  projectId: string
  isDelete: boolean
  story: Story | undefined
  project: ProjectSpec | undefined
}

export function StoriesProvider({ children }: { children: React.ReactNode }) {
  const {
    activeProject,
    reorderStory: reorderProjectStory,
    getStoryDisplayIndex,
  } = useProjectContext()

  const [storyIdsByProject, setStoryIdsByProject] = useState<Record<string, string[]>>({})
  const [storiesById, setStoriesById] = useState<Record<string, Story>>({})
  const [featuresById, setFeaturesById] = useState<Record<string, Feature>>({})
  const [blockersOutboundById, _] = useState<Record<string, ResolvedRef[]>>({})
  const [storyDisplayToId, setStoryDisplayToId] = useState<Record<string, string>>({})
  const [featureDisplayToIdByStory, setFeatureDisplayToIdByStory] = useState<
    Record<string, Record<string, string>>
  >({})

  useEffect(() => {
    if (Object.keys(storyIdsByProject).length == 0) {
      console.log('LLELELE storyIdsByProject GOT RESET!!!!')
    }
  }, [storyIdsByProject])

  const getFeatureDisplayIndex = useCallback(
    (storyId: string, featureId: string): number | undefined => {
      const story = storiesById[storyId]
      if (!story) return undefined
      const index = story.features.findIndex((f) => f.id === featureId)
      if (index !== -1) return index + 1
      return undefined
    },
    [storiesById],
  )

  const updateStories = useCallback(
    (stories: InternalStoryUpdate[]) => {
      console.log('updateStories stories: ', stories, ' storyIdsByProject: ', storyIdsByProject)
      const newStoryIdsByProject: Record<string, string[]> = { ...storyIdsByProject }
      const newStoriesById: Record<string, Story> = { ...storiesById }
      const newFeaturesById: Record<string, Feature> = { ...featuresById }
      const newStoryDisplayToId: Record<string, string> = { ...storyDisplayToId }
      const newFeatureDisplayToIdByStory: Record<string, Record<string, string>> = {
        ...featureDisplayToIdByStory,
      }

      for (const { storyId, projectId, isDelete, story, project } of stories) {
        const currentStoryIds = (newStoryIdsByProject[projectId] ?? []).filter((s) => s !== storyId)
        newStoryIdsByProject[projectId] = isDelete ? currentStoryIds : [...currentStoryIds, storyId]

        delete newStoriesById[storyId]
        if (!isDelete && story) {
          newStoriesById[storyId] = story!
        }
        if (project) {
          let index: number | undefined
          const idx = project.storyIds.indexOf(storyId)
          if (idx !== -1) {
            index = idx + 1
            const sDisplay = `${index}`
            delete newStoryDisplayToId[sDisplay]
            if (!isDelete) {
              newStoryDisplayToId[sDisplay] = storyId
            }
          }
        }
        delete newFeatureDisplayToIdByStory[storyId]
        const featureMap: Record<string, string> = {}
        if (story) {
          let i = 0
          for (const f of story.features) {
            delete newFeaturesById[f.id]
            if (!isDelete) {
              newFeaturesById[f.id] = f
              let fIndex = i++
              if (fIndex !== undefined) {
                const fDisplay = `${fIndex}`
                featureMap[fDisplay] = f.id
              }
            }
          }
        }
        if (!isDelete) {
          newFeatureDisplayToIdByStory[storyId] = featureMap
        }
      }

      console.log('newStoryIdsByProject: ', newStoryIdsByProject)
      setStoryIdsByProject(newStoryIdsByProject)
      setStoriesById(newStoriesById)
      setFeaturesById(newFeaturesById)
      setStoryDisplayToId(newStoryDisplayToId)
      setFeatureDisplayToIdByStory(newFeatureDisplayToIdByStory)
    },
    [storyIdsByProject, storiesById, featuresById, storyDisplayToId, featureDisplayToIdByStory],
  )

  const onStoryUpdate = useCallback(
    async (storyUpdate: StoryUpdate) => {
      const storyId = storyUpdate.storyId
      const projectId = storyUpdate.projectId
      const isDelete = storyUpdate.type === 'delete'
      const story = storyUpdate.story
      const project = await projectsService.getProject(storyUpdate.projectId)

      updateStories([{ storyId, projectId, isDelete, story, project }])
    },
    [updateStories],
  )
  const update = async () => {
    const projects = await projectsService.listProjects()
    const updates: InternalStoryUpdate[] = []
    for (const project of projects) {
      const projectId = project.id
      try {
        const stories = await storiesService.listStories(projectId)
        for (const story of stories) {
          updates.push({ storyId: story.id, projectId, isDelete: false, story, project })
        }
      } catch (e) {
        console.error('StoriesContext update error: ', e)
      }
    }
    updateStories(updates)
  }
  useEffect(() => {
    const unsubscribe = storiesService.subscribe(onStoryUpdate)
    return () => {
      unsubscribe()
    }
  }, [onStoryUpdate])
  useEffect(() => {
    update()
  }, [])

  const normalizeDependency = useCallback(
    (dependency: string): string => {
      if (!activeProject) return dependency
      return normalizeDependencyInternal(
        storyDisplayToId,
        featureDisplayToIdByStory,
        storiesById,
        dependency,
      )
    },
    [activeProject, storyDisplayToId, featureDisplayToIdByStory, storiesById, featuresById],
  )

  const resolveDependency = useCallback(
    (dependency: string): ResolvedRef | InvalidRefError => {
      if (!activeProject) {
        return { id: dependency, code: 'EMPTY', message: "Story wasn't found" }
      }

      const normalized = normalizeDependencyInternal(
        storyDisplayToId,
        featureDisplayToIdByStory,
        storiesById,
        dependency,
      )

      const parts = normalized.split('.')
      const story = storiesById[parts[0]]
      if (!story) {
        return { id: normalized, code: 'STORY_NOT_FOUND', message: "Story wasn't found" }
      }
      const sIndex = getStoryDisplayIndex(activeProject.id, story.id)

      if (parts.length > 1) {
        const feature = featuresById[parts[1]]
        if (!feature) {
          return { id: normalized, code: 'FEATURE_NOT_FOUND', message: "Feature wasn't found" }
        }
        const fIndex = getFeatureDisplayIndex(story.id, feature.id)

        return {
          kind: 'feature',
          id: normalized,
          storyId: parts[0],
          featureId: parts[1],
          story,
          feature,
          display: `${sIndex}.${fIndex}`,
        } as ResolvedFeatureRef
      }
      return {
        kind: 'story',
        id: normalized,
        storyId: parts[0],
        story,
        display: `${sIndex}`,
      } as ResolvedStoryRef
    },
    [
      activeProject,
      storyDisplayToId,
      featureDisplayToIdByStory,
      storiesById,
      featuresById,
      getStoryDisplayIndex,
      getFeatureDisplayIndex,
    ],
  )

  const createStory = useCallback(
    async (updates: StoryCreateInput): Promise<Story | undefined> => {
      if (activeProject) {
        const normalized = { ...updates }
        if (Array.isArray(updates.blockers)) {
          normalized.blockers = updates.blockers.map((d: string) => normalizeDependency(d))
        }
        const story = await storiesService.createStory(activeProject.id, normalized)

        updateStories([
          {
            storyId: story.id,
            projectId: activeProject.id,
            isDelete: false,
            story,
            project: activeProject,
          },
        ])
      }
      return
    },
    [activeProject, normalizeDependency, updateStories],
  )

  const updateStory = useCallback(
    async (storyId: string, updates: StoryEditInput): Promise<Story | undefined> => {
      if (activeProject) {
        const normalized: any = { ...updates }
        if (Array.isArray((updates as any).blockers)) {
          normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
        }

        const s = await storiesService.updateStory(activeProject.id, storyId, normalized)
        if (s) {
          updateStories([
            {
              storyId: s.id,
              projectId: activeProject.id,
              isDelete: false,
              story: s,
              project: activeProject,
            },
          ])
        }
      }
      return
    },
    [activeProject, normalizeDependency, updateStories],
  )
  const updateStoryStatus = useCallback(
    async (storyId: string, status: Status): Promise<Story | undefined> => {
      if (activeProject) {
        const s = await storiesService.updateStoryStatus(activeProject.id, storyId, status)
        if (s) {
          updateStories([
            {
              storyId: s.id,
              projectId: activeProject.id,
              isDelete: false,
              story: s,
              project: activeProject,
            },
          ])
        }
      }
      return
    },
    [activeProject, updateStories],
  )

  const deleteStory = useCallback(
    async (storyId: string): Promise<void> => {
      if (activeProject) {
        await storiesService.deleteStory(activeProject.id, storyId)
        updateStories([
          {
            storyId,
            projectId: activeProject.id,
            isDelete: true,
            story: undefined,
            project: activeProject,
          },
        ])
      }
    },
    [activeProject, updateStories],
  )

  const addFeature = useCallback(
    async (storyId: string, updates: FeatureCreateInput): Promise<Story | undefined> => {
      console.log('addFeature storyId: ', storyId, ' updates: ', updates)
      if (activeProject) {
        const normalized: any = { ...updates }
        if (Array.isArray((updates as any).blockers)) {
          normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
        }
        const s = await storiesService.addFeature(activeProject.id, storyId, normalized)
        if (s) {
          updateStories([
            {
              storyId: s.id,
              projectId: activeProject.id,
              isDelete: false,
              story: s,
              project: activeProject,
            },
          ])
        }
      }
      return
    },
    [activeProject, normalizeDependency, updateStories],
  )

  const updateFeature = useCallback(
    async (
      storyId: string,
      featureId: string,
      updates: FeatureEditInput,
    ): Promise<Story | undefined> => {
      if (activeProject) {
        const normalized: any = { ...updates }
        if (Array.isArray((updates as any).blockers)) {
          normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
        }
        const s = await storiesService.updateFeature(
          activeProject.id,
          storyId,
          featureId,
          normalized,
        )
        if (s) {
          updateStories([
            {
              storyId: s.id,
              projectId: activeProject.id,
              isDelete: false,
              story: s,
              project: activeProject,
            },
          ])
        }
      }
      return
    },
    [activeProject, normalizeDependency, updateStories],
  )

  const deleteFeature = useCallback(
    async (storyId: string, featureId: string): Promise<Story | undefined> => {
      if (activeProject) {
        const s = await storiesService.deleteFeature(activeProject.id, storyId, featureId)
        if (s) {
          updateStories([
            {
              storyId: s.id,
              projectId: activeProject.id,
              isDelete: false,
              story: s,
              project: activeProject,
            },
          ])
        }
      }
      return
    },
    [activeProject, updateStories],
  )

  const reorderFeatures = useCallback(
    async (storyId: string, payload: ReorderPayload): Promise<Story | undefined> => {
      if (activeProject) {
        const s = await storiesService.reorderFeatures(activeProject.id, storyId, payload)
        if (s) {
          updateStories([
            {
              storyId: s.id,
              projectId: activeProject.id,
              isDelete: false,
              story: s,
              project: activeProject,
            },
          ])
        }
      }
      return
    },
    [activeProject, updateStories],
  )
  const reorderStory = useCallback(
    async (payload: ReorderPayload): Promise<ProjectSpec | undefined> => {
      if (activeProject) {
        return await reorderProjectStory(activeProject.id, payload)
      }
      return
    },
    [activeProject, reorderProjectStory],
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
      storyIdsByProject,
      storiesById,
      featuresById,
      createStory,
      updateStory,
      updateStoryStatus,
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
      getFeatureDisplayIndex,
    }),
    [
      storyIdsByProject,
      storiesById,
      featuresById,
      createStory,
      updateStory,
      updateStoryStatus,
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
      getFeatureDisplayIndex,
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
