import { useNavigate } from 'react-router-dom'
import {
  featureProcessOverlay,
  processStatusOverlay,
  useProcessStopClock,
  type ProcessRun,
} from 'thefactory-ui/headless'

/**
 * The live PROCESS state of a story, as a chip that LINKS to its pipeline —
 * shown where a story/feature row's Run button sits.
 *
 * A stored "Done" says nothing about whether the work's process has been signed
 * off, and nothing there is clickable. This surfaces the run's real state and a
 * way to act on it: Reviewable → the sign-off gate ("Go to Review"), Working →
 * the running pipeline, Blocked → the stuck one, Changes requested → the run to
 * send back. Renders nothing when there is no active/parked/failed process run
 * (the stored status and Run affordance stand).
 *
 * Given a `featureId`, it is that feature's chip (`featureProcessOverlay`): it
 * shows while the story's run is acting on that feature — its step, or a
 * story-level step acting on every feature — and never on a feature still queued.
 */
export default function ProcessStatusChip({
  run,
  projectId,
  featureId,
}: {
  run: ProcessRun | undefined
  projectId: string
  featureId?: string
}): React.JSX.Element | null {
  const stopNow = useProcessStopClock()
  const navigate = useNavigate()
  const overlay =
    featureId !== undefined
      ? featureProcessOverlay(run, featureId, stopNow)
      : processStatusOverlay(run, stopNow)
  if (!overlay) return null
  const isReview = overlay.semantic === 'review'
  return (
    <button
      type="button"
      className={`badge badge--soft badge--${overlay.semantic}`}
      title={overlay.title}
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/projects/${projectId}/process-runs/${overlay.runId}`)
      }}
    >
      {isReview ? 'Go to Review →' : `${overlay.label} →`}
    </button>
  )
}
