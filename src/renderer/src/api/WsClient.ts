import ReconnectingWebSocket from 'reconnecting-websocket'
import type { Options as RWSOptions } from 'reconnecting-websocket'

export type WsEventHandler<T = unknown> = (data: T) => void

export type WsConnectionState = 'idle' | 'connecting' | 'open' | 'closed'

export type WsClientOptions = {
  baseUrl: string
  getToken: () => string | null
  onStateChange?: (state: WsConnectionState) => void
  rwsOptions?: RWSOptions
}

/**
 * Backend broadcast envelope, as emitted by `fastify.wsBroadcast`:
 *   { event: string, data: unknown, timestamp: string }
 *
 * The backend also sends lifecycle messages using a different shape
 *   { type: 'connected' | 'pong', timestamp }
 * which this client currently ignores.
 */
type BroadcastMessage = { event: string; data: unknown; timestamp?: string }

function isBroadcastMessage(v: unknown): v is BroadcastMessage {
  return typeof v === 'object' && v !== null && typeof (v as BroadcastMessage).event === 'string'
}

export class WsClient {
  private readonly baseUrl: string
  private readonly getToken: () => string | null
  private readonly onStateChange?: (state: WsConnectionState) => void
  private readonly rwsOptions?: RWSOptions

  private socket: ReconnectingWebSocket | null = null
  private state: WsConnectionState = 'idle'
  private readonly handlers = new Map<string, Set<WsEventHandler<unknown>>>()

  constructor(opts: WsClientOptions) {
    this.baseUrl = opts.baseUrl
    this.getToken = opts.getToken
    this.onStateChange = opts.onStateChange
    this.rwsOptions = opts.rwsOptions
  }

  connect(): void {
    if (this.socket) return
    this.setState('connecting')
    this.socket = new ReconnectingWebSocket(() => this.buildUrl(), [], this.rwsOptions)

    this.socket.addEventListener('open', () => this.setState('open'))
    this.socket.addEventListener('close', () => this.setState('closed'))
    this.socket.addEventListener('message', (ev) => this.onMessage(ev))
    // Reconnection is handled by reconnecting-websocket; swallow error events
    // to avoid unhandled rejections surfacing in the console.
    this.socket.addEventListener('error', () => {})
  }

  disconnect(): void {
    if (!this.socket) return
    this.socket.close()
    this.socket = null
    this.setState('idle')
  }

  /** Subscribe to a server event by name. Returns an unsubscribe function. */
  on<T = unknown>(event: string, handler: WsEventHandler<T>): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set<WsEventHandler<unknown>>()
      this.handlers.set(event, set)
    }
    set.add(handler as WsEventHandler<unknown>)
    return () => {
      const s = this.handlers.get(event)
      if (!s) return
      s.delete(handler as WsEventHandler<unknown>)
      if (s.size === 0) this.handlers.delete(event)
    }
  }

  getState(): WsConnectionState {
    return this.state
  }

  private onMessage(ev: MessageEvent) {
    let parsed: unknown
    try {
      parsed = JSON.parse(String(ev.data))
    } catch {
      return
    }
    if (!isBroadcastMessage(parsed)) return
    const set = this.handlers.get(parsed.event)
    if (!set) return
    for (const h of set) {
      try {
        h(parsed.data)
      } catch (err) {
        console.error(`[WsClient] handler for "${parsed.event}" threw`, err)
      }
    }
  }

  /**
   * Built lazily on each (re)connect so a freshly rotated token is picked up
   * without tearing down the socket.
   */
  private buildUrl(): string {
    const token = this.getToken()
    const base = this.baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '')
    const q = token ? `?token=${encodeURIComponent(token)}` : ''
    return `${base}/ws${q}`
  }

  private setState(next: WsConnectionState) {
    if (this.state === next) return
    this.state = next
    this.onStateChange?.(next)
  }
}
