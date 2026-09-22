import { useNavigate } from 'react-router-dom'
import { processStatusOverlay, type ProcessRun } from 'thefactory-ui/headless'

/**
 * The live PROCESS state of a story, as a chip that LINKS to its pipeline —
 * shown where a story/feature row's Run button sits.
 *
 * A stored "Done" says nothing about whether the work's process has been signed
 * off, and nothing there is clickable. This surfaces the run's real state and a
 * way to act on it: Review → the sign-off gate, Crunching → the running pipeline,
 * Blocked → the stuck one. Renders nothing when there is no active/parked/failed
 * process run (the stored status and the normal Run affordance stand).
 */
export default function ProcessStatusChip({
  run,
  projectId,
}: {
  run: ProcessRun | undefined
  projectId: string
}) {
  const navigate = useNavigate()
  const overlay = processStatusOverlay(run)
  if (!overlay) return null
  const title =
    overlay.label === 'Review'
      ? 'Ready for sign-off — open the pipeline to review and approve'
      : overlay.label === 'Crunching'
        ? 'The process is running — open the pipeline'
        : 'The process is stuck — open the pipeline to unblock it'
  return (
    <button
      type="button"
      className={`badge badge--soft badge--${overlay.semantic}`}
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/projects/${projectId}/process-runs/${overlay.runId}`)
      }}
    >
      {overlay.label} →
    </button>
  )
}
