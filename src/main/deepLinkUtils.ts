import { DEEP_LINK_PREFIX, DEEP_LINK_PROTOCOL } from './deepLinkConstants'
import type { DeepLinkEnvironment, ProtocolClientArgs } from './deepLinkTypes'

/**
 * An `overseer://` link with its scheme written lower case, or `undefined` for
 * anything else. Whether the app can read the rest is the page's call.
 */
export function normaliseDeepLink(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed.slice(0, DEEP_LINK_PREFIX.length).toLowerCase() !== DEEP_LINK_PREFIX) return undefined
  return `${DEEP_LINK_PREFIX}${trimmed.slice(DEEP_LINK_PREFIX.length)}`
}

/** The last `overseer://` link among a launch's arguments, as Windows and Linux pass it. */
export function findDeepLinkInArgv(argv: string[]): string | undefined {
  for (let i = argv.length - 1; i >= 0; i--) {
    const link = normaliseDeepLink(argv[i]!)
    if (link) return link
  }
  return undefined
}

/**
 * Arguments for `app.setAsDefaultProtocolClient`. A development run is the
 * Electron binary started on the app folder, so the OS must be told both.
 */
export function protocolClientArgs(environment: DeepLinkEnvironment): ProtocolClientArgs {
  const appFolder = environment.argv[1]
  if (!environment.defaultApp || !appFolder) return [DEEP_LINK_PROTOCOL]
  return [DEEP_LINK_PROTOCOL, environment.execPath, [environment.resolvePath(appFolder)]]
}
