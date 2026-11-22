import { describe, expect, it } from 'vitest'
import { DEEP_LINK_PROTOCOL } from './deepLinkConstants'
import { findDeepLinkInArgv, normaliseDeepLink, protocolClientArgs } from './deepLinkUtils'

const STORY = 'overseer://projects/p1/stories/s1'

describe('normaliseDeepLink', () => {
  it('keeps an overseer link as it is', () => {
    expect(normaliseDeepLink(STORY)).toBe(STORY)
  })

  it('reads the scheme in any case and writes it lower case, leaving the rest alone', () => {
    expect(normaliseDeepLink('OverSeer://projects/P1/stories/S1')).toBe(
      'overseer://projects/P1/stories/S1',
    )
  })

  it('drops the whitespace a shell or chat app wraps around a link', () => {
    expect(normaliseDeepLink(`  ${STORY}\n`)).toBe(STORY)
  })

  it('keeps a link the app may not read, so the app can say so', () => {
    expect(normaliseDeepLink('overseer://nowhere/at/all')).toBe('overseer://nowhere/at/all')
  })

  it.each([
    ['another scheme', 'https://example.com/projects/p1'],
    ['the bridge prefix without an authority', 'overseer:projects/p1'],
    ['a path', '/Applications/Overseer.app'],
    ['an empty string', ''],
    ['a flag', '--allow-file-access-from-files'],
  ])('is no link for %s', (_label, value) => {
    expect(normaliseDeepLink(value)).toBeUndefined()
  })
})

describe('findDeepLinkInArgv', () => {
  it('finds the link a packaged Windows or Linux launch passes last', () => {
    expect(findDeepLinkInArgv(['C:\\Program Files\\Overseer\\Overseer.exe', STORY])).toBe(STORY)
  })

  it('finds the link between the app path and the flags Chromium adds on a second launch', () => {
    expect(
      findDeepLinkInArgv([
        '/usr/lib/electron/electron',
        '/home/me/overseer-local',
        STORY,
        '--allow-file-access-from-files',
        '--original-process-start-time=13370000000000000',
      ]),
    ).toBe(STORY)
  })

  it('takes the last link when several are passed', () => {
    const run = 'overseer://projects/p1/process-runs/r1'
    expect(findDeepLinkInArgv(['/bin/overseer', STORY, run])).toBe(run)
  })

  it('is no link when the launch carries none', () => {
    expect(findDeepLinkInArgv(['/Applications/Overseer.app/Contents/MacOS/Overseer'])).toBe(
      undefined,
    )
    expect(findDeepLinkInArgv([])).toBeUndefined()
  })
})

describe('protocolClientArgs', () => {
  const inRepo = (path: string): string => (path === '.' ? '/repo' : path)

  it('registers the packaged app by the scheme alone', () => {
    expect(
      protocolClientArgs({
        defaultApp: false,
        execPath: '/Applications/Overseer.app/Contents/MacOS/Overseer',
        argv: ['/Applications/Overseer.app/Contents/MacOS/Overseer'],
        resolvePath: inRepo,
      }),
    ).toEqual([DEEP_LINK_PROTOCOL])
  })

  it('registers a development run with the Electron binary and the app folder it runs', () => {
    expect(
      protocolClientArgs({
        defaultApp: true,
        execPath: '/repo/node_modules/electron/dist/electron',
        argv: ['/repo/node_modules/electron/dist/electron', '.'],
        resolvePath: inRepo,
      }),
    ).toEqual([DEEP_LINK_PROTOCOL, '/repo/node_modules/electron/dist/electron', ['/repo']])
  })

  it('falls back to the scheme alone when a development run names no app folder', () => {
    expect(
      protocolClientArgs({
        defaultApp: true,
        execPath: '/repo/node_modules/electron/dist/electron',
        argv: ['/repo/node_modules/electron/dist/electron'],
        resolvePath: inRepo,
      }),
    ).toEqual([DEEP_LINK_PROTOCOL])
  })
})
