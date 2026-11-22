import { useEffect } from 'react'
import { useToast } from 'thefactory-ui/web'
import { DEEP_LINK_COPY } from '@core/deepLinks/deepLinkConstants'
import { readDeepLink } from '@core/deepLinks/deepLinkUtils'
import { deepLinkService } from '@services/deepLinkService'
import { useNavigateToResource } from '@ui/hooks/useNavigateToResource'

/**
 * Opens `overseer://` links clicked outside the app — in Slack, a browser, a
 * terminal, a report — through the same resolver as links inside it. A link
 * the app cannot read shows a short notice. Mounted once the backend is up,
 * so a link that starts the app waits in the main process until then.
 * Renders nothing.
 */
export default function DeepLinkOpener(): null {
  const navigateToResource = useNavigateToResource()
  const { toast } = useToast()

  useEffect(
    () =>
      deepLinkService.onOpen((url) => {
        const outcome = readDeepLink(url)
        if (outcome.kind === 'open') navigateToResource(outcome.link)
        else
          toast({ title: DEEP_LINK_COPY.unreadable, description: outcome.url, variant: 'warning' })
      }),
    [navigateToResource, toast],
  )

  return null
}
