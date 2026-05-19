import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  createOverseerGithubRepo,
  createProject,
  createProjectGithubRepo,
  getOverseerGithubAuthUrl,
  listOverseerAuthProviders,
  pollOverseerGithubDeviceFlow,
  startOverseerGithubDeviceFlow,
  getResponseDataMessage,
} from 'thefactory-ui/headless/api'
import type {
  GetProjectResponse,
  OverseerAuthProviders,
  ProjectDataLocation,
} from 'thefactory-ui/headless/api'
import { useOverseer } from '@core/contexts/OverseerContext'
import { useProjects } from '@core/contexts/ProjectsContext'
import { Alert } from 'thefactory-ui/web'
import { Button } from 'thefactory-ui/web'
import { Field } from 'thefactory-ui/web'
import { Input } from 'thefactory-ui/web'
import { ConfirmDialog } from 'thefactory-ui/web'
import { Surface } from 'thefactory-ui/web'
import { IconArrowLeftMini } from 'thefactory-ui/web/icons'
import {
  GITHUB_OAUTH_MESSAGE_TYPE,
  GITHUB_TOKEN_STORAGE_KEY,
  type GithubOAuthMessage,
} from './GithubCallback'

type Step =
  | 'chooser'
  | 'connect'
  | 'github-fresh-auth'
  | 'github-fresh-create'
  | 'local-only-confirm'
  | 'project-chooser'
  | 'project-import'
  | 'project-new-github-auth'
  | 'project-new-github-create'
  | 'project-new-local'

/**
 * First-run flow shown when the backend reports zero projects. Three paths:
 *
 * 1. **Connect to a git repository** — clone any URL; if the remote already
 *    has thefactory-overseer files, projects load automatically. If empty,
 *    the backend seeds it (see implementation-plan.md A1, half-shipped).
 * 2. **Create a fresh GitHub repository** — runs GitHub OAuth (Device Flow
 *    when the backend advertises it; falls back to "coming soon" when no
 *    flow is configured). Hidden card until the operator wires up
 *    `GITHUB_CLIENT_ID`.
 * 3. **Use it locally only** — flagged risky; no remote, no off-machine
 *    backups. Gated on an "I understand" confirmation.
 *
 * The chooser is auto-skipped to `project-chooser` when
 * `hasRemote && projectCount === 0` — the user already configured a remote
 * on an earlier visit but hasn't created their first project yet.
 *
 * Splits into two components so the auto-skip decision is made *once* on
 * mount with overseer state in hand, instead of trying to correct it after
 * the fact (which would fight the user if they navigated back to the chooser).
 */
export default function WelcomeView() {
  const overseer = useOverseer()
  const authProviders = useAuthProviders()
  if (!overseer.isLoaded || !authProviders.isLoaded) return <LoadingShell />
  // If `getOverseer` errored, falling through to the chooser would silently
  // mis-frame this as "you've never set up". Surface the error instead so
  // the user can retry rather than redoing setup against a backend that's
  // about to come back.
  if (overseer.loadError || !overseer.state) {
    return (
      <div className="flex items-center justify-center h-full w-full p-6">
        <Surface className="flex flex-col gap-3 p-5 max-w-lg">
          <h2 className="text-lg font-semibold">Couldn’t load thefactory-overseer</h2>
          <Alert variant="error">
            {overseer.loadError?.message ??
              'The backend didn’t return overseer state. Check that it’s running and reachable, then refresh.'}
          </Alert>
          <Button variant="primary" onClick={() => void overseer.refresh()}>
            Retry
          </Button>
        </Surface>
      </div>
    )
  }
  // If we just came back from a GitHub OAuth redirect, the callback page has
  // stashed a tokenId in sessionStorage. The full-page fallback is only used
  // by the *overseer* setup path (the project path is popup-only — see
  // ProjectFreshGithubAuthFlow), so resuming straight at the overseer
  // create-repo step is unambiguous.
  const pendingGithubAuth = sessionStorage.getItem(GITHUB_TOKEN_STORAGE_KEY) !== null
  // `setupCompleted` is the backend's persistent marker — flipped by every
  // setup path (set/clone remote, fresh-github, confirm-local-only) and
  // wiped by `resetOverseer`. We OR with `hasRemote` for two reasons: (1)
  // an overseer set up against an older backend (pre-marker) only carries
  // `hasRemote=true`; (2) belt-and-braces if a path forgets to flip the
  // marker, the remote alone proves the user set this up. `hasRemote=false`
  // overseers (local-only) rely on `setupCompleted` exclusively.
  const overseerSetUp = overseer.state.setupCompleted || overseer.state.hasRemote
  const initialStep: Step = pendingGithubAuth
    ? 'github-fresh-create'
    : overseerSetUp
      ? 'project-chooser'
      : 'chooser'
  return <WelcomeFlow initialStep={initialStep} authProviders={authProviders.value} />
}

/**
 * One-shot fetch of `auth-providers` so the chooser can decide which GitHub
 * card variant to show (device-flow CTA vs. "coming soon"). Only called
 * once on mount — the answer doesn't change at runtime, it's an env-time
 * config on the backend.
 */
