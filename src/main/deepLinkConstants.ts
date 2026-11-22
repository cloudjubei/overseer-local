/** The URL scheme the desktop app answers for, as the OS registers it. */
export const DEEP_LINK_PROTOCOL = 'overseer'

/** What every link the app opens starts with: the scheme plus its `//` authority. */
export const DEEP_LINK_PREFIX = `${DEEP_LINK_PROTOCOL}://`
