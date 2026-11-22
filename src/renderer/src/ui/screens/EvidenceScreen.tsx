import { useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { evidenceMomentOf } from 'thefactory-ui/headless'
import { EvidenceView } from 'thefactory-ui/web'

/**
 * The page an evidence link opens, `/projects/:projectId/evidence/:evidenceId?at=`:
 * one screenshot, run-through issue or recording at its moment. Back returns to
 * where the person came from, or to the project's stories on a cold deep link.
 * Desktop peer of overseer-web.
 */
export default function EvidenceScreen(): React.JSX.Element | null {
  const { projectId, evidenceId } = useParams<{ projectId: string; evidenceId: string }>()
  const { search } = useLocation()
  const navigate = useNavigate()
  const at = evidenceMomentOf(search)
  const goBack = useCallback((): void => {
    if (window.history.state?.idx > 0) navigate(-1)
    else if (projectId) navigate(`/projects/${projectId}/stories`, { replace: true })
  }, [navigate, projectId])
  if (!projectId || !evidenceId) return null
  return (
    <div className="h-full overflow-y-auto">
      <EvidenceView
        projectId={projectId}
        evidenceId={evidenceId}
        {...(at !== undefined ? { at } : {})}
        onBack={goBack}
      />
    </div>
  )
}