function useAuthProviders(): {
  isLoaded: boolean
  value: OverseerAuthProviders
} {
  const [value, setValue] = useState<OverseerAuthProviders>({ providers: [], githubFlows: [] })
  const [isLoaded, setIsLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await listOverseerAuthProviders({ throwOnError: true })
        if (!cancelled) setValue(data)
      } catch {
        // Treat any failure as "no providers" — the chooser falls back to
        // showing the GitHub card as "Coming soon," which is the same UX
        // the operator gets when GitHub env isn't configured.
      } finally {
        if (!cancelled) setIsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return { isLoaded, value }
}

function LoadingShell() {
  return (
    <div className="flex items-center justify-center h-full w-full p-6">
      <p className="text-sm opacity-70">Loading…</p>
    </div>
  )
}

function WelcomeFlow({
  initialStep,
  authProviders,
}: {
  initialStep: Step
  authProviders: OverseerAuthProviders
}) {
  const [step, setStep] = useState<Step>(initialStep)
  // tokenId acquired by the OAuth flow — kept here so the create-repo
  // step (which is a separate render) has access to it. Cleared on
  // back/success.
  const [overseerToken, setOverseerToken] = useState<string | null>(() =>
    sessionStorage.getItem(GITHUB_TOKEN_STORAGE_KEY),
  )
  const [projectToken, setProjectToken] = useState<string | null>(null)

  const backToOverseerChooser = () => setStep('chooser')
  const backToProjectChooser = () => setStep('project-chooser')

  // Both flows are popup-based and seamless. Prefer redirect when available
  // — its callback `postMessage`s the result, so the moment the user hits
  // Authorize on GitHub the popup closes and the app advances. Device flow
  // is the fallback (still seamless: pre-filled code, auto-close popup, but
  // adds one polling round-trip between Authorize and "done").
  const hasDevice = authProviders.githubFlows.includes('device')
  const hasRedirect = authProviders.githubFlows.includes('redirect')
  const githubAvailable = hasDevice || hasRedirect

  // Once the overseer is committed, the user is "inside" it — no Back to the
  // overseer chooser. The banner's Change… affordance is the way out.
  const inProjectFlow =
    step === 'project-chooser' ||
    step === 'project-import' ||
    step === 'project-new-github-auth' ||
    step === 'project-new-github-create' ||
    step === 'project-new-local'

  return (
    <div className="flex items-center justify-center h-full w-full p-6 overflow-auto">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold">Welcome to thefactory-overseer</h1>
          <p className="text-sm opacity-70 mt-1">
            Your thefactory-overseer project is the central git repo that owns your projects’
            registry, credentials, and (for projects on the central data-location) their stories and
            chats. Pick how to set it up.
          </p>
        </header>

        {inProjectFlow && (
          <OverseerStatusBanner
            onReset={() => {
              setOverseerToken(null)
              setProjectToken(null)
              setStep('chooser')
            }}
          />
        )}

        {step === 'chooser' && <Chooser onPick={setStep} githubAvailable={githubAvailable} />}
        {step === 'connect' && (
          <ConnectOverseerForm
            onBack={backToOverseerChooser}
            onConnected={() => setStep('project-chooser')}
          />
        )}
        {step === 'github-fresh-auth' && hasRedirect && (
          <GithubFreshRedirectFlow
            onBack={backToOverseerChooser}
            onAuthorized={(tokenId) => {
              // Persist so a force refresh during the auth→create-repo
              // gap doesn't lose the tokenId — the redirect flow's
              // full-page fallback already writes via GithubCallback;
              // this unifies the popup path with it.
              sessionStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, tokenId)
              setOverseerToken(tokenId)
              setStep('github-fresh-create')
            }}
          />
        )}
        {step === 'github-fresh-auth' && !hasRedirect && hasDevice && (
          <GithubFreshDeviceFlow
            onBack={backToOverseerChooser}
            onAuthorized={(tokenId) => {
              sessionStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, tokenId)
              setOverseerToken(tokenId)
              setStep('github-fresh-create')
            }}
          />
        )}
        {step === 'github-fresh-auth' && !githubAvailable && (
          <GithubFreshComingSoon onBack={backToOverseerChooser} />
        )}
        {step === 'github-fresh-create' && overseerToken && (
          <CreateOverseerRepoForm
            tokenId={overseerToken}
            onBack={() => {
              sessionStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY)
              setOverseerToken(null)
              setStep('github-fresh-auth')
            }}
            onCreated={() => {
              sessionStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY)
              setOverseerToken(null)
              setStep('project-chooser')
            }}
          />
        )}
        {step === 'local-only-confirm' && (
          <LocalOnlyConfirmation
            onBack={backToOverseerChooser}
            onContinue={() => setStep('project-chooser')}
          />
        )}
        {step === 'project-chooser' && (
          <ProjectChooser onPick={setStep} githubAvailable={githubAvailable} />
        )}
        {step === 'project-import' && <ImportProjectForm onBack={backToProjectChooser} />}
        {step === 'project-new-github-auth' && hasRedirect && (
          <GithubFreshRedirectFlow
            onBack={backToProjectChooser}
            onAuthorized={(tokenId) => {
              setProjectToken(tokenId)
              setStep('project-new-github-create')
            }}
            popupOnly
          />
        )}
        {step === 'project-new-github-auth' && !hasRedirect && hasDevice && (
          <GithubFreshDeviceFlow
            onBack={backToProjectChooser}
            onAuthorized={(tokenId) => {
              setProjectToken(tokenId)
              setStep('project-new-github-create')
            }}
          />
        )}
        {step === 'project-new-github-create' && projectToken && (
          <CreateProjectRepoForm
            tokenId={projectToken}
            onBack={() => {
              setProjectToken(null)
              setStep('project-new-github-auth')
            }}
            onCreated={() => {
              setProjectToken(null)
            }}
          />
        )}
        {step === 'project-new-local' && <NewProjectForm onBack={backToProjectChooser} />}
      </div>
    </div>
  )
}

function Chooser({
  onPick,
  githubAvailable,
}: {
  onPick: (step: Step) => void
  githubAvailable: boolean
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card
        title="Connect to a git repository"
        body="Paste any git URL. If the repository already has thefactory-overseer files, your projects load automatically. Recommended."
        cta="Connect…"
        onClick={() => onPick('connect')}
        tone="recommended"
      />
      <Card
        title="Create a fresh GitHub repository"
        body={
          githubAvailable
            ? 'Authorize this machine via GitHub and create a private repository for thefactory-overseer.'
            : 'Guide me through GitHub authentication and create a private repository for thefactory-overseer.'
        }
        cta={githubAvailable ? 'Use GitHub…' : 'Coming soon'}
        onClick={() => onPick('github-fresh-auth')}
        tone="default"
        comingSoon={!githubAvailable}
      />
      <Card
        title="Use it locally only"
        body="Risky — your overseer lives only on this machine. If it dies, projects, credentials, runs, and chats die with it."
        cta="Continue locally…"
        onClick={() => onPick('local-only-confirm')}
        tone="danger"
      />
    </div>
  )
}

