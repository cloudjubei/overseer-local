import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

import {
  getSession,
  setSession,
  clearSession,
  isAuthenticated,
  getAllUserIds,
  type SessionData,
} from '../../src/lib/sessionStore'
import { logger } from '../../src/lib/logger'

const sessionsDir = path.join(__dirname, '../.temp_sessions')

describe('lib/sessionStore', () => {
  beforeEach(() => {
    // ensure temp dir cleaned between tests
    if (fs.existsSync(sessionsDir)) fs.rmSync(sessionsDir, { recursive: true, force: true })
    fs.mkdirSync(sessionsDir, { recursive: true })
    process.env.SESSIONS_DIR = sessionsDir
    vi.restoreAllMocks()
  })

  it('should return undefined when no session exists and list empty users', () => {
    expect(getSession('nope')).toBeUndefined()
    expect(getAllUserIds()).toEqual([])
  })

  it('should persist, read, and clear sessions', () => {
    const s: SessionData = {
      userId: 'u1',
      accessToken: 't1',
      conversationState: { flowId: 'flow' },
    }
    setSession(s)
    expect(getAllUserIds()).toEqual(['u1'])

    const read = getSession('u1')!
    expect(read.accessToken).toBe('t1')
    expect(read.conversationState?.flowId).toBe('flow')

    clearSession('u1')
    expect(getSession('u1')).toBeUndefined()
    expect(getAllUserIds()).toEqual([])
  })

  it('should preserve previous conversationState if not provided', () => {
    const first: SessionData = {
      userId: 'u2',
      accessToken: 't2',
      conversationState: { flowId: 'flowA', context: { a: 1 } },
    }
    setSession(first)

    // merge without conversationState provided -> keep previous
    setSession({ userId: 'u2', accessToken: 't2b' })
    const merged = getSession('u2')!
    expect(merged.accessToken).toBe('t2b')
    expect(merged.conversationState).toEqual({ flowId: 'flowA', context: { a: 1 } })

    // now explicitly clear conversation state
    setSession({ userId: 'u2', accessToken: 't2c', conversationState: null })
    const cleared = getSession('u2')!
    expect(cleared.conversationState).toBeNull()
  })

  it('isAuthenticated should consider expiresAt with small skew', () => {
    const nowSec = 1_700_000_000
    vi.spyOn(Date, 'now').mockReturnValue(nowSec * 1000)

    // Not authenticated without session
    expect(isAuthenticated('nouser')).toBe(false)

    // Authenticated without expiresAt
    setSession({ userId: 'u3', accessToken: 'tk' })
    expect(isAuthenticated('u3')).toBe(true)

    // Expired: expiresAt < now + 30
    setSession({ userId: 'u4', accessToken: 'tk', expiresAt: nowSec + 10 })
    expect(isAuthenticated('u4')).toBe(false)

    // Valid: expiresAt sufficiently in future
    setSession({ userId: 'u5', accessToken: 'tk', expiresAt: nowSec + 3600 })
    expect(isAuthenticated('u5')).toBe(true)
  })

  it('should handle read errors gracefully and start empty', () => {
    const file = path.join(sessionsDir, '.sessions.json')
    fs.writeFileSync(file, '{not-json', 'utf8')
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})

    // Any call that reads should swallow error and return defaults
    expect(getAllUserIds()).toEqual([])
    expect(getSession('u1')).toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('should handle write errors gracefully', () => {
    const errSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
    // cause write to throw
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('disk full')
    })

    // setSession should not throw
    expect(() => setSession({ userId: 'u6', accessToken: 'tk' })).not.toThrow()
    expect(errSpy).toHaveBeenCalled()

    writeSpy.mockRestore()
  })
})
