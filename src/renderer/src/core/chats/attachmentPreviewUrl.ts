import { chatFileRawUrl } from 'thefactory-ui/headless'
import type { ChatContext } from 'thefactory-ui/headless/api'

/**
 * A blob URL for a chat's file — an attachment's thumbnail, a shown file's
 * preview — read from wherever the chat keeps it: a project chat's through
 * its project's files, a group or general chat's from its own store. `null`
 * when the file is gone (the attachment was swept or its chat deleted).
 */
export async function fetchAttachmentPreviewUrl(
  baseUrl: string,
  context: ChatContext,
  path: string,
  token: string | null,
): Promise<string | null> {
  const r = await fetch(chatFileRawUrl(baseUrl, context, path), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Failed to load ${path} (${r.status})`)
  return URL.createObjectURL(await r.blob())
}
