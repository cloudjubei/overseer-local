/**
 * Renderer-side typed handle for the preload bridge that hands over
 * `overseer://` links opened outside the app. `onOpen` returns the
 * unsubscribe; while subscribed, the main process sends links straight
 * through instead of holding them.
 */
export type DeepLinkService = {
  onOpen: (listener: (url: string) => void) => () => void
}

export const deepLinkService: DeepLinkService = { ...window.deepLinks }
