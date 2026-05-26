import { useMemo } from 'react'
import { useActiveProject } from 'thefactory-ui/headless'
import { useStories } from 'thefactory-ui/headless'
import { Button, Input } from 'thefactory-ui/web'
import { useDependencySelector } from 'thefactory-ui/headless'

export type DependencySelectorProps = {
  /** Confirmed selections — caller decides what "Add" means (e.g. patch the
   *  current story's blockers list). */
  onConfirm?: (deps: string[]) => void
  currentStoryId?: string
  currentFeatureId?: string
  existingDeps?: string[]
}

// Structured picker: search across the active project's stories/features and
// check off the ones to add as dependencies. Pairs with `BlockersField` (free
// text) — use this when blockers must be in-project, BlockersField when
// callers want to record external blockers too.
export default function DependencySelector({
  onConfirm,
  currentStoryId,
  currentFeatureId,
  existingDeps = [],
}: DependencySelectorProps) {
  const { project } = useActiveProject()
  const { stories, storyDisplayIndex, featureDisplayIndex } = useStories()

  const storiesShape = useMemo(
    () =>
      stories.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        features: s.features.map((f) => ({
          id: f.id,
          title: f.title,
          description: f.description,
        })),
      })),
    [stories],
  )

  const sel = useDependencySelector({
    stories: storiesShape,
    currentStoryId,
    currentFeatureId,
    existingDeps,
    getStoryDisplayIndex: storyDisplayIndex,
    getFeatureDisplayIndex: featureDisplayIndex,
  })

  if (!project) return <div className="text-sm opacity-60">Loading dependencies…</div>

  return (
    <div className="dependency-selector">
      <Input
        type="search"
        value={sel.search}
        onChange={(e) => sel.setSearch(e.target.value)}
        placeholder="Search stories or features"
      />
      <div className="mt-4 space-y-4 max-h-96 overflow-auto">
        <h3 className="text-lg font-semibold">{project.title}</h3>
        {sel.items.length === 0 ? (
          <p className="text-sm opacity-60">No stories yet.</p>
        ) : (
          <ul className="space-y-2">
            {sel.items.map((item) => (
              <li key={item.story.id}>
                <label
                  className={`flex items-center gap-2 ${item.storyDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-(--surface-muted)'} rounded px-1`}
                >
                  <input
                    type="checkbox"
                    checked={sel.selected.has(item.storyDep)}
                    onChange={() => sel.toggle(item.storyDep)}
                    disabled={item.storyDisabled}
                  />
                  <span className="font-mono text-xs opacity-60">#{item.storyDisplay}</span>
                  <span className="truncate">{item.story.title}</span>
                </label>
                <ul className="ml-6 space-y-1">
                  {item.features.map((f) => (
                    <li key={f.featureDep}>
                      <label
                        className={`flex items-center gap-2 ${f.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-(--surface-muted)'} rounded px-1`}
                      >
                        <input
                          type="checkbox"
                          checked={sel.selected.has(f.featureDep)}
                          onChange={() => sel.toggle(f.featureDep)}
                          disabled={f.disabled}
                        />
                        <span className="font-mono text-xs opacity-60">
                          #{f.featureDisplay}
                        </span>
                        <span className="truncate">{f.feature.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button
        className="mt-4"
        disabled={!sel.canConfirm}
        onClick={() => {
          onConfirm?.(sel.collect())
          sel.clear()
        }}
      >
        Add {sel.selected.size} selected
      </Button>
    </div>
  )
}
