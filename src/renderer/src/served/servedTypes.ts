import type { SERVED_ELECTRON_BRIDGES } from './servedConstants'

/** What a serve hands the served build at compile time. */
export type ServedEnv = {
  baseUrl?: string
  token?: string
}

/** The fake backend the served build runs on. */
export type ServedAuth = {
  baseUrl: string
  token: string
}

/** The `window` the served build wakes up in, as far as Electron is concerned. */
export type ServedHost = Partial<Record<(typeof SERVED_ELECTRON_BRIDGES)[number], unknown>>
