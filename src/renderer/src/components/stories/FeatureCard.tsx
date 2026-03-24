import { useMemo } from 'react'
import type { Feature, ProjectSpec, Status, Story } from 'thefactory-tools'
import StatusControl from './StatusControl'
import Markdown from '../ui/Markdown'
import DependencyBullet from './DependencyBullet'
import { useAgents } from '@renderer/contexts/AgentsContext'
import { useNavigator } from '@renderer/navigation/Navigator'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { useStories } from '@renderer/contexts/StoriesContext'
import AgentRunBullet from '../agents/AgentRunBullet'
import RunAgentButton from './RunAgentButton'

export function FeatureCard({
  storyId,
  featureId,
  showStatus = true,
  onStatusChange,
  className = '',
  showActions = false,
  onPillClick,
}: {
  storyId: string
  featureId: string
  showStatus?: boolean
  onStatusChange?: (status: Status) => void | Promise<void>
  className?: string
  showActions?: boolean
  onPillClick?: () => void
}) {
  const { project } = useActiveProject()
  const { storiesById, featuresById } = useStories()

  const story = useMemo(() => {
    return storiesById[storyId]
  }, [storiesById, storyId])
  const feature = useMemo(() => {
    return featuresById[featureId]
  }, [featuresById, featureId])

  //TODO: show nice uknown view
  if (!feature || !story || !project) return <span>UNKNOWN FEATURE</span>

  return (
    <FeatureCardRaw
      project={project}
      story={story}
      feature={feature}
      showStatus={showStatus}
      onStatusChange={onStatusChange}
      className={className}
      showActions={showActions}
      onPillClick={onPillClick}
    />
  )
}
export function FeatureCardRaw({
  project,
  story,
  feature,
  showStatus = true,
  onStatusChange,
  className = '',
  showActions = false,
  isNew = false,
  onPillClick,
}: {
  project: ProjectSpec
  story: Story
  feature: Feature
  showStatus?: boolean
  onStatusChange?: (status: Status) => void | Promise<void>
  className?: string
  showActions?: boolean
  isNew?: boolean
  onPillClick?: () => void

  // onClick?: () => void
}) {
  //TODO: make a function `getAgentRun` that accepts a context - later we can construct that from
  const { runsHistory, startAgent } = useAgents()
  const { navigateAgentRun } = useNavigator()

  const projectId = project.id
  const storyId = story.id
  const featureId = feature.id
  const dependency = `${storyId}.${featureId}`
  console.log('FeatureCard dependency: ', dependency)

  const featureRun = runsHistory.find(
    (r) =>
      r.state === 'running' &&
      r.context.projectId === projectId &&
      r.context.storyId === storyId &&
      r.context.featureId === featureId,
  )

  return (
    <div
      className={`story-card p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md group ${className}`}
      // role={onClick ? 'button' : 'region'}
      // tabIndex={onClick ? 0 : undefined}
      // onClick={onClick}
      // onKeyDown={(e) => {
      //   if (!onClick && !onStatusChange) return
      //   if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      //     e.preventDefault()
      //     onClick()
      //   }
      //   if (onStatusChange && e.key.toLowerCase() === 's') {
      //     e.preventDefault()
      //     const order: Status[] = ['-', '~', '+', '=', '?']
      //     const current = story.status
      //     const idx = order.indexOf(current)
      //     const next = order[(idx + 1) % order.length]
      //     onStatusChange(next)
      //   }
      // }}
      aria-label={`Feature ${feature.id} ${feature.title}`}
    >
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
        {isNew ? (
          <span
            className={`id-chip bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 font-bold ${onPillClick ? 'cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/50' : ''}`}
            onClick={(e) => {
              if (onPillClick) {
                e.stopPropagation()
                onPillClick()
              }
            }}
          >
            NEW
          </span>
        ) : (
          <DependencyBullet
            key={dependency}
            dependency={dependency}
            interactive={false}
            disableHoverInfo={true}
          />
        )}
        <div className="story-card__actions opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 ease-out flex items-center gap-2">
          {showActions && (
            <>
              {featureRun ? (
                <AgentRunBullet
                  key={featureRun.context.agentRunId}
                  run={featureRun}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigateAgentRun(featureRun.context)
                  }}
                />
              ) : (
                <RunAgentButton
                  onClick={(agentType) => {
                    startAgent(agentType, projectId, storyId, featureId)
                  }}
                />
              )}
            </>
          )}
          {/* {onClick && showStatus && (
            <Tooltip content="Open details (Enter)" placement="top">
              <button
                className="btn-secondary !px-2 !py-1 text-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onClick()
                }}
                aria-label="Open details"
              >
                ↗
              </button>
            </Tooltip>
          )} */}
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-2" title={feature.title}>
        {feature.title}
      </h3>

      {feature.description && (
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-2 markdown-container text-ellipsis overflow-hidden">
          <Markdown text={feature.description} />
        </div>
      )}

      {feature.blockers && feature.blockers.length > 0 && (
        <div className="flex flex-wrap items-start gap-1 mb-2">
          {feature.blockers.map((dep) => (
            <DependencyBullet key={dep} dependency={dep} interactive={false} />
          ))}
        </div>
      )}

      {!isNew && showStatus && <StatusControl status={feature.status} onChange={onStatusChange} />}
    </div>
  )
}
//   return (
//     <div
//       className={`feature-card p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md ${className}`}
//     >
//         {isNew ? (
//           <span
//             className={`id-chip bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 font-bold ${onPillClick ? 'cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/50' : ''}`}
//             onClick={(e) => {
//               if (onPillClick) {
//                 e.stopPropagation()
//                 onPillClick()
//               }
//             }}
//           >
//             NEW
//           </span>
//         ) : (
//           <DependencyBullet
//             key={displayId}
//             dependency={displayId}
//             interactive={false}
//             disableHoverInfo={true}
//           />
//         )}

//       <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>

//       {feature.description && (
//         <div className="text-sm text-gray-600 dark:text-gray-300 mb-2 markdown-container text-ellipsis overflow-hidden">
//           <Markdown text={feature.description} />
//         </div>
//       )}

//       {feature.context && feature.context.length > 0 && (
//         <div className="flex flex-wrap items-start gap-1 mb-2">
//           {feature.context.map((p) => (
//             <ContextFileChip key={p} path={p} />
//           ))}
//         </div>
//       )}
//       {feature.blockers && feature.blockers.length > 0 && (
//         <div className="flex flex-wrap items-start gap-1 mb-2">
//           {feature.blockers.map((dep) => (
//             <DependencyBullet key={dep} dependency={dep} interactive={false} />
//           ))}
//         </div>
//       )}

//       {!isNew && <StatusControl status={feature.status} />}
//     </div>
//   )
// }
