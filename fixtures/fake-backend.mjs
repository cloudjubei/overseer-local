/* eslint-disable @typescript-eslint/explicit-function-return-type -- This executable fixture is plain Node JavaScript. */
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createServer, request as httpRequest } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { appNoteFixture, fixtureProject, fixtureChats } from './show-app.mjs'

const token = process.env.VITE_BEARER_TOKEN || `fake-${randomUUID()}`
if (!/^fake-.+/.test(token)) throw new Error('The fake backend only accepts throwaway tokens.')
const cli = fileURLToPath(
  new URL('../node_modules/thefactory-ui/dist/fake-backend/cli.js', import.meta.url),
)
// Use the same asset as a production App without its own bridge.
const appBridge = await readFile(
  new URL('../node_modules/thefactory-tools/dist/assets/projectApp/bridge.js', import.meta.url),
)
const child = spawn(process.execPath, [cli, '--token-env', 'VITE_BEARER_TOKEN'], {
  env: { ...process.env, PORT: '0', VITE_BEARER_TOKEN: token },
  stdio: ['ignore', 'pipe', 'inherit'],
})
const lines = createInterface({ input: child.stdout })
const upstream = await new Promise((resolve, reject) => {
  child.once('error', reject)
  child.once('exit', () => reject(new Error('The shared fake backend exited.')))
  lines.on('line', (line) => {
    const match = /^Fake backend on (http:\/\/127\.0\.0\.1:\d+)$/.exec(line)
    if (match) resolve(match[1])
  })
})

const sendTurn = '/api/v1/completions/send-chat-with-cli'
const appView = `/api/v1/projects/${fixtureProject}/view`
const viewToken = randomUUID()
let lastTurn = null
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  const { pathname } = url
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Authorization, Content-Type',
    )
    res.writeHead(204).end()
    return
  }
  if (pathname === `${appView}/index.html` && req.method === 'GET') {
    if (url.searchParams.get('viewToken') !== viewToken) return json(res, 401, {})
    res
      .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      .end(appNoteFixture(viewToken))
    return
  }
  if (pathname === `${appView}/bridge.js` && req.method === 'GET') {
    if (url.searchParams.get('viewToken') !== viewToken) return json(res, 401, {})
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }).end(appBridge)
    return
  }
  if (pathname === `${appView}/grant` && req.method === 'POST') {
    if (req.headers.authorization !== `Bearer ${token}`) return json(res, 401, {})
    return json(res, 200, {
      token: viewToken,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    })
  }
  if (pathname === '/fixture/last-app-note-turn' && req.method === 'GET') {
    if (req.headers.authorization !== `Bearer ${token}`) return json(res, 401, {})
    return json(res, 200, lastTurn)
  }

  try {
    const headers = new Headers()
    for (const name of ['authorization', 'content-type']) {
      if (req.headers[name]) headers.set(name, req.headers[name])
    }
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req)
    if (
      pathname === '/api/v1/chats/get' &&
      body &&
      headers.get('authorization') === `Bearer ${token}`
    ) {
      const context = JSON.parse(body).context
      const fixture = fixtureChats.find((chat) => sameChat(context, chat.context))
      if (fixture) {
        const response = await fetch(upstream + url.pathname, { method: 'POST', headers, body })
        if (!response.ok) return json(res, response.status, await response.json())
        return json(res, 200, {
          ...(await response.json()),
          title: fixture.title,
          cliRunner: fixture.cliRunner,
        })
      }
    }
    const response = await fetch(upstream + url.pathname + url.search, {
      method: req.method,
      headers,
      body,
    })
    const result = await response.json()
    if (response.ok && pathname === '/api/v1/projects' && Array.isArray(result)) {
      return json(
        res,
        200,
        result.map((project) =>
          project.id === fixtureProject
            ? { ...project, metadata: { ...project.metadata, hasApp: true, appDir: 'fixture' } }
            : project,
        ),
      )
    }
    if (response.ok && pathname === '/api/v1/chats/summaries' && Array.isArray(result)) {
      return json(res, 200, [...fixtureChats, ...result])
    }
    if (response.ok && pathname === sendTurn && body) {
      const { chatContext, message } = JSON.parse(body)
      if (fixtureChats.some((chat) => sameChat(chatContext, chat.context))) {
        const { type, projectId, topicId } = chatContext
        lastTurn = {
          context: { type, projectId, topicId },
          noteOnly: !message.content.trim() && !message.files?.length,
          appNotes: (message.appNotes ?? []).map(({ projectId, comment, targets }) => ({
            projectId,
            comment,
            targets: targets.map(({ kind, selector }) => ({ kind, selector })),
          })),
        }
      }
    }
    return json(res, response.status, result)
  } catch {
    return json(res, 502, { error: 'The desktop fake could not answer this request.' })
  }
})

// Keep the shared fake's connection indicator and reconnect behavior.
server.on('upgrade', (req, socket, head) => {
  const { pathname, search } = new URL(req.url, upstream)
  const proxy = httpRequest(new URL(upstream + pathname + search), {
    headers: req.headers,
  })
  proxy.on('upgrade', (response, peer, pending) => {
    socket.on('error', () => peer.destroy())
    peer.on('error', () => socket.destroy())
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n${response.rawHeaders.reduce((text, value, index) => text + value + (index % 2 ? '\r\n' : ': '), '')}\r\n`,
    )
    if (pending.length) socket.write(pending)
    if (head.length) peer.write(head)
    peer.pipe(socket).pipe(peer)
  })
  proxy.on('response', () => socket.destroy())
  proxy.on('error', () => socket.destroy())
  proxy.end()
})

server.listen(Number(process.env.PORT || 0), '127.0.0.1', () => {
  console.log(`Desktop fake backend on http://127.0.0.1:${server.address().port}`)
  if (!process.env.VITE_BEARER_TOKEN) console.log(`Throwaway token: ${token}`)
})
child.on('exit', () => process.exit(1))
process.on('exit', () => child.kill())
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0))

function sameChat(left, right) {
  return (
    left?.type === right.type &&
    left.projectId === right.projectId &&
    left.topicId === right.topicId
  )
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8') || undefined
}
