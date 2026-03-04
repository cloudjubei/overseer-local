import React, { useEffect } from 'react'
import StoryDetailsView from '../screens/stories/StoryDetailsView'
import StoriesListView from '../screens/stories/StoriesListView'
import { useNavigator } from '../navigation/Navigator'
import { useStories } from '../contexts/StoriesContext'
import { useActiveProject } from '../contexts/ProjectContext'

const StoriesView: React.FC = () => {
  const { storiesRoute } = useNavigator()
  const { storiesById, reindexStories } = useStories()
  const { project } = useActiveProject()

  useEffect(() => {
    if (!project || !storiesById) return

    const missingStories = Object.values(storiesById).filter(
      (story) => project.storyIdToDisplayIndex[story.id] === undefined
    )

    if (missingStories.length > 0) {
      reindexStories(project.id)
    }
  }, [storiesById, project, reindexStories])

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
