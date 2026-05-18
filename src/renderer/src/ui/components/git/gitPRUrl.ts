/**
 * Build a "create pull request" URL for the configured hosting provider.
 * Recognises GitHub, GitLab, and Bitbucket — returns `null` for anything
 * else (self-hosted Gitea, custom hosts, etc.) so callers can degrade
 * gracefully. Mirrors desktop's `getPRUrl` heuristic.
 */
export function getPRUrl(
  repoUrl: string,
  currentBranch: string,
  baseBranch: string = 'main',
): string | null {
  if (!repoUrl) return null

  let cleanUrl = repoUrl.trim()
  if (cleanUrl.endsWith('.git')) cleanUrl = cleanUrl.slice(0, -4)

  // git@github.com:owner/repo → ssh://git@github.com/owner/repo
  if (cleanUrl.startsWith('git@')) {
    cleanUrl = 'ssh://' + cleanUrl.replace(':', '/')
  }

  let urlObj: URL
  try {
    urlObj = new URL(cleanUrl)
  } catch {
    return null
  }

  const host = urlObj.hostname
  const pathname = urlObj.pathname.replace(/^\//, '')

  if (host.includes('github.com')) {
    return `https://${host}/${pathname}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(currentBranch)}?expand=1`
  }
  if (host.includes('gitlab.com')) {
    return `https://${host}/${pathname}/-/merge_requests/new?merge_request[source_branch]=${encodeURIComponent(currentBranch)}&merge_request[target_branch]=${encodeURIComponent(baseBranch)}`
  }
  if (host.includes('bitbucket.org')) {
    return `https://${host}/${pathname}/pull-requests/new?source=${encodeURIComponent(currentBranch)}&dest=${encodeURIComponent(baseBranch)}`
  }
  return null
}
