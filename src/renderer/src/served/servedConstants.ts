/** Every name the Electron preload puts on `window`: finding one means this is the real app. */
export const SERVED_ELECTRON_BRIDGES = ['electron', 'authService', 'systemDictation'] as const

/** What a serve's fake backend token starts with, and all the fake backend accepts. */
export const SERVED_FAKE_TOKEN_PREFIX = 'fake-'

/** The only host a serve runs its fake backend on. */
export const SERVED_BACKEND_HOST = '127.0.0.1'

export const SERVED_ON_ELECTRON =
  'The served build found the Electron bridge: it only runs in a plain browser.'

export const SERVED_NOT_FAKE_TOKEN = `The served build only takes a throwaway token starting '${SERVED_FAKE_TOKEN_PREFIX}'.`

export const SERVED_NOT_FAKE_URL = `The served build only talks to a fake backend on ${SERVED_BACKEND_HOST}.`

export const SERVED_NEEDS_DESKTOP_APP =
  'Needs the desktop app. The backend address and token live in its secure storage, so this browser build on fake data can’t show this screen. Check it in the app.'

export const SERVED_DICTATION_UNAVAILABLE =
  'needs the desktop app. This browser build on fake data can’t start macOS Dictation, so check it in the app.'