type CardTone = 'recommended' | 'default' | 'danger'

function Card({
  title,
  body,
  cta,
  onClick,
  tone,
  comingSoon,
}: {
  title: string
  body: string
  cta: string
  onClick: () => void
  tone: CardTone
  comingSoon?: boolean
}) {
  const borderColor =
    tone === 'recommended'
      ? 'var(--accent-primary)'
      : tone === 'danger'
        ? 'var(--color-red-500)'
        : 'var(--border-subtle)'

  return (
    <Surface
      className="flex flex-col gap-3 p-5"
      style={{ borderColor, borderWidth: tone === 'default' ? 1 : 2 }}
    >
      {tone === 'recommended' && (
        <Tag background="var(--accent-primary)" color="white">
          Recommended
        </Tag>
      )}
      {tone === 'danger' && (
        <Tag background="var(--color-red-500)" color="white">
          Risky
        </Tag>
      )}
      {comingSoon && (
        <Tag background="var(--color-gray-400)" color="white">
          Coming soon
        </Tag>
      )}
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm opacity-70 flex-1">{body}</p>
      <Button
        variant={tone === 'danger' ? 'danger' : tone === 'recommended' ? 'primary' : 'secondary'}
        onClick={onClick}
        disabled={comingSoon}
      >
        {cta}
      </Button>
    </Surface>
  )
}

function Tag({
  background,
  color,
  children,
}: {
  background: string
  color: string
  children: ReactNode
}) {
  return (
    <span
      className="self-start text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
      style={{ background, color }}
    >
      {children}
    </span>
  )
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="self-start inline-flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
    >
      <IconArrowLeftMini className="w-3 h-3" />
      Back
    </button>
  )
}

function ConnectOverseerForm({
  onBack,
  onConnected,
}: {
  onBack: () => void
  onConnected: () => void
}) {
  const overseer = useOverseer()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      await overseer.clone(trimmed)
      // If the cloned remote already has projects, the WS broadcast will
      // refresh ProjectsContext and `AuthedRoot` will navigate us away from
      // this view. If it was empty, projectCount stays 0 and we'd be stuck
      // here; advance explicitly to the project chooser. Either way safe —
      // the unmount path wins the race.
      onConnected()
    } catch (err) {
      setError(extractCloneErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Surface as="form" onSubmit={submit} className="flex flex-col gap-4 p-5">
      <BackLink onBack={onBack} />
      <header>
        <h2 className="text-lg font-semibold">Connect to a git repository</h2>
        <p className="text-sm opacity-70">
          The backend will clone this repository into the overseer location. If it already has
          thefactory-overseer files, your projects load automatically. Otherwise the backend will
          initialise the structure and push the seed commit upstream.
        </p>
      </header>
      <Field label="Git URL">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="git@github.com:org/overseer.git"
          autoFocus
        />
      </Field>
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="submit" loading={busy} disabled={!url.trim()}>
        {busy ? 'Connecting…' : 'Connect'}
      </Button>
    </Surface>
  )
}

function GithubFreshComingSoon({ onBack }: { onBack: () => void }) {
  return (
    <Surface className="flex flex-col gap-4 p-5">
      <BackLink onBack={onBack} />
      <header>
        <h2 className="text-lg font-semibold">Create a fresh GitHub repository</h2>
        <p className="text-sm opacity-70">
          This path will guide you through GitHub authentication and create a private repository
          named <code>thefactory-overseer</code> on your behalf, then initialise it as your
          overseer.
        </p>
      </header>
      <Alert variant="info">
        GitHub authentication is not configured on this deployment. Set{' '}
        <code>GITHUB_CLIENT_ID</code>
        and <code>GITHUB_CLIENT_SECRET</code> on the backend (and either enable Device Flow on the
        OAuth App or configure a redirect URL) to enable this path. For now, create a repository on
        GitHub yourself and use the <em>Connect to a git repository</em> path with its URL.
      </Alert>
    </Surface>
  )
}

type DeviceFlowStage =
  | { kind: 'starting' }
  | {
      kind: 'awaiting'
      flowId: string
      userCode: string
      verificationUri: string
      verificationUriComplete?: string
      intervalMs: number
      expiresAt: number
    }
  | { kind: 'error'; message: string; canRetry: boolean }

/**
 * GitHub Device Flow path, made seamless. Acquires a tokenId and hands it
 * back via `onAuthorized` — the parent step is responsible for whatever
 * comes next (creating an overseer repo, a project repo, etc).
 *
 *   1. Hit `/device/start` to get a user code; poll `/device/poll` at the
 *      backend-reported interval until GitHub flips to `authorized`. Polling
 *      uses `setTimeout` (not `setInterval`) so a slow response or
 *      `slow_down` can't stack up overlapping requests.
 *   2. Open GitHub's device-code page in a centered popup, **with the user
 *      code pre-filled** (`?user_code=…`) — the user only sees the
 *      "Authorize" button, no copy-paste. We keep a reference to the popup
 *      so we can close it ourselves the moment polling reports success.
 *   3. Once authorized, call `onAuthorized(tokenId)` and unmount.
 *
 * Mobile fallback: if `window.open` returns null (popup blocked or browser
 * forces a new tab), we still show the user code + a "Copy code" button so
 * the user can copy-paste manually as a worst-case path.
 *
 * Cancellation uses a `cancelled` ref captured per-mount; we deliberately
 * do not abort in-flight axios calls — late responses are no-ops once the
 * cancel flag is set.
 */
