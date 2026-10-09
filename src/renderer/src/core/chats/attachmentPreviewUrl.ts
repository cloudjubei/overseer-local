/**
 * A blob URL for a project file — a chat attachment's thumbnail — through the
 * same raw-bytes route the Files view uses. `null` when the file is gone (the
 * attachment was swept or its chat deleted).
 */
export async function fetchAttachmentPreviewUrl(
  baseUrl: string,
  projectId: string,
  path: string,
  token: string | null,
): Promise<string | null> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/v1/projects/${encodeURIComponent(projectId)}/files/raw?path=${encodeURIComponent(path)}`
  const r = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Failed to load ${path} (${r.status})`)
  return URL.createObjectURL(await r.blob())
}
