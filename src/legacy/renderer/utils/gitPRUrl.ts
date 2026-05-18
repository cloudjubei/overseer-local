export function getPRUrl(repoUrl: string, currentBranch: string, baseBranch: string = 'main'): string | null {
  if (!repoUrl) return null

  // Clean up the repoUrl (e.g. remove trailing .git)
  let cleanUrl = repoUrl.trim()
  if (cleanUrl.endsWith('.git')) {
    cleanUrl = cleanUrl.slice(0, -4)
  }

  // Handle ssh formats like git@github.com:owner/repo
  if (cleanUrl.startsWith('git@')) {
    // e.g. git@github.com:owner/repo -> ssh://git@github.com/owner/repo
    cleanUrl = cleanUrl.replace(':', '/')
    cleanUrl = 'ssh://' + cleanUrl
  }

  let urlObj: URL
  try {
    urlObj = new URL(cleanUrl)
  } catch (e) {
    return null
  }

  const host = urlObj.hostname
  const pathname = urlObj.pathname.replace(/^\//, '') // strip leading slash

  if (host.includes('github.com')) {
    // GitHub PR URL format: https://github.com/owner/repo/compare/baseBranch...currentBranch?expand=1
    return `https://${host}/${pathname}/compare/${encodeURIComponent(baseBranch)}...${encodeURIComponent(currentBranch)}?expand=1`
  }

  if (host.includes('gitlab.com')) {
    // GitLab PR URL format: https://gitlab.com/owner/repo/-/merge_requests/new?merge_request[source_branch]=currentBranch&merge_request[target_branch]=baseBranch
    return `https://${host}/${pathname}/-/merge_requests/new?merge_request[source_branch]=${encodeURIComponent(currentBranch)}&merge_request[target_branch]=${encodeURIComponent(baseBranch)}`
  }

  if (host.includes('bitbucket.org')) {
    // Bitbucket PR URL format: https://bitbucket.org/owner/repo/pull-requests/new?source=currentBranch&dest=baseBranch
    return `https://${host}/${pathname}/pull-requests/new?source=${encodeURIComponent(currentBranch)}&dest=${encodeURIComponent(baseBranch)}`
  }

  // Fallback or unknown host
  return null
}