function GithubFreshDeviceFlow({
  onBack,
  onAuthorized,
}: {
  onBack: () => void
  onAuthorized: (tokenId: string) => void
}) {
  const [stage, setStage] = useState<DeviceFlowStage>({ kind: 'starting' })
  const cancelledRef = useRef(false)
  // Reference to the GitHub popup so we can `popup.close()` the moment
  // polling reports authorization. We don't use `noopener` because that
  // would make `window.open` return null and lose the handle.
  const popupRef = useRef<Window | null>(null)

  const closePopup = () => {
    popupRef.current?.close()
    popupRef.current = null
  }

  // Kick off the device flow exactly once on mount. StrictMode double-invokes
  // effects in dev, which would otherwise issue two device codes — track
  // start with a ref so the second pass is a no-op.
  const startedRef = useRef(false)
  useEffect(() => {
    cancelledRef.current = false
    if (startedRef.current) return
    startedRef.current = true
    void startFlow()
    return () => {
      cancelledRef.current = true
      closePopup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startFlow() {
    setStage({ kind: 'starting' })
    try {
      const { data } = await startOverseerGithubDeviceFlow({ throwOnError: true })
      if (cancelledRef.current) return
      setStage({
        kind: 'awaiting',
        flowId: data.flowId,
        userCode: data.userCode,
        verificationUri: data.verificationUri,
        verificationUriComplete: data.verificationUriComplete,
        intervalMs: data.intervalMs,
        expiresAt: data.expiresAt,
      })
    } catch (err) {
      if (cancelledRef.current) return
      setStage({
        kind: 'error',
        message: extractGithubErrorMessage(
          err,
          'Could not start GitHub device flow. Make sure the OAuth app has "Enable Device Flow" toggled on.',
        ),
        canRetry: true,
      })
    }
  }

  // Poll while in the `awaiting` stage. Cleanup cancels the next scheduled poll.
  useEffect(() => {
    if (stage.kind !== 'awaiting') return
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    const poll = async () => {
      try {
        const { data } = await pollOverseerGithubDeviceFlow({
          body: { flowId: stage.flowId },
          throwOnError: true,
        })
        if (stopped) return
        if (data.status === 'authorized') {
          // Auto-close the GitHub popup so the user doesn't have to dismiss
          // it themselves. Safe even if they already closed it.
          closePopup()
          onAuthorized(data.tokenId)
          return
        }
        // 'pending' or 'slow_down' — schedule the next poll. For slow_down
        // we add 5s on top of the current interval; for pending we honour
        // whatever interval the backend reported.
        const wait = data.status === 'slow_down' ? stage.intervalMs + 5_000 : stage.intervalMs
        timer = setTimeout(() => void poll(), wait)
      } catch (err) {
        if (stopped) return
        const status = (err as { response?: { status?: number } }).response?.status
        if (status === 410) {
          closePopup()
          setStage({
            kind: 'error',
            message: 'The device code expired before authorization completed.',
            canRetry: true,
          })
          return
        }
        if (status === 403) {
          closePopup()
          setStage({
            kind: 'error',
            message: 'GitHub authorization was denied.',
            canRetry: true,
          })
          return
        }
        setStage({
          kind: 'error',
          message: extractGithubErrorMessage(err, 'Polling for GitHub authorization failed.'),
          canRetry: true,
        })
      }
    }

    timer = setTimeout(() => void poll(), stage.intervalMs)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [stage])

  if (stage.kind === 'starting') {
    return (
      <Surface className="flex flex-col gap-4 p-5">
        <BackLink onBack={onBack} />
        <header>
          <h2 className="text-lg font-semibold">Create a fresh GitHub repository</h2>
        </header>
        <p className="text-sm opacity-70">Asking GitHub for a device code…</p>
      </Surface>
    )
  }

  if (stage.kind === 'awaiting') {
    // Prefer the backend-supplied pre-filled URL; fall back to client-side
    // synthesis for older backends / non-canonical OAuth providers that
    // omit `verification_uri_complete`.
    const completeUri =
      stage.verificationUriComplete ??
      buildVerificationUriComplete(stage.verificationUri, stage.userCode)
    const openOnGithub = () => {
      // Re-open if the user closed it earlier; replace if still open.
      const existing = popupRef.current
      if (existing && !existing.closed) {
        existing.location.href = completeUri
        existing.focus()
        return
      }
      const popup = openCenteredPopup(completeUri, 'overseer-github-device-auth')
      popupRef.current = popup
      // If the popup was blocked, fall back to a same-tab navigation —
      // the user authorises on GitHub and uses the browser back button to
      // return. Polling on this side keeps running.
      if (!popup) window.open(completeUri, '_blank', 'noopener,noreferrer')
    }

    return (
      <Surface className="flex flex-col gap-4 p-5">
        <BackLink onBack={onBack} />
        <header>
          <h2 className="text-lg font-semibold">Create a fresh GitHub repository</h2>
          <p className="text-sm opacity-70">
            We’ll open a small window to GitHub with the verification code already filled in. Just
            click <strong>Authorize</strong>; we’ll detect when you’re done and close the window for
            you.
          </p>
        </header>
        <div className="flex flex-col gap-2 items-center">
          <code
            className="text-2xl font-mono tracking-widest px-4 py-2 rounded"
            style={{ background: 'var(--surface-muted)' }}
            title="Verify this matches the code GitHub shows you before authorising."
          >
            {stage.userCode}
          </code>
          <span className="text-xs opacity-60">
            Expires {new Date(stage.expiresAt).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex gap-2 self-stretch">
          <Button variant="primary" onClick={openOnGithub}>
            Authorize on GitHub
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(stage.userCode)
            }}
            title="Copy the code in case the popup was blocked and you need to paste it manually."
          >
            Copy code
          </Button>
        </div>
        <p className="text-xs opacity-60">
          Waiting for you to authorize on GitHub… (polling every{' '}
          {Math.round(stage.intervalMs / 1000)}s)
        </p>
      </Surface>
    )
  }

  // stage.kind === 'error'
  return (
    <Surface className="flex flex-col gap-4 p-5">
      <BackLink onBack={onBack} />
      <header>
        <h2 className="text-lg font-semibold">Create a fresh GitHub repository</h2>
      </header>
      <Alert variant="error">{stage.message}</Alert>
      {stage.canRetry && (
        <Button
          variant="primary"
          onClick={() => {
            startedRef.current = false
            void startFlow()
          }}
        >
          Try again
        </Button>
      )}
    </Surface>
  )
}

/**
 * Fallback: synthesise the pre-filled device-code URL client-side when the
 * backend's `verificationUriComplete` is absent (older GitHub Enterprise
 * builds and some non-canonical OAuth providers skip the field). On
 * canonical github.com responses the backend value is used directly and
 * this function isn't called.
 */
function buildVerificationUriComplete(verificationUri: string, userCode: string): string {
  try {
    const url = new URL(verificationUri)
    url.searchParams.set('user_code', userCode)
    return url.toString()
  } catch {
    // Malformed URI from the backend — fall back to naive concat. Better
    // a busted URL than a crashed flow.
    const sep = verificationUri.includes('?') ? '&' : '?'
    return `${verificationUri}${sep}user_code=${encodeURIComponent(userCode)}`
  }
}

/**
 * GitHub redirect-flow path. Acquires a tokenId and hands it back via
 * `onAuthorized`. Popup-first; for the overseer setup we additionally
 * fall back to a full-page redirect when the popup is blocked (the
 * callback page stashes the tokenId in sessionStorage and `WelcomeView`
 * resumes the flow on remount). For project-side use, pass `popupOnly`
 * — the project step has no sessionStorage handoff and an unwanted
 * full-page redirect would lose form state and context.
 *
 * Pre-auth states:
 *   - **Idle:** "Authorize via GitHub" button. Click → open a popup
 *     synchronously (about:blank, so mobile Safari's gesture-required
 *     popup-blocker treats it as user-triggered), fetch the auth URL,
 *     navigate the popup. If `window.open` returned null (popup blocked):
 *     `popupOnly` shows an inline error; otherwise fall back to
 *     `window.location.assign` (callback handles the rest).
 *   - **Awaiting popup:** we're listening for either a `postMessage` from
 *     the callback (success/error) or the popup closing without one
 *     (user cancelled). Either resolves the await.
 */
function GithubFreshRedirectFlow({
  onBack,
  onAuthorized,
  popupOnly,
}: {
  onBack: () => void
  onAuthorized: (tokenId: string) => void
  /**
   * When true, popup-blocked browsers see an inline error instead of a
   * full-page redirect. Set for project-scope auth — the redirect-back
   * sessionStorage handoff is owned by the overseer setup path.
   */
  popupOnly?: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<'idle' | 'starting' | 'awaiting'>('idle')

  // Popup window we're tracking — kept in a ref so the message-listener
  // and the popup-closed-poll can find it without re-running the effect
  // on every state change.
  const popupRef = useRef<Window | null>(null)

  // Listener for the callback page's postMessage. Mounted once; origin
  // is checked to reject stray cross-origin messages. Successful messages
  // are forwarded to the parent — we deliberately don't store the token
  // ourselves so the parent owns its lifetime.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as Partial<GithubOAuthMessage> | null
      if (!data || data.type !== GITHUB_OAUTH_MESSAGE_TYPE) return
      if (data.ok === true && typeof data.tokenId === 'string') {
        popupRef.current?.close()
        popupRef.current = null
        setAuthStatus('idle')
        onAuthorized(data.tokenId)
      } else if (data.ok === false) {
        setError(data.error ?? 'GitHub authorization failed.')
        setAuthStatus('idle')
        popupRef.current?.close()
        popupRef.current = null
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onAuthorized])

  // Detect the user closing the popup without authorising. Polls every
  // 500 ms while we're awaiting; cleared as soon as we leave that state.
  useEffect(() => {
    if (authStatus !== 'awaiting') return
    const interval = window.setInterval(() => {
      const popup = popupRef.current
      if (popup && popup.closed) {
        popupRef.current = null
        setAuthStatus('idle')
        setError('GitHub authorization window was closed before completing.')
      }
    }, 500)
    return () => window.clearInterval(interval)
  }, [authStatus])

  const startAuth = async () => {
    setError(null)
    setAuthStatus('starting')

    // Open the popup *synchronously* with the click — mobile browsers (and
    // some desktop ones) only allow `window.open` from a direct user
    // gesture. Navigating it to the auth URL once we've fetched it keeps
    // the click context.
    const popup = openCenteredPopup('about:blank', 'overseer-github-auth')

    let authUrl: string
    try {
      const { data } = await getOverseerGithubAuthUrl({ throwOnError: true })
      authUrl = data.authUrl
    } catch (err) {
      popup?.close()
      setAuthStatus('idle')
      setError(
        extractGithubErrorMessage(
          err,
          'Could not start GitHub authorization. Make sure GITHUB_CLIENT_ID is configured on the backend.',
        ),
      )
      return
    }

    if (!popup || popup.closed) {
      if (popupOnly) {
        setAuthStatus('idle')
        setError(
          'Couldn’t open the GitHub authorization popup. Allow popups for this site and try again.',
        )
        return
      }
      // Popup blocked — fall back to a full-page redirect. The callback
      // page handles the non-popup branch (sessionStorage + navigate).
      window.location.assign(authUrl)
      return
    }

    popupRef.current = popup
    popup.location.href = authUrl
    setAuthStatus('awaiting')
  }

  return (
    <Surface className="flex flex-col gap-4 p-5">
      <BackLink onBack={onBack} />
      <header>
        <h2 className="text-lg font-semibold">Authorize via GitHub</h2>
        <p className="text-sm opacity-70">
          {popupOnly
            ? 'We’ll open a small window to GitHub for you to authorize this machine. If your browser blocks popups, allow them for this site and try again.'
            : 'We’ll open a small window to GitHub for you to authorize this machine. If your browser blocks the popup, we’ll redirect this page instead.'}
        </p>
      </header>
      {error && <Alert variant="error">{error}</Alert>}
      <Button
        variant="primary"
        onClick={startAuth}
        loading={authStatus !== 'idle'}
        disabled={authStatus !== 'idle'}
      >
        {authStatus === 'awaiting'
          ? 'Waiting for GitHub…'
          : authStatus === 'starting'
            ? 'Opening GitHub…'
            : 'Authorize via GitHub'}
      </Button>
      {authStatus === 'awaiting' && (
        <p className="text-xs opacity-60">
          Complete authorization in the popup window. We’ll detect when you’re done.
        </p>
      )}
    </Surface>
  )
}

/**
 * Open a roughly-centered popup. Returns null when the browser blocks it
 * (e.g. user has popups disabled, or the click context was lost). Width
 * and height are chosen to fit GitHub's auth screen comfortably without
 * dominating the desktop.
 */
function openCenteredPopup(url: string, name: string): Window | null {
  const width = 600
  const height = 720
  // `screen.availWidth/Height` excludes OS chrome (taskbar etc.); falls
  // back gracefully when unavailable.
  const screenWidth = window.screen.availWidth ?? window.innerWidth
  const screenHeight = window.screen.availHeight ?? window.innerHeight
  const left = Math.max(0, Math.round((screenWidth - width) / 2))
  const top = Math.max(0, Math.round((screenHeight - height) / 2))
  const features = `popup=yes,width=${width},height=${height},left=${left},top=${top}`
  return window.open(url, name, features)
}

/**
 * Post-auth form for the overseer setup. Calls `createOverseerGithubRepo`
 * with the tokenId acquired by either GitHub flow (redirect or device).
 */
function CreateOverseerRepoForm({
  tokenId,
  onBack,
  onCreated,
}: {
  tokenId: string
  onBack: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('thefactory-overseer')
  const [isPrivate, setIsPrivate] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || creating) return
    setCreating(true)
    setError(null)
    try {
      await createOverseerGithubRepo({
        body: { tokenId, name: trimmed, private: isPrivate },
        throwOnError: true,
      })
      onCreated()
    } catch (err) {
      setError(extractGithubErrorMessage(err, 'Could not create the GitHub repository.'))
      setCreating(false)
    }
  }

  return (
    <Surface as="form" onSubmit={submit} className="flex flex-col gap-4 p-5">
      <BackLink onBack={onBack} />
      <header>
        <h2 className="text-lg font-semibold">Create a fresh GitHub repository</h2>
        <p className="text-sm opacity-70">
          GitHub authorized this machine. Pick a repository name; we’ll create it under your
          account, push the seed commit, then drop the access token from <code>.git/config</code>.
        </p>
      </header>
      {error && <Alert variant="error">{error}</Alert>}
      <Field label="Repository name">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        <span>Private repository (recommended)</span>
      </label>
      <Button type="submit" loading={creating} disabled={!name.trim()}>
        {creating ? 'Creating…' : 'Create repository'}
      </Button>
    </Surface>
  )
}

/**
 * Post-auth form for the project flow. Submits project metadata + repo
 * settings to `createProjectGithubRepo` (with the `projectMeta` body
 * shape, so the backend creates the repo and registers the project in a
 * single round-trip), then advances to the active project via
 * `setActiveProjectId` — the same handoff `ImportProjectForm` uses.
 */
function CreateProjectRepoForm({
  tokenId,
  onBack,
  onCreated,
}: {
  tokenId: string
  onBack: () => void
  onCreated: () => void
}) {
  const { refresh, setActiveProjectId } = useProjects()

  const [id, setId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [repoName, setRepoName] = useState('')
  const [repoNameTouched, setRepoNameTouched] = useState(false)
  const [isPrivate, setIsPrivate] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default the repo name to the project id so the user only types one
  // identifier in most cases. Stops mirroring the moment they edit the
  // repo name themselves.
  const effectiveRepoName = repoNameTouched ? repoName : id

  const trimmedId = id.trim()
  const trimmedTitle = title.trim()
  const trimmedDesc = description.trim()
  const trimmedRepoName = effectiveRepoName.trim()
  const canSubmit =
    trimmedId.length > 0 &&
    trimmedTitle.length > 0 &&
    trimmedDesc.length > 0 &&
    trimmedRepoName.length > 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || creating) return
    setCreating(true)
    setError(null)
    try {
      const { data: created } = await createProjectGithubRepo({
        body: {
          tokenId,
          name: trimmedRepoName,
          private: isPrivate,
          projectMeta: {
            id: trimmedId,
            title: trimmedTitle,
            description: trimmedDesc,
          },
        },
        throwOnError: true,
      })
      const project: GetProjectResponse = created
      await refresh()
      setActiveProjectId(project.id)
      onCreated()
    } catch (err) {
      setError(extractGithubErrorMessage(err, 'Could not create the GitHub repository.'))
      setCreating(false)
    }
  }

  return (
    <Surface as="form" onSubmit={submit} className="flex flex-col gap-4 p-5">
      <BackLink onBack={onBack} />
      <header>
        <h2 className="text-lg font-semibold">Create a fresh GitHub repository for this project</h2>
        <p className="text-sm opacity-70">
          GitHub authorized this machine. Fill in the project details; we’ll create the repository
          under your account, push the seed commit, register the project, and drop the access token
          from <code>.git/config</code>.
        </p>
      </header>
      {error && <Alert variant="error">{error}</Alert>}
      <Field label="Project ID" hint="A short stable identifier (e.g. my-app).">
        <Input value={id} onChange={(e) => setId(e.target.value)} autoFocus />
      </Field>
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field
        label="Repository name"
        hint="Defaults to the project ID. Edit if you want them to differ."
      >
        <Input
          value={effectiveRepoName}
          onChange={(e) => {
            setRepoNameTouched(true)
            setRepoName(e.target.value)
          }}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        <span>Private repository (recommended)</span>
      </label>
      <Button type="submit" loading={creating} disabled={!canSubmit}>
        {creating ? 'Creating…' : 'Create repository'}
      </Button>
    </Surface>
  )
}

function extractGithubErrorMessage(err: unknown, fallback: string): string {
  // Backend uses `{ error: string }` for all GitHub OAuth errors (device
  // flow, redirect flow, repo creation). Fall through to `message` (older
  // overseer envelopes) and finally the transport error message.
  const responseError = (() => {
    if (!err || typeof err !== 'object') return undefined
    const data = (err as { response?: { data?: unknown } }).response?.data
    if (!data || typeof data !== 'object') return undefined
    const e = (data as { error?: unknown }).error
    return typeof e === 'string' ? e : undefined
  })()
  return (
    responseError ?? getResponseDataMessage(err) ?? (err instanceof Error ? err.message : fallback)
  )
}

function LocalOnlyConfirmation({
  onBack,
  onContinue,
}: {
  onBack: () => void
  onContinue: () => void
}) {
  const { confirmLocalOnly } = useOverseer()
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!acknowledged || busy) return
    setBusy(true)
    setError(null)
    try {
      await confirmLocalOnly()
      onContinue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the local-only setup choice.')
      setBusy(false)
    }
  }

  return (
    <Surface className="flex flex-col gap-4 p-5">
      <BackLink onBack={onBack} />
      <header>
        <h2 className="text-lg font-semibold">Use thefactory-overseer locally only</h2>
      </header>
      <Alert variant="error">
        Your overseer will live only on this machine. The daily squash commits locally but never
        pushes anywhere. If this machine dies, fails, or is wiped, your projects’ registry,
        credentials, agent runs, and (for projects on the central data-location) their stories and
        chats are <strong>gone</strong>. There is no recovery path.
      </Alert>
      <p className="text-sm opacity-70">
        You can attach a remote later from <em>Settings → Overseer</em>, but only before the machine
        is lost.
      </p>
      <label className="flex items-start gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1"
        />
        <span>I understand the risk and want to continue without a remote.</span>
      </label>
      {error && <Alert variant="error">{error}</Alert>}
      <Button variant="danger" onClick={submit} loading={busy} disabled={!acknowledged || busy}>
        Continue locally
      </Button>
    </Surface>
  )
}

