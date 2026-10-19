import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PROCESS_LINK_PARAM,
  isGlobalChat,
  resolveResourceNav,
  type ResourceLink,
} from 'thefactory-ui/headless'
import { assistantPath } from '@core/chats/assistantPath'
import { getChatContextKey } from '@core/chats/chatKey'

/**
 * Route an in-app `overseer://…` resource link (F.2) to its screen. Aligned targets (project / story /
 * feature / app tab / process run) navigate to the shared path; a process opens in the project's
 * Settings › Processes on it; a chat target is encoded into this client's chat URL
 * (`:contextKey` = the URL-encoded full chat key) — an Assistant conversation's on the Assistant page. Handed to `<ChatBody onResourceLink={…}>` so links
 * the assistant emits open in-app instead of a new browser tab. Desktop peer of overseer-web.
 */
export function useNavigateToResource(): (link: ResourceLink) => void {
  const navigate = useNavigate()
  return useCallback(
    (link: ResourceLink) => {
      const nav = resolveResourceNav(link)
      if (nav.type === 'path') {
        navigate(nav.path)
        return
      }
      if (nav.type === 'process') {
        navigate(
          `/projects/${encodeURIComponent(nav.projectId)}/settings?tab=processes&${PROCESS_LINK_PARAM}=${encodeURIComponent(nav.processId)}`,
        )
        return
      }
      const ctx = nav.context
      const key = encodeURIComponent(getChatContextKey(ctx))
      if (ctx.projectId) navigate(`/projects/${ctx.projectId}/chat/${key}`)
      else if (ctx.groupId) navigate(`/groups/${ctx.groupId}/chat/${key}`)
      else if (isGlobalChat({ context: ctx })) navigate(assistantPath(ctx))
    },
    [navigate],
  )
}
