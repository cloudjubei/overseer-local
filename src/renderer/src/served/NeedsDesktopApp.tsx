import { Alert } from 'thefactory-ui/web'
import { SERVED_NEEDS_DESKTOP_APP } from './servedConstants'

/** Stands in, in the served build only, for a screen that only works over `safeStorage`. */
export default function NeedsDesktopApp(): React.JSX.Element {
  return (
    <div className="w-full p-6">
      <Alert variant="info">{SERVED_NEEDS_DESKTOP_APP}</Alert>
    </div>
  )
}
