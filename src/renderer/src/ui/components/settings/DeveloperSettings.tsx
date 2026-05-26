import BackendConnectionPanel from './BackendConnectionPanel'
import LinkRepoPanel from './LinkRepoPanel'
import { OverseerPanel } from "thefactory-ui/web"

export default function DeveloperSettings() {
  return (
    <div className="flex flex-col gap-8">
      <BackendConnectionPanel />
      <OverseerPanel />
      <LinkRepoPanel />
    </div>
  )
}
