import { describe, it, expect } from 'vitest'

describe('sessionStore', () => {
  it('sets, gets, lists, clears, and checks authentication', async () => {
    const { setSession, getSession, getAllUserIds, clearSession, isAuthenticated } = await import(
      '../src/lib/sessionStore'
    )

    const userId = '12345'
    expect(getSession(userId)).toBeUndefined()
    expect(getAllUserIds()).not.toContain(userId)

    setSession({ userId, accessToken: 'token', expiresAt: Math.floor(Date.now() / 1000) + 3600 })

    const s = getSession(userId)
    expect(s?.accessToken).toBe('token')
    expect(getAllUserIds()).toContain(userId)
    expect(isAuthenticated(userId)).toBe(true)

    clearSession(userId)
    expect(getSession(userId)).toBeUndefined()
    expect(getAllUserIds()).not.toContain(userId)
    expect(isAuthenticated(userId)).toBe(false)
  })
})