/**
 * Header shown above all `project-*` steps. Once the overseer is committed,
 * the user is "inside" it — backing out to the overseer chooser would be
 * misleading. This banner makes the active overseer visible and exposes
 * `Change overseer…` which archives the current overseer and routes back
 * to the welcome chooser via the `overseer:updated` WS broadcast.
 */
function OverseerStatusBanner({ onReset }: { onReset: () => void }) {
  const { state, reset } = useOverseer()
  const [confirming, setConfirming] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  if (!state) return null
  const remoteLine = state.hasRemote ? (state.remoteUrl ?? 'Configured') : 'No remote — local only'
  return (
    <Surface className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs uppercase tracking-wider opacity-60">Currently using</span>
          <span className="text-sm font-medium truncate" title={state.path}>
            {state.path}
          </span>
          <span className="text-xs opacity-70 truncate" title={remoteLine}>
            {remoteLine}
          </span>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setResetError(null)
            setConfirming(true)
          }}
        >
          Change overseer…
        </Button>
      </div>
      {resetError && <Alert variant="error">{resetError}</Alert>}
      <ConfirmDialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          try {
            await reset()
            onReset()
          } catch (err) {
            setResetError(
              err instanceof Error ? err.message : 'Could not archive the current overseer.',
            )
          }
        }}
        title="Switch to a different overseer?"
        description={
          state.hasRemote
            ? 'The current overseer is archived locally (recoverable from the host’s archive directory). The remote is left untouched, so you can re-clone it later if you change your mind.'
            : 'The current overseer is archived locally (recoverable from the host’s archive directory). It has no remote, so once archived it only exists in the archive directory — back it up first if you need it.'
        }
        confirmLabel="Archive and switch"
        cancelLabel="Cancel"
        destructive
      />
    </Surface>
  )
}

