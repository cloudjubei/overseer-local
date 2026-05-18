import { Surface } from 'thefactory-ui/web'

/**
 * "No projects yet" placeholder shown when [`useProjects`](../../core/contexts/ProjectsContext.tsx)
 * reports an empty list. Stub — web's full WelcomeView (clone repo / fresh
 * GitHub repo / local-only flows) is the §B.3.c port target; until that lift
 * lands, surface the backend address and a manual instruction.
 */
export default function WelcomeView() {
  return (
    <div className="flex items-center justify-center h-full w-full p-6">
      <Surface className="max-w-md p-6 flex flex-col gap-3">
        <div className="text-lg font-medium">No projects yet</div>
        <p className="text-sm opacity-80">
          The backend is reachable, but it doesn't have any projects yet. Create one from the web
          client or another desktop session — the project-creation flow ships in a later §B.3.c
          milestone.
        </p>
      </Surface>
    </div>
  )
}
