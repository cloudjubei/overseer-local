import React from 'react'
import StoryDetailsView from '../stories/StoryDetailsView'
import StoriesListView from '../stories/StoriesListView'
import { useNavigator } from '../navigation/Navigator'

const StoriesView: React.FC = () => {
  const { storiesRoute } = useNavigator()

  let content
  switch (storiesRoute.name) {
    case 'details':
      content = <StoryDetailsView storyId={storiesRoute.storyId} />
      break
    default:
      content = <StoriesListView />
      break
  }

  return (
    <div className="flex flex-col w-full h-full" style={{ fontFamily: 'sans-serif' }}>
      {content}
    </div>
  )
}

export default StoriesView