/**
 * Project setup chooser shown after the overseer is committed. Three paths:
 *
 *   - **Import existing** — paste a git URL; backend clones it (and seeds
 *     it with the project's overseer files if missing).
 *   - **Set up new on a fresh GitHub repo** — runs GitHub OAuth (popup-only;
 *     the welcome flow's full-page-redirect handoff is reserved for the
 *     overseer setup), then creates the repo and the project in one
 *     backend round-trip. Hidden when GitHub OAuth isn't configured.
 *   - **Set up new locally** — register the project metadata only. A repo
 *     can be linked later from Settings → Repository.
 */
function ProjectChooser({
  onPick,
  githubAvailable,
}: {
  onPick: (step: Step) => void
  githubAvailable: boolean
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card
        title="Import an existing project"
        body="Paste a git URL. We’ll clone it; if the repository already has overseer files, they load automatically."
        cta="Import…"
        onClick={() => onPick('project-import')}
        tone="default"
      />
      <Card
        title="Set up a new project on a fresh GitHub repository"
        body={
          githubAvailable
            ? 'Authorize GitHub once, then we’ll create a fresh repository and register the project in one step.'
            : 'GitHub authentication isn’t configured on this deployment.'
        }
        cta={githubAvailable ? 'Use GitHub…' : 'Coming soon'}
        onClick={() => onPick('project-new-github-auth')}
        tone="recommended"
        comingSoon={!githubAvailable}
      />
      <Card
        title="Set up a new project locally"
        body="Just register the project metadata. You can link a git repository later from Settings → Repository."
        cta="Set up…"
        onClick={() => onPick('project-new-local')}
        tone="default"
      />
    </div>
  )
}

