import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  getSession,
  setSession,
  clearSession,
  getAllUserIds,
  isAuthenticated,
  SessionData,
} from '../../src/lib/sessionStore'

const sessionsDir = process.env.SESSIONS_DIR!
const sessionsFile = path.join(sessionsDir, '.sessions.json')

describe('lib/sessionStore', () => {
  // Clean up the sessions file before each test
  beforeEach(() => {
    if (fs.existsSync(sessionsFile)) {
      fs.unlinkSync(sessionsFile)
    }
  })

  describe('getSession and setSession', () => {
    it('should return undefined for a non-existent session', () => {
      expect(getSession('user123')).toBeUndefined()
    })

    it('should create and retrieve a new session', () => {
      const newSession: SessionData = {
        userId: 'user123',
        accessToken: 'token-abc',
      }
      setSession(newSession)

      const retrieved = getSession('user123')
      expect(retrieved).toEqual(newSession)
    })

    it('should update an existing session', () => {
      const initialSession: SessionData = {
        userId: 'user123',
        accessToken: 'token-abc',
      }
      setSession(initialSession)

      const updatedSession: SessionData = {
        userId: 'user123',
        accessToken: 'token-xyz',
        refreshToken: 'refresh-token',
      }
      setSession(updatedSession)

      const retrieved = getSession('user123')
      expect(retrieved?.accessToken).toBe('token-xyz')
      expect(retrieved?.refreshToken).toBe('refresh-token')
    })

    it('should preserve conversationState when updating other fields', () => {
      const initialSession: SessionData = {
        userId: 'user456',
        accessToken: 'token-1',
        conversationState: { flowId: 'profile.update' },
      }
      setSession(initialSession)

      const updatedSession: SessionData = {
        userId: 'user456',
        accessToken: 'token-2',
      }
      setSession(updatedSession) // `conversationState` is not provided here

      const retrieved = getSession('user456')
      expect(retrieved?.accessToken).toBe('token-2')
      expect(retrieved?.conversationState).toEqual({ flowId: 'profile.update' })
    })

    it('should explicitly update conversationState when provided', () => {
      const initialSession: SessionData = {
        userId: 'user456',
        accessToken: 'token-1',
        conversationState: { flowId: 'profile.update' },
      }
      setSession(initialSession)

      const updatedSession: SessionData = {
        userId: 'user456',
        accessToken: 'token-1',
        conversationState: { flowId: 'goals.new', context: { step: 1 } },
      }
      setSession(updatedSession)

      const retrieved = getSession('user456')
      expect(retrieved?.conversationState).toEqual({ flowId: 'goals.new', context: { step: 1 } })
    })

    it('should clear conversationState when set to null', () => {
      const initialSession: SessionData = {
        userId: 'user456',
        accessToken: 'token-1',
        conversationState: { flowId: 'profile.update' },
      }
      setSession(initialSession)

      const updatedSession: SessionData = {
        userId: 'user456',
        accessToken: 'token-1',
        conversationState: null,
      }
      setSession(updatedSession)

      const retrieved = getSession('user456')
      expect(retrieved?.conversationState).toBeNull()
    })
  })

  describe('clearSession', () => {
    it('should remove an existing session', () => {
      setSession({ userId: 'user1', accessToken: 'token-1' })
      setSession({ userId: 'user2', accessToken: 'token-2' })

      clearSession('user1')

      expect(getSession('user1')).toBeUndefined()
      expect(getSession('user2')).toBeDefined()
    })

    it('should do nothing if the session does not exist', () => {
      setSession({ userId: 'user1', accessToken: 'token-1' })
      clearSession('user-non-existent')
      expect(getSession('user1')).toBeDefined()
    })
  })

  describe('getAllUserIds', () => {
    it('should return an empty array when there are no sessions', () => {
      expect(getAllUserIds()).toEqual([])
    })

    it('should return all user IDs from the session file', () => {
      setSession({ userId: 'user-a', accessToken: 'token-a' })
      setSession({ userId: 'user-b', accessToken: 'token-b' })
      setSession({ userId: 'user-c', accessToken: 'token-c' })

      const userIds = getAllUserIds()
      expect(userIds).toHaveLength(3)
      expect(userIds).toContain('user-a')
      expect(userIds).toContain('user-b')
      expect(userIds).toContain('user-c')
    })
  })

  describe('isAuthenticated', () => {
    const now = Math.floor(Date.now() / 1000)

    it('should return false for a non-existent user', () => {
      expect(isAuthenticated('non-user')).toBe(false)
    })

    it('should return false if session exists but has no accessToken', () => {
      setSession({ userId: 'user-no-token' } as any)
      expect(isAuthenticated('user-no-token')).toBe(false)
    })

    it('should return true for a session with an accessToken and no expiry', () => {
      setSession({ userId: 'user-ok', accessToken: 'token-ok' })
      expect(isAuthenticated('user-ok')).toBe(true)
    })

    it('should return true for a session with a future expiresAt', () => {
      setSession({ userId: 'user-future', accessToken: 'token-future', expiresAt: now + 3600 })
      expect(isAuthenticated('user-future')).toBe(true)
    })

    it('should return false for a session with a past expiresAt', () => {
      setSession({ userId: 'user-past', accessToken: 'token-past', expiresAt: now - 100 })
      expect(isAuthenticated('user-past')).toBe(false)
    })

    it('should return false for a session expiring within the 30-second skew', () => {
      setSession({ userId: 'user-skew', accessToken: 'token-skew', expiresAt: now + 20 })
      expect(isAuthenticated('user-skew')).toBe(false)
    })
  })
})
