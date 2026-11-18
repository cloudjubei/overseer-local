import { classifyFileByExtension } from 'thefactory-ui/headless'

/** Videos must keep their HTTP URL so the player can request byte ranges. */
export async function fetchFileBinaryUrl(
  baseUrl: string,
  projectId: string,
  path: string,
  token: string | null,
): Promise<string> {
  const root = baseUrl.replace(/\/+$/, '')
  const filesUrl = `${root}/api/v1/projects/${encodeURIComponent(projectId)}/files`
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined
  if (classifyFileByExtension(path) === 'video') {
    const response = await fetch(`${filesUrl}/media-url`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    if (!response.ok) throw new Error(`Failed to load video (${response.status})`)
    const { url } = (await response.json()) as { url: string }
    // The backend returns an origin-relative URL; Electron's own origin is not the API.
    return new URL(url, `${root}/`).href
  }
  const response = await fetch(`${filesUrl}/raw?path=${encodeURIComponent(path)}`, { headers })
  if (!response.ok) throw new Error(`Failed to load file (${response.status})`)
  return URL.createObjectURL(await response.blob())
}

export function revokeFileBinaryUrl(url: string): void {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}