/**
 * Import an existing project from a git URL. The repo URL is required here
 * (use the New form for repo-less projects). When the user provides a URL,
 * the in-project data location becomes available — for the central default,
 * the overseer holds the project's stories and chats.
 */
function ImportProjectForm({ onBack }: { onBack: () => void }) {
  const { refresh, setActiveProjectId } = useProjects()

  const [id, setId] = useState('')
  // The id mirrors the URL's trailing segment until the user types in the
  // id field. Mirroring stays cheap (no effect, no race) by deriving on
  // every render from the current URL — the moment the user touches the
  // id input we lock it.
  const [idTouched, setIdTouched] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [dataLocation, setDataLocation] = useState<ProjectDataLocation>('central')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedRepo = repoUrl.trim()
  const effectiveId = idTouched ? id : deriveProjectIdFromRepoUrl(trimmedRepo)
  const canSubmit =
    effectiveId.trim().length > 0 &&
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    trimmedRepo.length > 0

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { data: created } = await createProject({
        body: {
          id: effectiveId.trim(),
          title: title.trim(),
          description: description.trim(),
          repo_url: trimmedRepo,
          dataLocation,
        },
        throwOnError: true,
      })
      const project: GetProjectResponse = created
      await refresh()
      setActiveProjectId(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Surface as="form" onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
      <BackLink onBack={onBack} />
      <header>
        <h2 className="text-lg font-semibold">Import an existing project</h2>
        <p className="text-sm opacity-70">
          The backend will clone this repository and register it as a project.
        </p>
      </header>

      {error && <Alert variant="error">{error}</Alert>}

      <Field label="Git repository URL">
        <Input
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/org/repo.git"
          autoFocus
        />
      </Field>
      <Field
        label="Project ID"
        hint="A short stable identifier (e.g. my-app). Defaults to the repository name — edit if you want them to differ."
      >
        <Input
          value={effectiveId}
          onChange={(e) => {
            setIdTouched(true)
            setId(e.target.value)
          }}
        />
      </Field>
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <details className="text-sm">
        <summary className="cursor-pointer opacity-80">Advanced</summary>
        <div className="mt-3 flex flex-col gap-2">
          <span className="text-sm font-medium">Data location</span>
          <span className="text-xs opacity-70">
            Where this project’s stories and chats are kept. Switchable later in Settings.
          </span>
          <DataLocationRadios value={dataLocation} onChange={setDataLocation} inProjectAvailable />
        </div>
      </details>

      <Button type="submit" loading={submitting} disabled={!canSubmit}>
        Import project
      </Button>
    </Surface>
  )
}

