import { StoryAndFeatureCallout as StoryAndFeatureCalloutBase } from 'thefactory-ui/web'
import DependencyBullet from './DependencyBullet'

export type StoryAndFeatureCalloutProps = {
  storyId?: string
  featureId?: string
}

/**
 * Web wrapper around the shared `StoryAndFeatureCallout`. Wires web's
 * `DependencyBullet` (which itself plugs into `StoriesContext`) into the
 * shared `renderBullet` render-prop so the layout is shared while the
 * data resolution stays host-specific.
 */
export default function StoryAndFeatureCallout({
  storyId,
  featureId,
}: StoryAndFeatureCalloutProps) {
  return (
    <StoryAndFeatureCalloutBase
      storyId={storyId}
      featureId={featureId}
      renderBullet={(dep) => (
        <DependencyBullet
          dependency={dep}
          interactive
          notFoundDependencyDisplay="*DELETED*"
        />
      )}
    />
  )
}
