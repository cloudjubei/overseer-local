export const OVERSEER_GIT_SUBTAB = 'git'

export function isOverseerGitSettings(searchParams: URLSearchParams): boolean {
  return (
    searchParams.get('tab') === 'developer' && searchParams.get('subtab') === OVERSEER_GIT_SUBTAB
  )
}
