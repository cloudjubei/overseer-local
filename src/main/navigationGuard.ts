function pageOf(url: URL): string {
  return `${url.protocol}//${url.host}${url.pathname}`
}

/**
 * A navigation to a local file that is not the app's own page — what a file
 * dropped on the window outside any drop handler turns into. The packaged app
 * is itself a `file://` page, so moving within it stays allowed.
 */
export function isStrayFileNavigation(targetUrl: string, appUrl: string): boolean {
  let target: URL
  try {
    target = new URL(targetUrl)
  } catch {
    return false
  }
  if (target.protocol !== 'file:') return false
  try {
    return pageOf(target) !== pageOf(new URL(appUrl))
  } catch {
    return true
  }
}
