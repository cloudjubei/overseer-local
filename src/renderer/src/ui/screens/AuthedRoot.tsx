import { Navigate } from 'react-router-dom'
import { useProjects } from '../../core/contexts/ProjectsContext'
import LoadingScreen from './LoadingScreen'
import WelcomeView from './WelcomeView'

/**
 * Landing route post-auth (`/`). Mirrors web's [`AuthedRoot`](../../../../../../thefactory-overseer-web/src/App.tsx).
 * Redirects to the most recently active project's stories tab when available;
 * otherwise shows the welcome / no-projects view.
 */
export default function AuthedRoot() {
  const { isLoaded, loadError, projects, activeProjectId } = useProjects()
  if (!isLoaded) return <LoadingScreen label="Loading your projects…" />
  if (loadError)
    return <LoadingScreen label="Could not reach the backend" error={loadError.message} />
  if (projects.length === 0) return <WelcomeView />
  const target = activeProjectId ?? projects[0].id
  return <Navigate to={`/projects/${target}/stories`} replace />
}
