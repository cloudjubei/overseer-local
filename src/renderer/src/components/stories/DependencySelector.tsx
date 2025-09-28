import React, { useState } from 'react'
import { useActiveProject } from '../../contexts/ProjectContext'
import type { Feature, ProjectSpec, Story } from 'thefactory-tools'
import { useStories } from '../../contexts/StoriesContext'

type DependencySelectorProps = {
  onConfirm?: (deps: string[]) => void
  currentStoryId?: string
  currentFeatureId?: string
  existingDeps?: string[]
}

function doesStoryMatch(project: ProjectSpec, story: Story, q: string): boolean {
  const display = `${project.storyIdToDisplayIndex[story.id]}`
  return (
    display.toLowerCase().includes(q) ||
    story.title.toLowerCase().includes(q) ||
    (story.description || '').toLowerCase().includes(q)
  )
}

function doesFeatureMatch(project: ProjectSpec, story: Story, f: Feature, q: string): boolean {
  const display = `${project.storyIdToDisplayIndex[story.id]}.${story.featureIdToDisplayIndex[f.id]}`
  return (
    display.toLowerCase().includes(q) ||
    f.title.toLowerCase().includes(q) ||
    (f.description || '').toLowerCase().includes(q)
  )
}

export const DependencySelector: React.FC<DependencySelectorProps> = ({
  onConfirm,
  currentStoryId,
  currentFeatureId,
  existingDeps = [],
}) => {
  const { project } = useActiveProject()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(existingDeps))
  const { storiesById } = useStories()

  const q = search.trim().toLowerCase()

  const toggle = (dep: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(dep)) {
      newSelected.delete(dep)
    } else {
      newSelected.add(dep)
    }
    setSelected(newSelected)
  }

  if (!project) {
    return <div>Loading blockers...</div>
  }

  const renderStoryItem = (project: ProjectSpec, storyId: string) => {
    const story = storiesById[storyId]
    if (!story) return null
    const storyDep = `${storyId}`
    const isDisabled = existingDeps.includes(storyDep)
    const storyMatches = !q || doesStoryMatch(project, story, q)
    const matchingFeatures = story.features.filter(
      (f) => !q || doesFeatureMatch(project, story, f, q),
    )
    if (!storyMatches && matchingFeatures.length === 0) return null

    const display = `${project.storyIdToDisplayIndex[storyId]}`

    return (
      <li key={storyId}>
        <div
          className={`selector-item flex gap-2 ${isDisabled ? 'disabled text-neutral-400 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
        >
          <input
            type="checkbox"
            checked={selected.has(storyDep)}
            onChange={() => toggle(storyDep)}
            disabled={isDisabled}
          />
          #{display} {story.title}
        </div>
        <ul className="ml-4 space-y-1">
          {matchingFeatures.map((f: Feature) => {
            const featureDep = `${storyId}.${f.id}`
            const isSelf = currentStoryId === storyId && currentFeatureId === f.id
            const isFDisabled = isSelf || existingDeps.includes(featureDep)
            const featureDisplay = `${display}.${story.featureIdToDisplayIndex[f.id]}`
            return (
              <li
                key={`${featureDep}`}
                className={`selector-item flex gap-2 ${isFDisabled ? 'disabled text-neutral-400 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(featureDep)}
                  onChange={() => toggle(featureDep)}
                  disabled={isFDisabled}
                />
                #{featureDisplay} {f.title}
              </li>
            )
          })}
        </ul>
      </li>
    )
  }

  const storyIds = Object.keys(storiesById).sort(
    (a, b) => project.storyIdToDisplayIndex[a] - project.storyIdToDisplayIndex[b],
  )

  return (
    <div className="dependency-selector">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search stories or features"
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      <div className="mt-4 space-y-4 max-h-96 overflow-auto">
        <div>
          <h3 className="text-lg font-semibold">{project.title}</h3>
        </div>
        {storyIds.length > 0 && (
          <ul className="space-y-2">
            {storyIds.map((storyId) => renderStoryItem(project, storyId))}
          </ul>
        )}
      </div>
      <button
        className="btn mt-4"
        disabled={selected.size === 0}
        onClick={() => {
          onConfirm?.(Array.from(selected))
          setSelected(new Set())
        }}
      >
        Add {selected.size} Selected
      </button>
    </div>
  )
}
