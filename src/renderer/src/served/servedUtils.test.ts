import { describe, expect, it } from 'vitest'
import {
  SERVED_ELECTRON_BRIDGES,
  SERVED_NOT_FAKE_TOKEN,
  SERVED_NOT_FAKE_URL,
  SERVED_ON_ELECTRON,
} from './servedConstants'
import { readServedAuth } from './servedUtils'

const FAKE = { baseUrl: 'http://127.0.0.1:41733', token: 'fake-1b2c' }

describe('readServedAuth', () => {
  it('hands over what the serve made when no Electron bridge is there', () => {
    expect(readServedAuth(FAKE, {})).toEqual(FAKE)
  })

  it.each(SERVED_ELECTRON_BRIDGES)('refuses to run beside the %s bridge', (bridge) => {
    expect(() => readServedAuth(FAKE, { [bridge]: {} })).toThrow(SERVED_ON_ELECTRON)
  })

  it('refuses a bridge that is only a function', () => {
    expect(() => readServedAuth(FAKE, { authService: () => undefined })).toThrow(SERVED_ON_ELECTRON)
  })

  it.each([
    ['no token', undefined],
    ['an empty token', ''],
    ['a real token', 'dev-test-token'],
    ['a token with the word inside', 'real-fake-token'],
    ['a token in the wrong case', 'FAKE-1b2c'],
  ])('refuses %s', (_name, token) => {
    expect(() => readServedAuth({ ...FAKE, token }, {})).toThrow(SERVED_NOT_FAKE_TOKEN)
  })

  it.each([
    ['no url', undefined],
    ['an empty url', ''],
    ['something that is no url', 'not a url'],
    ['a remote backend', 'https://api.example.com'],
    ['a remote backend named like the loopback', 'http://127.0.0.1.example.com:7001'],
    ['a remote backend behind a username', 'http://127.0.0.1@example.com'],
    ['the name localhost', 'http://localhost:7001'],
  ])('refuses %s', (_name, baseUrl) => {
    expect(() => readServedAuth({ ...FAKE, baseUrl }, {})).toThrow(SERVED_NOT_FAKE_URL)
  })

  it('checks the bridge before anything the env says', () => {
    expect(() => readServedAuth({}, { electron: {} })).toThrow(SERVED_ON_ELECTRON)
  })
})
