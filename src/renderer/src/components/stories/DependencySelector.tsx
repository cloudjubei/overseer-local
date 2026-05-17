import React from 'react'
import { useActiveProject } from '../../contexts/ProjectContext'
import { useStories } from '../../contexts/StoriesContext'
import { useDependencySelector } from 'thefactory-ui/headless'

type DependencySelectorProps = {
  onConfirm?: (deps: string[]) => void
  currentStoryId?: string
  currentFeatureId?: string
  existingDeps?: string[]
}

export const DependencySelector: React.FC<DependencySelectorProps> = ({
  onConfirm,
  currentStoryId,
  currentFeatureId,
  existingDeps = [],
}) => {
  const { project } = useActiveProject()
  const { storiesById, getStoryDisplayIndex, getFeatureDisplayIndex } = useStories()

  const stories = React.useMemo(() => Object.values(storiesById), [storiesById])

  const sel = useDependencySelector({
    stories,
    currentStoryId,
    currentFeatureId,
    existingDeps,
    getStoryDisplayIndex,
    getFeatureDisplayIndex,
  })

  if (!project) return <div>Loading blockers...</div>

  return (
    <div className="dependency-selector">
      <input
        type="search"
        value={sel.search}
        onChange={(e) => sel.setSearch(e.target.value)}
        placeholder="Search stories or features"
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
      <div className="mt-4 space-y-4 max-h-96 overflow-auto">
        <div>
          <h3 className="text-lg font-semibold">{project.title}</h3>
        </div>
        {sel.items.length > 0 && (
          <ul className="space-y-2">
            {sel.items.map((item) => (
              <li key={item.story.id}>
                <div
                  className={`selector-item flex gap-2 ${item.storyDisabled ? 'disabled text-neutral-400 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
                >
                  <input
                    type="checkbox"
                    checked={sel.selected.has(item.storyDep)}
                    onChange={() => sel.toggle(item.storyDep)}
                    disabled={item.storyDisabled}
                  />
                  #{item.storyDisplay} {item.story.title}
                </div>
                <ul className="ml-4 space-y-1">
                  {item.features.map((f) => (
                    <li
                      key={f.featureDep}
                      className={`selector-item flex gap-2 ${f.disabled ? 'disabled text-neutral-400 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
                    >
                      <input
                        type="checkbox"
                        checked={sel.selected.has(f.featureDep)}
                        onChange={() => sel.toggle(f.featureDep)}
                        disabled={f.disabled}
                      />
                      #{f.featureDisplay} {f.feature.title}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        className="btn mt-4"
        disabled={!sel.canConfirm}
        onClick={() => {
          onConfirm?.(sel.collect())
          sel.clear()
        }}
      >
        Add {sel.selected.size} Selected
      </button>
    </div>
  )
}
