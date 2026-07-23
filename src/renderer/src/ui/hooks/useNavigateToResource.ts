import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolveResourceNav, type ResourceLink } from 'thefactory-ui/headless'
import { getChatContextKey } from '@core/chats/chatKey'

/**
 * Route an in-app `overseer://…` resource link (F.2) to its screen. Aligned targets (project / story /
 * feature / app tab) navigate to the shared path; a chat target is encoded into this client's chat URL
 * (`:contextKey` = the URL-encoded full chat key). Handed to `<ChatBody onResourceLink={…}>` so links
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
      const ctx = nav.context
      const key = encodeURIComponent(getChatContextKey(ctx))
      if (ctx.projectId) navigate(`/projects/${ctx.projectId}/chat/${key}`)
      else if (ctx.groupId) navigate(`/groups/${ctx.groupId}/chat/${key}`)
    },
    [navigate],
  )
}
