import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  completeOverseerGithubAuth,
  getResponseDataMessage,
} from 'thefactory-ui/headless/api'
import { LoadingScreen } from 'thefactory-ui/web'

/**
 * Landing page for the GitHub OAuth redirect flow. GitHub redirects here with
 * `?code=...&state=...` after the user authorises the app. We POST those to
 * `completeOverseerGithubAuth` and then surface the resulting `tokenId` two
 * ways depending on how this page is reached:
 *
 *   - **Popup mode** (the main app opened this in `window.open(...)`): post
 *     the result back to the opener via `postMessage` and `window.close()`
 *     ourselves. The opener picks it up and resumes inline. No redirect, no
 *     full-page reload.
 *   - **Full-page mode** (the main app did `window.location.assign(authUrl)`,
 *     usually as a popup-blocked fallback): stash the `tokenId` in
 *     `sessionStorage` under {@link GITHUB_TOKEN_STORAGE_KEY} and
 *     `navigate('/')`. `WelcomeView` reads the key on mount and resumes at
 *     the repo-create step.
 */
export const GITHUB_TOKEN_STORAGE_KEY = 'overseer.github.tokenId'
export const GITHUB_OAUTH_MESSAGE_TYPE = 'overseer-github-oauth-result'

/**
 * Result we hand back to the opener — success or failure. Origin is checked
 * on the receiving side so an unrelated `postMessage` can't impersonate this.
 */
export type GithubOAuthResult = { ok: true; tokenId: string } | { ok: false; error: string }

/** Cross-window envelope: discriminator + result. */
export type GithubOAuthMessage = { type: typeof GITHUB_OAUTH_MESSAGE_TYPE } & GithubOAuthResult

export default function GithubCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    if (!code || !state) {
      const message = 'Missing OAuth code or state in the callback URL.'
      setError(message)
      tryReportToOpener({ ok: false, error: message })
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const { data } = await completeOverseerGithubAuth({
          body: { code, state },
          throwOnError: true,
        })
        if (cancelled) return

        if (tryReportToOpener({ ok: true, tokenId: data.tokenId })) {
          // Popup path: opener has the tokenId. Close us. (If `close()` is
          // blocked — some browsers refuse to close windows they didn't
          // open programmatically — the user just sees a "complete" screen
          // and can close it manually.)
          window.close()
          return
        }

        sessionStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, data.tokenId)
        navigate('/', { replace: true })
      } catch (err) {
        if (cancelled) return
        const message =
          getResponseDataMessage(err) ??
          (err instanceof Error ? err.message : 'GitHub authorization failed.')
        setError(message)
        tryReportToOpener({ ok: false, error: message })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [searchParams, navigate])

  if (error) {
    return <LoadingScreen label="GitHub authorization failed" error={error} />
  }
  return <LoadingScreen label="Completing GitHub authorization…" />
}

/**
 * `postMessage` the result to `window.opener` if (a) we have one and (b) it
 * isn't this same window. Returns `true` when the message was sent so the
 * caller can decide whether to also fall through to the sessionStorage path.
 */
function tryReportToOpener(result: GithubOAuthResult): boolean {
  const opener = window.opener as Window | null
  if (!opener || opener === window) return false
  const message: GithubOAuthMessage = { type: GITHUB_OAUTH_MESSAGE_TYPE, ...result }
  try {
    opener.postMessage(message, window.location.origin)
    return true
  } catch {
    return false
  }
}
