import React, { useEffect, useState } from 'react'
import { timelineService } from '../services/timelineService'
import { TimelineLabel } from '../../types/timeline'
import { Feature } from 'thefactory-tools'
import { useTasks } from '../contexts/TasksContext'
import { useActiveProject } from '../contexts/ProjectContext'

interface ProjectTimelineViewProps {
  // No specific props needed for now, as projectId comes from URL params
}

const ProjectTimelineView: React.FC<ProjectTimelineViewProps> = () => {
  const { projectId } = useActiveProject()
  const { tasksById } = useTasks()

  const [features, setFeatures] = useState<Feature[]>([])
  const [labels, setLabels] = useState<TimelineLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) {
      setError('Project ID is missing.')
      setLoading(false)
      return
    }

    const fetchTimelineData = async () => {
      setLoading(true)
      setError(null)
      try {
        const tasks = Object.values(tasksById)
        const fetchedFeatures = tasks.flatMap((t) => t.features)

        const fetchedProjectLabels = await timelineService.matchTimelineLabels({
          projectId: projectId,
        })
        const fetchedGlobalLabels = await timelineService.matchTimelineLabels({ projectId: null })

        setFeatures(fetchedFeatures)
        setLabels([...fetchedProjectLabels, ...fetchedGlobalLabels])
      } catch (err: any) {
        console.error('Failed to fetch timeline data:', err)
        setError(err.message || 'An unknown error occurred while fetching timeline data.')
      } finally {
        setLoading(false)
      }
    }

    fetchTimelineData()
  }, [projectId])

  if (loading) {
    return <div className="p-4 text-gray-500">Loading timeline...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>
  }

  // Combine features and labels and sort them by timestamp/completedAt for timeline display
  const timelineItems = [...features, ...labels].sort((a, b) => {
    const dateA =
      'completedAt' in a && a.completedAt
        ? new Date(a.completedAt).getTime()
        : new Date((a as TimelineLabel).timestamp).getTime()
    const dateB =
      'completedAt' in b && b.completedAt
        ? new Date(b.completedAt).getTime()
        : new Date((b as TimelineLabel).timestamp).getTime()
    return dateA - dateB
  })

  return (
    <div className="project-timeline-view p-4 overflow-auto h-full">
      <h2 className="text-xl font-bold mb-4">Project Timeline: {projectId}</h2>
      <div className="space-y-4">
        {timelineItems.length === 0 ? (
          <p className="text-gray-500">No timeline events found for this project.</p>
        ) : (
          timelineItems.map((item) => {
            if ('entityType' in item && item.entityType === 'Feature') {
              const feature = item as Feature
              return (
                <div
                  key={feature.id}
                  className="timeline-item bg-gray-700 p-3 rounded-md shadow-sm"
                >
                  <p className="text-sm text-gray-400">
                    {new Date(feature.completedAt!).toLocaleString()}
                  </p>
                  <p className="font-semibold">Feature Completed: {feature.title}</p>
                  <p className="text-gray-300 text-sm">ID: {feature.id}</p>
                </div>
              )
            } else if ('label' in item) {
              const label = item as TimelineLabel
              return (
                <div key={label.id} className="timeline-item bg-blue-700 p-3 rounded-md shadow-sm">
                  <p className="text-sm text-blue-300">
                    {new Date(label.timestamp).toLocaleString()}
                  </p>
                  <p className="font-semibold">Label: {label.label}</p>
                  {label.description && (
                    <p className="text-blue-200 text-sm">{label.description}</p>
                  )}
                  <p className="text-blue-100 text-sm">ID: {label.id}</p>
                </div>
              )
            }
            return null
          })
        )}
      </div>
    </div>
  )
}

export default ProjectTimelineView
