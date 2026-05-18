import { useParams } from 'react-router-dom'
import StoriesListView from './stories/StoriesListView'
import StoryDetailsView from './stories/StoryDetailsView'

/**
 * Top-level Stories shell — mirrors desktop's `StoriesView.tsx`: a thin
 * router that picks between the list and the per-story details view. All
 * actual chrome (toolbar, menubar, dense rows, feature panel) lives in the
 * sub-screens.
 */
export default function StoriesView() {
  const { storyId } = useParams<{ storyId: string }>()

  return (
    <div className="flex flex-col w-full h-full" style={{ fontFamily: 'sans-serif' }}>
      {storyId ? <StoryDetailsView storyId={storyId} /> : <StoriesListView />}
    </div>
  )
}
