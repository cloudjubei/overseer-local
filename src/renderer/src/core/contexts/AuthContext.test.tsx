import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import type { AuthState } from '../../services/authService'

vi.mock('../../services/authService', () => {
  let state: AuthState = { baseUrl: null, token: null }
  return {
    authService: {
      get: vi.fn(async () => state),
      set: vi.fn(async (next: AuthState) => {
        state = { baseUrl: next.baseUrl ?? null, token: next.token ?? null }
        return state
      }),
      clear: vi.fn(async () => {
        state = { baseUrl: null, token: null }
        return state
      }),
    },
    __setState: (next: AuthState) => {
      state = next
    },
  }
})

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

describe('AuthContext', () => {
  beforeEach(async () => {
    const mod = (await import('../../services/authService')) as unknown as {
      __setState: (s: AuthState) => void
    }
    mod.__setState({ baseUrl: null, token: null })
  })

  it('hydrates state from authService on mount', async () => {
    const mod = (await import('../../services/authService')) as unknown as {
      __setState: (s: AuthState) => void
    }
    mod.__setState({ baseUrl: 'http://localhost:3000', token: 'abc' })

    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.ready).toBe(false)
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.baseUrl).toBe('http://localhost:3000')
    expect(result.current.token).toBe('abc')
  })

  it('setBaseUrl and setToken persist via authService', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.setBaseUrl('http://localhost:3000')
    })
    expect(result.current.baseUrl).toBe('http://localhost:3000')

    await act(async () => {
      await result.current.setToken('tok')
    })
    expect(result.current.token).toBe('tok')
  })

  it('clear wipes both fields and resets unauthorized', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.setBoth({ baseUrl: 'http://x', token: 't' })
    })
    act(() => result.current.markUnauthorized())
    expect(result.current.unauthorized).toBe(true)

    await act(async () => {
      await result.current.clear()
    })
    expect(result.current.baseUrl).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.unauthorized).toBe(false)
  })

  it('markUnauthorized / clearUnauthorized toggle the flag without touching state', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.ready).toBe(true))
    await act(async () => {
      await result.current.setBoth({ baseUrl: 'http://x', token: 't' })
    })

    act(() => result.current.markUnauthorized())
    expect(result.current.unauthorized).toBe(true)
    expect(result.current.token).toBe('t')

    act(() => result.current.clearUnauthorized())
    expect(result.current.unauthorized).toBe(false)
    expect(result.current.token).toBe('t')
  })
})
