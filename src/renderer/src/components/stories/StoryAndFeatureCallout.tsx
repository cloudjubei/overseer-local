import { StoryAndFeatureCallout as StoryAndFeatureCalloutBase } from 'thefactory-ui/web'
import DependencyBullet from './DependencyBullet'

export type StoryAndFeatureCalloutProps = {
  storyId?: string
  featureId?: string
}

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
