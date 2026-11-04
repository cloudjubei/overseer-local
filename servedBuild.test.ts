// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative, resolve } from 'node:path'
import type { Alias, Plugin } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import electronConfig from './electron.vite.config'
import servedConfig from './vite.config'
import {
  SERVED_NOT_FAKE_TOKEN,
  SERVED_NOT_FAKE_URL,
} from './src/renderer/src/served/servedConstants'

const ROOT = __dirname
const SERVED_DIR = join(ROOT, 'src/renderer/src/served')
const REPLACED_MODULES = [
  'services/authService',
  'LoginScreen',
  'BackendConnectionPanel',
  'macOsDictationTrigger',
]
const FAKE = { VITE_API_BASE_URL: 'http://127.0.0.1:41733', VITE_BEARER_TOKEN: 'fake-1b2c' }

const sourcesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourcesUnder(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })

const electronSources = (): string[] =>
  ['src/main', 'src/preload', 'src/renderer/src']
    .flatMap((dir) => sourcesUnder(join(ROOT, dir)))
    .filter((path) => !path.startsWith(SERVED_DIR) && !/\.test\.tsx?$/.test(path))

const read = (path: string): string => readFileSync(path, 'utf8')

const valueImportsOf = (source: string): string[] =>
  [...source.matchAll(/^(?:import|export)( type)?[^'"]*?from '([^']+)'/gm)]
    .filter((match) => match[1] === undefined)
    .map((match) => match[2] ?? '')

const aliases = (): Alias[] => servedConfig.resolve?.alias as Alias[]

const replacementOf = (specifier: string): string | undefined =>
  aliases()
    .find(({ find }) => (find instanceof RegExp ? find.test(specifier) : find === specifier))
    ?.replacement.toString()

const buildGuard = (): (() => void) => {
  const plugin = (servedConfig.plugins?.flat() as Plugin[]).find(
    (entry) => entry.name === 'fake-backend-only',
  )
  return plugin?.buildStart as () => void
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('the Electron app', () => {
  it('builds its renderer with no served replacement and no compile-time value', () => {
    const renderer = electronConfig.renderer as Record<string, { alias?: object }>
    expect(Object.keys(renderer.resolve?.alias ?? {})).toEqual([
      '@renderer',
      '@core',
      '@services',
      '@ui',
    ])
    expect(JSON.stringify(renderer)).not.toContain('served')
    expect(renderer).not.toHaveProperty('define')
  })

  it('imports nothing of the served build from anything it compiles', () => {
    const reaching = electronSources()
      .filter((path) => /['"`][^'"`]*\/served[^'"`]*['"`]/.test(read(path)))
      .map((path) => relative(ROOT, path))
    expect(reaching).toEqual([])
  })

  it('reads no build env in anything it compiles', () => {
    const reading = electronSources()
      .filter((path) => /import\.meta\.env|VITE_API_BASE_URL|VITE_BEARER_TOKEN/.test(read(path)))
      .map((path) => relative(ROOT, path))
    expect(reading).toEqual([])
  })
})

describe('the served build', () => {
  it.each(REPLACED_MODULES)(
    'replaces %s under every spelling the renderer imports it by',
    (name) => {
      const specifiers = electronSources().flatMap((path) =>
        valueImportsOf(read(path)).filter((from) => from.endsWith(name)),
      )
      expect(specifiers.length).toBeGreaterThan(0)
      for (const specifier of specifiers) {
        expect(replacementOf(specifier)?.startsWith(SERVED_DIR)).toBe(true)
      }
    },
  )

  it('leaves the shared panel of the same name alone', () => {
    expect(replacementOf('thefactory-ui/web')).toBeUndefined()
  })

  it('keeps its output out of what electron-builder packs', () => {
    const builder = createRequire(resolve(ROOT, 'electron-builder.cjs'))('./electron-builder.cjs')
    expect(builder.files).toContain('out/**/*')
    const outDir = servedConfig.build?.outDir ?? ''
    expect(relative(resolve(ROOT, 'out'), outDir).startsWith('..')).toBe(true)
  })

  it('reads no env file, so the checkout cannot hand it a real backend', () => {
    expect(servedConfig.envDir).toBe(false)
  })

  it('builds for the values a serve hands it', () => {
    for (const [name, value] of Object.entries(FAKE)) vi.stubEnv(name, value)
    expect(() => buildGuard()()).not.toThrow()
  })

  it.each([
    ['a real token', { VITE_BEARER_TOKEN: 'dev-test-token' }, SERVED_NOT_FAKE_TOKEN],
    ['no token', { VITE_BEARER_TOKEN: '' }, SERVED_NOT_FAKE_TOKEN],
    ['a remote backend', { VITE_API_BASE_URL: 'https://api.example.com' }, SERVED_NOT_FAKE_URL],
    ['no backend', { VITE_API_BASE_URL: '' }, SERVED_NOT_FAKE_URL],
  ])('will not compile %s into a bundle', (_name, env, problem) => {
    for (const [name, value] of Object.entries({ ...FAKE, ...env })) vi.stubEnv(name, value)
    expect(() => buildGuard()()).toThrow(problem)
  })
})
