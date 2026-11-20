// Capture-only transport shim, for the declared fake backend only.
const origin = new URL(import.meta.env.VITE_API_BASE_URL)
if (origin.hostname !== '127.0.0.1' || !import.meta.env.VITE_BEARER_TOKEN?.startsWith('fake-')) throw new Error('Fake backend required')
const flow = new URLSearchParams(location.search).get('proofFlow')
const requestId = '8a95cafa-96a2-4dcd-b7e6-124f6cd16764'
const projectId = 'thefactory-backend'
const chatContextId = `/projects/${projectId}/feature-requests/${requestId}`
const timestamp = '2026-10-18T12:00:00.000Z'
let active = flow === 'reconnect'
let listStatus = active ? 'in_progress' : 'failed'
let fixture
let socket
const shape = (record, status) => ({ ...record, status, statusReason: undefined, updatedAt: timestamp, handling: { ...record.handling, work: { mode: 'chat', chatContextId, startedAt: timestamp } } })
if (flow === 'reconnect' || flow === 'retry') {
  const NativeSocket = window.WebSocket
  window.WebSocket = class extends NativeSocket {
    constructor(url, protocols) {
      super(url, protocols)
      if (new URL(url).host === origin.host) socket = this
    }
  }
  window.addEventListener('keydown', (event) => {
    if (flow !== 'reconnect' || !event.ctrlKey || !event.shiftKey || event.code !== 'KeyY' || socket?.readyState !== NativeSocket.OPEN || !active) return
    event.preventDefault()
    socket.addEventListener('close', () => { active = false; listStatus = 'failed' }, { once: true })
    socket.close(4000, 'Dry proof: missed request update')
  })
  const Xhr = window.XMLHttpRequest
  const prop = (object, name, get) => Object.defineProperty(object, name, { get, configurable: true })
  window.XMLHttpRequest = class extends Xhr {
    open(method, url, ...args) {
      this.proofMethod = method.toUpperCase()
      this.proofUrl = new URL(url, location.href)
      return super.open(method, url, ...args)
    }
    send(body) {
      const url = this.proofUrl
      if (url.origin !== origin.origin) return super.send(body)
      const write = (data) => {
        const text = JSON.stringify(data)
        prop(this, 'responseText', () => text)
        prop(this, 'response', () => this.responseType === 'json' ? data : text)
      }
      const reply = (data) => setTimeout(() => {
        write(data)
        prop(this, 'status', () => 200)
        prop(this, 'statusText', () => 'OK')
        prop(this, 'readyState', () => 4)
        prop(this, 'responseURL', () => url.href)
        this.getAllResponseHeaders = () => 'content-type: application/json\r\n'
        this.dispatchEvent(new Event('readystatechange'))
        this.dispatchEvent(new ProgressEvent('load'))
        this.dispatchEvent(new ProgressEvent('loadend'))
      }, 0)
      if (this.proofMethod === 'GET' && url.pathname === '/api/v1/feature-requests') {
        this.addEventListener('readystatechange', () => {
          if (this.readyState !== 4 || this.status !== 200) return
          const records = this.responseType === 'json' ? this.response : JSON.parse(this.responseText)
          if (!Array.isArray(records)) return
          write(records.map((record) => {
            if (record.id !== requestId) return record
            fixture = record
            return shape(record, listStatus)
          }))
        })
      }
      if (this.proofMethod === 'GET' && url.pathname === '/api/v1/completions/turn' && url.searchParams.get('chatContextId') === chatContextId) {
        reply({ active }); return
      }
      if (flow === 'retry' && fixture && this.proofMethod === 'POST' && url.pathname === `/api/v1/feature-requests/${requestId}/start-again`) {
        // Keep the list stale and withhold featureRequest:updated. Deliver only linked turn activity.
        reply(shape(fixture, 'in_progress'))
        setTimeout(() => {
          if (socket?.readyState !== NativeSocket.OPEN) {
            console.error('[dry proof] linked turn not delivered: fake socket not open')
            return
          }
          active = true
          const data = JSON.stringify({ event: 'completion:turn', data: { chatContextId, active }, timestamp })
          socket.dispatchEvent(new MessageEvent('message', { data }))
          console.info('[dry proof] dispatched completion:turn active=true for', chatContextId)
        }, 1500)
        return
      }
      return super.send(body)
    }
  }
}