/**
 * Register a project metadata-only. No repo is linked at creation time;
 * the user can attach one later from Settings → Repository. The GitHub
 * "create a fresh repo for this project" path is its own card on the
 * project chooser — see {@link CreateProjectRepoForm}.
 */
function NewProjectForm({ onBack }: { onBack: () => void }) {
  const { refresh, setActiveProjectId } = useProjects()

  const [id, setId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = id.trim().length > 0 && title.trim().length > 0 && description.trim().length > 0

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { data: created } = await createProject({
        body: {
          id: id.trim(),
          title: title.trim(),
          description: description.trim(),
          dataLocation: 'central',
        },
        throwOnError: true,
      })
      const project: GetProjectResponse = created
      await refresh()
      setActiveProjectId(project.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Surface as="form" onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
      <BackLink onBack={onBack} />
      <header>
        <h2 className="text-lg font-semibold">Set up a new project locally</h2>
        <p className="text-sm opacity-70">
          Register a new project. You can link a git repository later from Settings → Repository.
        </p>
      </header>

      {error && <Alert variant="error">{error}</Alert>}

      <Field label="Project ID" hint="A short stable identifier (e.g. my-app).">
        <Input value={id} onChange={(e) => setId(e.target.value)} autoFocus />
      </Field>
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <Button type="submit" loading={submitting} disabled={!canSubmit}>
        Create project
      </Button>
    </Surface>
  )
}

function DataLocationRadios({
  value,
  onChange,
  inProjectAvailable,
}: {
  value: ProjectDataLocation
  onChange: (next: ProjectDataLocation) => void
  inProjectAvailable: boolean
}) {
  return (
    <fieldset className="flex flex-col gap-2 mt-1">
      {DATA_LOCATION_OPTIONS.map((opt) => {
        const locked = opt.value === 'inProject' && !inProjectAvailable
        return (
          <label
            key={opt.value}
            title={locked ? IN_PROJECT_DISABLED_HINT : undefined}
            className="flex items-start gap-3"
            style={{
              cursor: locked ? 'not-allowed' : 'pointer',
              opacity: locked ? 0.5 : 1,
            }}
          >
            <input
              type="radio"
              name="data-location"
              value={opt.value}
              checked={value === opt.value}
              disabled={locked}
              onChange={() => onChange(opt.value)}
              className="mt-1"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{opt.title}</span>
              <span className="text-xs opacity-70">
                {locked ? IN_PROJECT_DISABLED_HINT : opt.hint}
              </span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}

const DATA_LOCATION_OPTIONS: ReadonlyArray<{
  value: ProjectDataLocation
  title: string
  hint: string
}> = [
  {
    value: 'central',
    title: 'Keep with thefactory-overseer project (recommended)',
    hint: 'Stories and chats live alongside other metadata in your thefactory-overseer project.',
  },
  {
    value: 'inProject',
    title: 'Keep inside this project’s git repository',
    hint: 'Stories and chats are committed to this project’s repository and travel with its git history.',
  },
]

const IN_PROJECT_DISABLED_HINT = 'Add a git repository URL above to enable this option.'

/**
 * Derive a project id from a git remote URL by taking its last path
 * segment and stripping a trailing `.git`. Handles both HTTPS
 * (`https://github.com/org/repo.git`) and SSH (`git@github.com:org/repo.git`)
 * forms by splitting on either `/` or `:`. Returns `''` for empty input —
 * the caller is responsible for treating that as "no suggestion yet".
 */
function deriveProjectIdFromRepoUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  const segments = trimmed.split(/[/:]/)
  const last = segments[segments.length - 1] ?? ''
  return last.replace(/\.git$/i, '')
}

function extractCloneErrorMessage(err: unknown): string {
  // 409 returns `OverseerNotEmptyError` ({ error, message, projectCount,
  // commitCount }) — surface `message` verbatim. Fall through to the
  // transport error message otherwise.
  return (
    getResponseDataMessage(err) ??
    (err instanceof Error ? err.message : 'Could not connect to the thefactory-overseer.')
  )
}
