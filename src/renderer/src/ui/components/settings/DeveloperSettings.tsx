import BackendConnectionPanel from './BackendConnectionPanel'
import LinkRepoPanel from './LinkRepoPanel'
import OverseerPanel from './OverseerPanel'

export default function DeveloperSettings() {
  return (
    <div className="flex flex-col gap-8">
      <BackendConnectionPanel />
      <OverseerPanel />
      <LinkRepoPanel />
    </div>
  )
}
