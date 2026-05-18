import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type ReconnectingWebSocket from 'reconnecting-websocket'
import { WsClient, type WsConnectionState } from './WsClient'

/**
 * reconnecting-websocket is mocked so tests don't open real sockets. The mock
 * mirrors the surface WsClient uses (addEventListener, close) and exposes
 * `fire()` so tests can drive messages and lifecycle events deterministically.
 */
type Listener = (ev: unknown) => void
type FakeSocket = {
  addEventListener: Mock
  close: Mock
  fire: (event: string, payload: unknown) => void
}

const fakeSockets: FakeSocket[] = []

vi.mock('reconnecting-websocket', () => {
  return {
    default: class {
      private readonly listeners = new Map<string, Set<Listener>>()
      close = vi.fn()
      addEventListener: Mock

      constructor(_url: string | (() => string)) {
        this.addEventListener = vi.fn((event: string, listener: Listener) => {
          const set = this.listeners.get(event) ?? new Set<Listener>()
          set.add(listener)
          this.listeners.set(event, set)
        })
        fakeSockets.push({
          addEventListener: this.addEventListener,
          close: this.close,
          fire: (event: string, payload: unknown) => {
            this.listeners.get(event)?.forEach((l) => l(payload))
          },
        })
      }
    } as unknown as typeof ReconnectingWebSocket,
  }
})

describe('WsClient', () => {
  beforeEach(() => {
    fakeSockets.length = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function connect(token: string | null = 'tok'): {
    client: WsClient
    socket: FakeSocket
    states: WsConnectionState[]
  } {
    const states: WsConnectionState[] = []
    const client = new WsClient({
      baseUrl: 'http://api.test',
      getToken: () => token,
      onStateChange: (s) => states.push(s),
    })
    client.connect()
    const socket = fakeSockets.at(-1)!
    return { client, socket, states }
  }

  it('transitions idle → connecting → open on socket open', () => {
    const { states, socket } = connect()
    expect(states).toEqual(['connecting'])

    socket.fire('open', {})

    expect(states).toEqual(['connecting', 'open'])
  })

  it('transitions to closed when the socket closes', () => {
    const { states, socket } = connect()
    socket.fire('open', {})
    socket.fire('close', {})

    expect(states).toEqual(['connecting', 'open', 'closed'])
  })

  it('dispatches backend broadcast messages to subscribers by event name', () => {
    const { client, socket } = connect()
    const handler = vi.fn()
    client.on('projects:updated', handler)

    socket.fire('message', {
      data: JSON.stringify({
        event: 'projects:updated',
        data: { id: 'p1' },
        timestamp: 't',
      }),
    })

    expect(handler).toHaveBeenCalledWith({ id: 'p1' })
  })

  it('does not dispatch to handlers of other events', () => {
    const { client, socket } = connect()
    const handler = vi.fn()
    client.on('projects:updated', handler)

    socket.fire('message', {
      data: JSON.stringify({ event: 'chats:updated', data: {} }),
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores lifecycle messages that lack an `event` field', () => {
    const { client, socket } = connect()
    const handler = vi.fn()
    client.on('anything', handler)

    socket.fire('message', {
      data: JSON.stringify({ type: 'connected', timestamp: 't' }),
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('silently ignores malformed JSON messages', () => {
    const { client, socket } = connect()
    const handler = vi.fn()
    client.on('x', handler)

    expect(() => socket.fire('message', { data: 'not-json{' })).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })

  it('unsubscribe removes the handler and cleans up empty event sets', () => {
    const { client, socket } = connect()
    const handler = vi.fn()

    const off = client.on('projects:updated', handler)
    off()

    socket.fire('message', {
      data: JSON.stringify({ event: 'projects:updated', data: {} }),
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('closes the socket and returns to idle on disconnect', () => {
    const { client, socket, states } = connect()
    socket.fire('open', {})
    client.disconnect()

    expect(socket.close).toHaveBeenCalledTimes(1)
    expect(states.at(-1)).toBe('idle')
  })

  it('ignores a second connect() call while already connected', () => {
    const { client } = connect()
    client.connect()

    expect(fakeSockets).toHaveLength(1)
  })

  it('one throwing handler does not prevent other handlers from running', () => {
    const { client, socket } = connect()
    const bad = vi.fn(() => {
      throw new Error('boom')
    })
    const good = vi.fn()
    client.on('e', bad)
    client.on('e', good)

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    socket.fire('message', {
      data: JSON.stringify({ event: 'e', data: { ok: 1 } }),
    })

    expect(bad).toHaveBeenCalled()
    expect(good).toHaveBeenCalledWith({ ok: 1 })
    errSpy.mockRestore()
  })
})
